import type { JSONContent } from '@tiptap/core';

interface ParsedChapter {
  title: string;
  content: JSONContent;
}

// Regex patterns for chapter detection
const CHAPTER_RE = /^(?:chapter|chap\.?)\s*(\d+|[ivxlcdm]+)[\s:.\-]*/i;
const PART_RE = /^(?:part)\s*(\d+|[ivxlcdm]+)[\s:.\-]*/i;
const FRONT_RE = /^(?:prologue|epilogue|introduction|preface|foreword|afterword)[\s:.\-]*/i;
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

  // All caps short text
  if (ALL_CAPS_RE.test(trimmed) && trimmed.length < 40 && trimmed.length > 2) {
    return true;
  }

  return false;
}

/**
 * Split text into chapters
 */
function splitIntoChapters(lines: string[]): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];
  let currentTitle = 'Chapter 1';
  let currentParagraphs: string[] = [];

  for (const line of lines) {
    if (isChapterHeading(line)) {
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
    } else {
      currentParagraphs.push(line);
    }
  }

  // Don't forget the last chapter
  if (currentParagraphs.some(p => p.trim())) {
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

/**
 * Import DOCX file
 */
export async function importDocx(file: File): Promise<ParsedChapter[]> {
  const JSZip = (await import('jszip')).default;

  const zip = await JSZip.loadAsync(file);
  const docXml = await zip.file('word/document.xml')?.async('string');

  if (!docXml) {
    throw new Error('Invalid DOCX file');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(docXml, 'application/xml');

  const paragraphs: string[] = [];
  const pElements = doc.getElementsByTagName('w:p');

  for (let i = 0; i < pElements.length; i++) {
    const p = pElements[i];
    const texts: string[] = [];

    // Get all text elements
    const textElements = p.getElementsByTagName('w:t');
    for (let j = 0; j < textElements.length; j++) {
      texts.push(textElements[j].textContent || '');
    }

    paragraphs.push(texts.join(''));
  }

  return splitIntoChapters(paragraphs);
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
  return splitIntoChapters(lines);
}

/**
 * Import plain text file
 */
export async function importText(file: File): Promise<ParsedChapter[]> {
  const text = await file.text();
  const lines = text.split('\n');
  return splitIntoChapters(lines);
}

/**
 * Import file based on extension
 */
export async function importFile(file: File): Promise<ParsedChapter[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'docx':
      return importDocx(file);
    case 'rtf':
      return importRtf(file);
    case 'txt':
      return importText(file);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}
