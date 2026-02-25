import type { JSONContent } from '@tiptap/core';
import { pluginManager } from '@/lib/plugins';
import type {
  Chapter,
  ChapterSyncMetadata,
  ConflictInfo,
  ConflictResolutionOption,
  IntegrationType,
  MergeConflictBlock,
} from '@/types';
import type { ProviderDocument } from './types';

interface SyncContext {
  provider: IntegrationType;
  remoteRevision: string;
}

interface ThreeWayMergeArgs {
  chapter: Chapter;
  remoteDocument: ProviderDocument;
  context: SyncContext;
}

interface ThreeWayMergeResult {
  chapterUpdate: Chapter;
  conflict?: ConflictInfo;
}

interface LineEdit {
  start: number;
  end: number;
  lines: string[];
}

interface ThreeWayLineMergeResult {
  mergedLines: string[];
  conflictBlocks: MergeConflictBlock[];
}

const SHA256_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;
const LOCAL_CONFLICT_MARKER = 'LOCAL';
const REMOTE_CONFLICT_MARKER = 'REMOTE';

function ensureDoc(content: JSONContent | null | undefined): JSONContent {
  if (content && content.type === 'doc') {
    return content;
  }

  return {
    type: 'doc',
    content: [],
  };
}

function textToDoc(text: string): JSONContent {
  const lines = text.split(/\n/);
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line.trim() ? [{ type: 'text', text: line }] : [],
    })),
  };
}

function linesToDoc(lines: string[]): JSONContent {
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line.trim() ? [{ type: 'text', text: line }] : [],
    })),
  };
}

function docToLines(doc: JSONContent | null | undefined): string[] {
  if (!doc || !Array.isArray(doc.content)) {
    return [];
  }

  return doc.content.map((node) => {
    if (typeof node.text === 'string') {
      return node.text;
    }

    if (Array.isArray(node.content)) {
      return node.content
        .map((child) => (typeof child.text === 'string' ? child.text : ''))
        .join('');
    }

    return '';
  });
}

function docToText(doc: JSONContent | null | undefined): string {
  return docToLines(doc).join('\n').trim();
}

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, canonicalizeValue(nested)]);

    return Object.fromEntries(entries);
  }

  return value;
}

function serializeCanonicalContent(content: JSONContent | null | undefined): string {
  return JSON.stringify(canonicalizeValue(ensureDoc(content)));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

type DigestProvider = Pick<SubtleCrypto, 'digest'>;

async function getSubtleCrypto(): Promise<DigestProvider> {
  if (globalThis.crypto?.subtle) {
    return globalThis.crypto.subtle;
  }

  const { webcrypto } = await import('node:crypto');
  return webcrypto.subtle;
}

const contentHashMemo = new Map<string, Promise<string>>();

async function hashContent(content: JSONContent | null | undefined): Promise<string> {
  const serialized = serializeCanonicalContent(content);
  const memoized = contentHashMemo.get(serialized);
  if (memoized) {
    return memoized;
  }

  const digestPromise = (async () => {
    const subtle = await getSubtleCrypto();
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(serialized));
    return `sha256:${bytesToHex(new Uint8Array(digest))}`;
  })();

  contentHashMemo.set(serialized, digestPromise);
  return digestPromise;
}

function sanitizeLegacyPushedHash(lastPushedHash: string | undefined): string | undefined {
  if (!lastPushedHash) {
    return undefined;
  }

  return SHA256_HASH_PATTERN.test(lastPushedHash) ? lastPushedHash : undefined;
}

