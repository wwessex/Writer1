import type { JSONContent } from '@tiptap/core';
import { pluginManager } from '@/lib/plugins';
import type { Chapter, ChapterSyncMetadata, ConflictInfo, ConflictResolutionOption, IntegrationType } from '@/types';
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

const SHA256_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

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

function docToText(doc: JSONContent | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) {
    return '';
  }

  return doc.content
    .map((node) => {
      if (typeof node.text === 'string') {
        return node.text;
      }

      if (Array.isArray(node.content)) {
        return node.content
          .map((child) => (typeof child.text === 'string' ? child.text : ''))
          .join('');
      }

      return '';
    })
    .join('\n')
    .trim();
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

function mergeDocs(local: JSONContent | null, remote: JSONContent): JSONContent {
  const localDoc = ensureDoc(local);
  const remoteDoc = ensureDoc(remote);

  return {
    type: 'doc',
    content: [...(localDoc.content || []), ...(remoteDoc.content || [])],
  };
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
    const mergedContent = mergeDocs(localContent, remoteContent);
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
