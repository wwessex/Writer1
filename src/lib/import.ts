import type { JSONContent } from '@tiptap/core';
import type { ProjectType, ScreenplayBlockType } from '@/types';

interface ParsedChapter {
  title: string;
  content: JSONContent;
  metadata?: {
    sourceFormat: 'docx' | 'rtf' | 'txt' | 'fountain';
    originalTitle?: string;
    sourceLineStart?: number;
    sourceLineEnd?: number;
  };
}

export interface ImportNotice {
  message: string;
  line?: number;
}

export interface ImportResult {
  sections: ParsedChapter[];
  notices: ImportNotice[];
}

// Regex patterns for chapter detection
const CHAPTER_RE = /^(?:chapter|chap\.?)\s*(\d+|[ivxlcdm]+)[\s:.-]*/i;
const PART_RE = /^(?:part)\s*(\d+|[ivxlcdm]+)[\s:.-]*/i;
const FRONT_RE = /^(?:prologue|epilogue|introduction|preface|foreword|afterword)[\s:.-]*/i;
const NAMED_SECTION_RE = /^(?:interlude|intermission|author'?s?\s*note|coda|postscript|addendum|appendix|digest|entr'?acte)[\s:.-]*/i;
const ALL_CAPS_RE = /^[A-Z\s\d]+$/;

/**
 * Convert paragraphs to Tiptap JSON document
 */
function paragraphsToDoc(paragraphs: string[]): JSONContent {
  return {
    type: 'doc',
    content: paragraphs.map(text => ({
      type: 'paragraph',
      content: text.trim() ? [{ type: 'text', text: text.trim() }] : []
    }))
  };
}

/**
 * Detect if a line is a chapter heading
 */
function isChapterHeading(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 80) return false;

  // Check known patterns
  if (CHAPTER_RE.test(trimmed)) return true;
  if (PART_RE.test(trimmed)) return true;
  if (FRONT_RE.test(trimmed)) return true;
  if (NAMED_SECTION_RE.test(trimmed)) return true;

  // All caps short text
  if (ALL_CAPS_RE.test(trimmed) && trimmed.length < 40 && trimmed.length > 2) {
    return true;
  }

  return false;
}

/**
 * Check if a line looks like a standalone chapter title based on surrounding
 * context. Only used when the document already has recognised numbered chapters,
 * so that short standalone lines between chapters (e.g. "The Evidence") are
 * treated as chapter breaks rather than being merged into the preceding chapter.
 */