function computeLineEdits(base: string[], variant: string[]): LineEdit[] {
  const m = base.length;
  const n = variant.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (base[i] === variant[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const ops: Array<'equal' | 'add' | 'del'> = [];
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && base[i] === variant[j]) {
      ops.push('equal');
      i += 1;
      j += 1;
    } else if (j < n && (i === m || lcs[i][j + 1] >= lcs[i + 1][j])) {
      ops.push('add');
      j += 1;
    } else {
      ops.push('del');
      i += 1;
    }
  }

  const edits: LineEdit[] = [];
  i = 0;
  j = 0;
  let k = 0;
  while (k < ops.length) {
    if (ops[k] === 'equal') {
      i += 1;
      j += 1;
      k += 1;
      continue;
    }

    const start = i;
    const lines: string[] = [];
    while (k < ops.length && ops[k] !== 'equal') {
      if (ops[k] === 'del') {
        i += 1;
      } else {
        lines.push(variant[j]);
        j += 1;
      }
      k += 1;
    }

    edits.push({ start, end: i, lines });
  }

  return edits;
}

function editsConflict(a: LineEdit, b: LineEdit): boolean {
  const aInsert = a.start === a.end;
  const bInsert = b.start === b.end;

  if (aInsert && bInsert) {
    return a.start === b.start && JSON.stringify(a.lines) !== JSON.stringify(b.lines);
  }

  if (!aInsert && !bInsert) {
    return Math.max(a.start, b.start) < Math.min(a.end, b.end);
  }

  const insertion = aInsert ? a : b;
  const range = aInsert ? b : a;
  return insertion.start > range.start && insertion.start < range.end;
}

function applyEditsWithinRange(base: string[], edits: LineEdit[], start: number, end: number): string[] {
  const scopedEdits = edits
    .filter((edit) => edit.start >= start && edit.end <= end)
    .sort((a, b) => (a.start - b.start) || (a.end - b.end));
  const out: string[] = [];
  let cursor = start;

  for (const edit of scopedEdits) {
    if (edit.start > cursor) {
      out.push(...base.slice(cursor, edit.start));
    }
    out.push(...edit.lines);
    cursor = edit.end;
  }

  if (cursor < end) {
    out.push(...base.slice(cursor, end));
  }

  return out;
}

function buildConflictLines(localLines: string[], remoteLines: string[]): string[] {
  return [
    `<<<<<<< ${LOCAL_CONFLICT_MARKER}`,
    ...localLines,
    '=======',
    ...remoteLines,
    `>>>>>>> ${REMOTE_CONFLICT_MARKER}`,
  ];
}

function threeWayMergeLines(base: string[], local: string[], remote: string[]): ThreeWayLineMergeResult {
  const localEdits = computeLineEdits(base, local);
  const remoteEdits = computeLineEdits(base, remote);
  const mergedLines: string[] = [];
  const conflictBlocks: MergeConflictBlock[] = [];

  let li = 0;
  let ri = 0;
  let cursor = 0;

  while (li < localEdits.length || ri < remoteEdits.length) {
    const nextLocal = localEdits[li];
    const nextRemote = remoteEdits[ri];

    if (!nextLocal && nextRemote) {
      if (nextRemote.start > cursor) {
        mergedLines.push(...base.slice(cursor, nextRemote.start));
      }
      mergedLines.push(...nextRemote.lines);
      cursor = nextRemote.end;
      ri += 1;
      continue;
    }

    if (nextLocal && !nextRemote) {
      if (nextLocal.start > cursor) {
        mergedLines.push(...base.slice(cursor, nextLocal.start));
      }
      mergedLines.push(...nextLocal.lines);
      cursor = nextLocal.end;
      li += 1;
      continue;
    }

    if (!nextLocal || !nextRemote) {
      break;
    }

    const nextStart = Math.min(nextLocal.start, nextRemote.start);
    if (nextStart > cursor) {
      mergedLines.push(...base.slice(cursor, nextStart));
      cursor = nextStart;
    }

    if (!editsConflict(nextLocal, nextRemote)) {
      if (nextLocal.start < nextRemote.start || (nextLocal.start === nextRemote.start && li <= ri)) {
        mergedLines.push(...nextLocal.lines);
        cursor = Math.max(cursor, nextLocal.end);
        li += 1;
      } else {
        mergedLines.push(...nextRemote.lines);
        cursor = Math.max(cursor, nextRemote.end);
        ri += 1;
      }
      continue;
    }

    const conflictStart = Math.min(nextLocal.start, nextRemote.start);
    let conflictEnd = Math.max(nextLocal.end, nextRemote.end);
    const conflictLocal: LineEdit[] = [nextLocal];
    const conflictRemote: LineEdit[] = [nextRemote];
    li += 1;
    ri += 1;

    let expanded = true;
    while (expanded) {
      expanded = false;

      while (li < localEdits.length) {
        const candidate = localEdits[li];
        const overlapsConflict =
          candidate.start < conflictEnd ||
          conflictRemote.some((remoteEdit) => editsConflict(candidate, remoteEdit));
        if (!overlapsConflict) break;
        conflictLocal.push(candidate);
        conflictEnd = Math.max(conflictEnd, candidate.end);
        li += 1;
        expanded = true;
      }

      while (ri < remoteEdits.length) {
        const candidate = remoteEdits[ri];
        const overlapsConflict =
          candidate.start < conflictEnd ||
          conflictLocal.some((localEdit) => editsConflict(localEdit, candidate));
        if (!overlapsConflict) break;
        conflictRemote.push(candidate);
        conflictEnd = Math.max(conflictEnd, candidate.end);
        ri += 1;
        expanded = true;
      }
    }

    if (conflictStart > cursor) {
      mergedLines.push(...base.slice(cursor, conflictStart));
    }

    const localVariant = applyEditsWithinRange(base, conflictLocal, conflictStart, conflictEnd);
    const remoteVariant = applyEditsWithinRange(base, conflictRemote, conflictStart, conflictEnd);
    const mergedStart = mergedLines.length;
    const conflictLines = buildConflictLines(localVariant, remoteVariant);
    mergedLines.push(...conflictLines);
    const mergedEnd = mergedLines.length;

    conflictBlocks.push({
      id: `conflict-${conflictBlocks.length + 1}`,
      baseStart: conflictStart,
      baseEnd: conflictEnd,
      mergedStart,
      mergedEnd,
      localLines: localVariant,
      remoteLines: remoteVariant,
    });

    cursor = conflictEnd;
  }

  if (cursor < base.length) {
    mergedLines.push(...base.slice(cursor));
  }

  return { mergedLines, conflictBlocks };
}

function buildSyncMetadata(
  chapter: Chapter,
  provider: IntegrationType,
  remoteRevision: string,
  content: JSONContent | null,
  options?: { lastPulledAt?: number; lastPushedHash?: string }
): ChapterSyncMetadata {
  return {
    providerRevisionIds: {
      ...(chapter.sync?.providerRevisionIds || {}),
      [provider]: remoteRevision,
    },
    lastPushedHash: options?.lastPushedHash ?? sanitizeLegacyPushedHash(chapter.sync?.lastPushedHash),
    lastPulledAt: options?.lastPulledAt ?? chapter.sync?.lastPulledAt,
    lastSyncedContent: content,
  };
}

export async function buildPushSyncMetadata(
  chapter: Chapter,
  provider: IntegrationType,
  remoteRevision: string
): Promise<ChapterSyncMetadata> {
  return buildSyncMetadata(chapter, provider, remoteRevision, chapter.content, {
    lastPushedHash: await hashContent(chapter.content),
  });
}