function isContextualHeading(lines: string[], index: number): boolean {
  const trimmed = lines[index].trim();

  // Must have text, be short, and not be overly brief (single char)
  if (!trimmed || trimmed.length > 60 || trimmed.length < 2) return false;

  // Must start with an uppercase letter
  if (!/^[A-Z]/.test(trimmed)) return false;

  // Must NOT end with sentence-ending punctuation
  if (/[.!?,;:]$/.test(trimmed)) return false;

  // Must NOT look like dialogue (contains quotation marks)
  if (/["'\u201C\u201D\u2018\u2019]/.test(trimmed)) return false;

  // Should be title-length — at most 6 words
  if (trimmed.split(/\s+/).length > 6) return false;

  // Must be preceded by a blank line (or be at the start of the document)
  if (index > 0 && lines[index - 1].trim() !== '') return false;

  // Prefer standalone title lines, but allow body text to start immediately
  // after the heading. This covers documents where headings are separated only
  // above (e.g. "\nThe Evidence\nThe room was silent...").
  if (index < lines.length - 1 && lines[index + 1].trim() !== '') {
    const next = lines[index + 1].trim();

    // If the next line itself looks like another heading, this line is likely
    // a paragraph and should not force a split.
    if (isChapterHeading(next)) return false;

    // If the next line is title-like as well, avoid splitting on both.
    if (/^[A-Z]/.test(next) && !/[.!?,;:]$/.test(next) && next.split(/\s+/).length <= 6) {
      return false;
    }
  }

  return true;
}

/**
 * Split text into chapters.
 *
 * @param lines        The lines of text to split.
 * @param forceHeadingAt  Optional set of line indices that are known to be
 *                        headings from the source format (e.g. DOCX heading
 *                        styles). These are always treated as chapter breaks.
 */
function splitIntoChapters(lines: string[], forceHeadingAt?: Set<number>): ParsedChapter[] {
  // Pre-scan: does the document contain any recognised numbered chapter headings?
  // If so, enable contextual heading detection for non-standard titles.
  const hasNumberedChapters = lines.some(line => CHAPTER_RE.test(line.trim()));

  const chapters: ParsedChapter[] = [];
  let currentTitle = 'Chapter 1';
  let currentParagraphs: string[] = [];
  let currentStartedByHeading = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isForced = forceHeadingAt?.has(i) && line.trim().length > 0;
    const isHeading = isForced
      || isChapterHeading(line)
      || (hasNumberedChapters && isContextualHeading(lines, i));

    if (isHeading) {
      // Save current chapter if it has content
      if (currentParagraphs.some(p => p.trim())) {
        chapters.push({
          title: currentTitle,
          content: paragraphsToDoc(currentParagraphs)
        });
      }
      // Start new chapter
      currentTitle = line.trim();
      currentParagraphs = [];
      currentStartedByHeading = true;
    } else {
      currentParagraphs.push(line);
    }
  }

  // Don't forget the last chapter — also push headings that had no body content
  // (e.g. "The End" at the very end of a document)
  if (currentParagraphs.some(p => p.trim()) || currentStartedByHeading) {
    chapters.push({
      title: currentTitle,
      content: paragraphsToDoc(currentParagraphs)
    });
  }

  // If no chapters detected, create one with all content
  if (chapters.length === 0 && lines.some(l => l.trim())) {
    chapters.push({
      title: 'Chapter 1',
      content: paragraphsToDoc(lines)
    });
  }

  return chapters;
}

function screenplayBlocksToDoc(blocks: Array<{ type: ScreenplayBlockType; text: string }>): JSONContent {
  return {
    type: 'doc',
    content: blocks.map(block => ({
      type: 'paragraph',
      attrs: {
        screenplayType: block.type
      },
      content: block.text.trim() ? [{ type: 'text', text: block.text.trim() }] : []
    }))
  };
}

function isSceneHeading(line: string): boolean {
  const normalized = line.trim().toUpperCase();
  return /^\.?\s*(INT\.|EXT\.|EST\.|INT\/EXT\.|I\/E\.)/.test(normalized);
}

function isTransition(line: string): boolean {
  const normalized = line.trim().toUpperCase();
  return normalized.endsWith(' TO:') || normalized.endsWith('TO:') || normalized.startsWith('>');
}

function isCharacterCue(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (isSceneHeading(trimmed) || isTransition(trimmed)) return false;
  return /^[A-Z0-9 '.\-()]+$/.test(trimmed) && /[A-Z]/.test(trimmed);
}

function normalizeFountainCue(line: string): string {
  return line.trim().replace(/^@/, '');
}

function parseFountain(text: string): ImportResult {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const sections: ParsedChapter[] = [];
  const notices: ImportNotice[] = [];

  let currentTitle = 'Scene 1';
  let currentBlocks: Array<{ type: ScreenplayBlockType; text: string }> = [];
  let sceneStartLine = 1;
  let sceneCounter = 1;
  let pendingDialogue = false;

  const flushSection = (endLine: number) => {
    if (currentBlocks.length === 0) return;
    sections.push({
      title: currentTitle,
      content: screenplayBlocksToDoc(currentBlocks),
      metadata: {
        sourceFormat: 'fountain',
        originalTitle: currentTitle,
        sourceLineStart: sceneStartLine,
        sourceLineEnd: endLine
      }
    });
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    const lineNumber = index + 1;

    if (!trimmed) {
      pendingDialogue = false;
      continue;
    }

    if (trimmed.startsWith('/*') || trimmed.startsWith('*/')) {
      notices.push({ message: 'Boneyard comments are imported as action text.', line: lineNumber });
      currentBlocks.push({ type: 'action', text: trimmed.replace(/\/\*|\*\//g, '').trim() });
      continue;
    }

    if (trimmed.startsWith('#')) {
      notices.push({ message: 'Section headings are not fully supported and were imported as action text.', line: lineNumber });
      currentBlocks.push({ type: 'action', text: trimmed.replace(/^#+\s*/, '') });
      continue;
    }

    if (trimmed.startsWith('=')) {
      notices.push({ message: 'Synopses are imported as action text.', line: lineNumber });
      currentBlocks.push({ type: 'action', text: trimmed.replace(/^=\s*/, '') });
      continue;
    }

    if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
      notices.push({ message: 'Inline notes are imported as action text.', line: lineNumber });
      currentBlocks.push({ type: 'action', text: `NOTE: ${trimmed.slice(2, -2).trim()}` });
      continue;
    }

    if (isSceneHeading(trimmed)) {
      flushSection(lineNumber - 1);
      currentTitle = trimmed.startsWith('.') ? trimmed.slice(1).trim() : trimmed;
      currentBlocks = [{ type: 'scene-heading', text: currentTitle }];
      sceneStartLine = lineNumber;
      sceneCounter += 1;
      pendingDialogue = false;
      continue;
    }

    if (isTransition(trimmed)) {
      currentBlocks.push({ type: 'transition', text: trimmed.replace(/^>\s*/, '') });
      pendingDialogue = false;
      continue;
    }

    if (isCharacterCue(trimmed) || trimmed.startsWith('@')) {
      currentBlocks.push({ type: 'character', text: normalizeFountainCue(trimmed) });
      pendingDialogue = true;
      continue;
    }

    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      currentBlocks.push({ type: pendingDialogue ? 'parenthetical' : 'action', text: trimmed });
      continue;
    }

    if (pendingDialogue) {
      currentBlocks.push({ type: 'dialogue', text: trimmed });
    } else {
      currentBlocks.push({ type: 'action', text: trimmed });
    }
  }

  flushSection(lines.length);

  if (sections.length === 0 && currentBlocks.length === 0 && lines.some(line => line.trim())) {
    sections.push({
      title: `Scene ${sceneCounter}`,
      content: screenplayBlocksToDoc([{ type: 'action', text: text.trim() }]),
      metadata: { sourceFormat: 'fountain', sourceLineStart: 1, sourceLineEnd: lines.length }
    });
  }

  if (sections.length === 0 && lines.every(line => !line.trim())) {
    return { sections: [], notices };
  }

  return {
    sections: sections.map((section, index) => ({
      ...section,
      title: section.title || `Scene ${index + 1}`
    })),
    notices
  };
}

/**
 * Import DOCX file
 */
export async function importDocx(file: File): Promise<ParsedChapter[]> {
  const JSZip = (await import('jszip')).default;

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentFile = zip.file('word/document.xml') ?? zip.file(/^word\/document\d*\.xml$/i)?.[0];
  const docXml = await documentFile?.async('string');

  if (!docXml) {
    throw new Error('Invalid DOCX file');
  }

  const paragraphs: string[] = [];
  const headingIndices = new Set<number>();

  const paragraphMatches = docXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
  for (const paragraphXml of paragraphMatches) {
    const texts = Array.from(paragraphXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g), match =>
      match[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
    );

    const styleMatch = paragraphXml.match(/<w:pStyle\b[^>]*w:val=(?:"([^"]+)"|'([^']+)')/i);
    const styleVal = styleMatch?.[1] || styleMatch?.[2] || '';
    if (/^(?:heading|title)/i.test(styleVal)) {
      headingIndices.add(paragraphs.length);
    }

    paragraphs.push(texts.join(''));
  }

  return splitIntoChapters(paragraphs, headingIndices.size > 0 ? headingIndices : undefined).map(section => ({
    ...section,
    metadata: { sourceFormat: 'docx', originalTitle: section.title }
  }));
}

/**
 * Parse RTF content to plain text
 */
function parseRtf(rtf: string): string[] {
  // Simple RTF parser - handles basic RTF structure
  let text = rtf;

  // Remove RTF header
  text = text.replace(/^\{\\rtf1[^}]*\}/g, '');

  // Handle common RTF commands
  text = text.replace(/\\par\b/g, '\n');
  text = text.replace(/\\pard\b/g, '');
  text = text.replace(/\\plain\b/g, '');
  text = text.replace(/\\[a-z]+\d*\s?/gi, '');

  // Remove groups
  text = text.replace(/\{[^{}]*\}/g, '');

  // Handle special characters
  text = text.replace(/\\'([0-9a-f]{2})/gi, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // Clean up braces and extra whitespace
  text = text.replace(/[{}]/g, '');
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');

  return text.split('\n');
}

/**
 * Import RTF file
 */
export async function importRtf(file: File): Promise<ParsedChapter[]> {
  const text = await file.text();
  const lines = parseRtf(text);
  return splitIntoChapters(lines).map(section => ({
    ...section,
    metadata: { sourceFormat: 'rtf', originalTitle: section.title }
  }));
}

/**
 * Import plain text file
 */
export async function importText(file: File): Promise<ParsedChapter[]> {
  const text = await file.text();
  const lines = text.split('\n');
  return splitIntoChapters(lines).map(section => ({
    ...section,
    metadata: { sourceFormat: 'txt', originalTitle: section.title }
  }));
}

export async function importFountain(file: File): Promise<ImportResult> {
  const text = await file.text();
  return parseFountain(text);
}

export function mapImportedContentToProjectType(content: JSONContent, projectType: ProjectType): JSONContent {
  const originalNodes = content.content || [];

  if (projectType === 'screenplay') {
    return {
      ...content,
      content: originalNodes.map(node => {
        if (node.type !== 'paragraph') return node;
        const screenplayType = typeof node.attrs?.screenplayType === 'string' ? node.attrs.screenplayType : 'action';
        return {
          ...node,
          attrs: {
            ...node.attrs,
            screenplayType
          }
        };
      })
    };
  }

  return {
    ...content,
    content: originalNodes.map(node => {
      if (node.type !== 'paragraph') return node;
      if (!node.attrs || !('screenplayType' in node.attrs)) return node;
      const attrs = { ...node.attrs };
      delete attrs.screenplayType;
      return {
        ...node,
        attrs: Object.keys(attrs).length > 0 ? attrs : undefined
      };
    })
  };
}

/**
 * Import file based on extension
 */
export async function importFile(file: File): Promise<ImportResult> {
  const ext = file.name.split('.').pop()?.trim().toLowerCase();
  const mime = file.type.toLowerCase();

  switch (ext) {
    case 'docx':
      return { sections: await importDocx(file), notices: [] };
    case 'rtf':
      return { sections: await importRtf(file), notices: [] };
    case 'txt':
      return { sections: await importText(file), notices: [] };
    case 'fountain':
    case 'spmd':
      return importFountain(file);
    default:
      if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return { sections: await importDocx(file), notices: [] };
      }
      if (mime === 'application/rtf' || mime === 'text/rtf') {
        return { sections: await importRtf(file), notices: [] };
      }
      if (mime.startsWith('text/')) {
        return { sections: await importText(file), notices: [] };
      }
      throw new Error(`Unsupported file type: ${ext}`);
  }
}