export async function mergeChapterFromRemote({ chapter, remoteDocument, context }: ThreeWayMergeArgs): Promise<ThreeWayMergeResult> {
  const now = Date.now();
  const localContent = chapter.content;
  const baseContent = chapter.sync?.lastSyncedContent ?? null;
  const remoteContent = textToDoc(remoteDocument.body);

  const [localHash, baseHash, remoteHash] = await Promise.all([
    hashContent(localContent),
    hashContent(baseContent),
    hashContent(remoteContent),
  ]);

  const localChanged = localHash !== baseHash;
  const remoteChanged = remoteHash !== baseHash;

  pluginManager.emit('sync:import:before', {
    chapterId: chapter.id,
    provider: context.provider,
    remoteRevision: context.remoteRevision,
    localChanged,
    remoteChanged,
  });

  if (localChanged && remoteChanged) {
    const mergeResult = threeWayMergeLines(docToLines(baseContent), docToLines(localContent), docToLines(remoteContent));
    const mergedContent = linesToDoc(mergeResult.mergedLines);

    if (mergeResult.conflictBlocks.length > 0) {
      const conflict: ConflictInfo = {
        chapterId: chapter.id,
        localVersion: chapter.updatedAt,
        remoteVersion: remoteDocument.updatedAt,
        provider: context.provider,
        localRevisionId: chapter.sync?.providerRevisionIds?.[context.provider],
        remoteRevisionId: context.remoteRevision,
        localContent,
        remoteContent,
        baseContent,
        mergedContent,
        mergeConflictBlocks: mergeResult.conflictBlocks,
        localUpdatedAt: chapter.updatedAt,
        remoteUpdatedAt: remoteDocument.updatedAt,
        resolutionOptions: ['local', 'remote', 'merge'],
      };

      const chapterUpdate: Chapter = {
        ...chapter,
        title: remoteDocument.title,
        order: remoteDocument.order,
        summary: remoteDocument.body.slice(0, 200),
        sync: buildSyncMetadata(chapter, context.provider, context.remoteRevision, baseContent, {
          lastPulledAt: now,
        }),
      };

      pluginManager.emit('sync:conflict', conflict);
      pluginManager.emit('sync:import:after', {
        chapterId: chapter.id,
        provider: context.provider,
        remoteRevision: context.remoteRevision,
        conflict: true,
      });

      return { chapterUpdate, conflict };
    }

    const chapterUpdate: Chapter = {
      ...chapter,
      title: remoteDocument.title,
      order: remoteDocument.order,
      updatedAt: Math.max(chapter.updatedAt, remoteDocument.updatedAt),
      content: mergedContent,
      summary: docToText(mergedContent).slice(0, 200),
      sync: buildSyncMetadata(chapter, context.provider, context.remoteRevision, mergedContent, {
        lastPulledAt: now,
        lastPushedHash: await hashContent(mergedContent),
      }),
    };

    pluginManager.emit('sync:import:after', {
      chapterId: chapter.id,
      provider: context.provider,
      remoteRevision: context.remoteRevision,
      conflict: false,
    });

    return { chapterUpdate };
  }

  const nextContent = remoteChanged ? remoteContent : localContent;
  const nextSyncedContent = remoteChanged ? remoteContent : baseContent;

  const chapterUpdate: Chapter = {
    ...chapter,
    title: remoteDocument.title,
    order: remoteDocument.order,
    updatedAt: remoteChanged ? remoteDocument.updatedAt : chapter.updatedAt,
    content: nextContent,
    summary: docToText(nextContent).slice(0, 200),
    sync: buildSyncMetadata(chapter, context.provider, context.remoteRevision, nextSyncedContent, {
      lastPulledAt: now,
      lastPushedHash: remoteChanged
        ? await hashContent(nextContent)
        : sanitizeLegacyPushedHash(chapter.sync?.lastPushedHash),
    }),
  };

  pluginManager.emit('sync:import:after', {
    chapterId: chapter.id,
    provider: context.provider,
    remoteRevision: context.remoteRevision,
    conflict: false,
  });

  return { chapterUpdate };
}

export function resolveSyncConflict(
  conflict: ConflictInfo,
  resolution: ConflictResolutionOption
): JSONContent | null {
  if (resolution === 'local') {
    return conflict.localContent;
  }

  if (resolution === 'remote') {
    return conflict.remoteContent;
  }

  return conflict.mergedContent || conflict.localContent;
}
