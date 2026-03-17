/**
 * Markdown → structured data utilities for export and analysis.
 * Replaces the JSONContent tree-walking functions.
 */

import type { ScreenplayBlockType } from '@/types';

// ── Inline marks ──────────────────────────────────────────

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

// ── Block-level types ─────────────────────────────────────

export interface MarkdownBlock {
  type: 'paragraph' | 'heading' | 'bulletItem' | 'orderedItem' | 'blockquote' | 'codeBlock' | 'horizontalRule' | 'image';
  level?: number; // heading level
  text: string;
  runs: InlineRun[];
}

export interface ScreenplayBlock {
  type: ScreenplayBlockType;
  text: string;
}

// ── Plain-text extraction ─────────────────────────────────

/**
 * Strip Markdown syntax and return plain text.
 */
export function markdownToPlainText(md: string | null): string {
  if (!md) return '';
  // Safety: handle legacy JSONContent objects that haven't been migrated yet
  if (typeof md !== 'string') {
    return '';
  }
  return md
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove links, keep text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove bold/italic markers
    .replace(/(\*\*\*|___)(.*?)\1/g, '$2')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove strikethrough
    .replace(/~~(.*?)~~/g, '$1')
    // Remove inline code
    .replace(/`([^`]*)`/g, '$1')
    // Remove underline HTML
    .replace(/<\/?u>/g, '')
    // Remove heading markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove blockquote markers
    .replace(/^>\s?/gm, '')
    // Remove list markers
    .replace(/^(\s*[-*+]|\s*\d+\.)\s+/gm, '')
    // Remove horizontal rules
    .replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '')
    // Remove code fences
    .replace(/^```[^\n]*$/gm, '')
    // Remove Fountain forced markers
    .replace(/^[.@>]/gm, '')
    // Collapse multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Block parsing ─────────────────────────────────────────

function parseInlineRuns(text: string): InlineRun[] {
  // Simple approach: parse inline marks from a line of text
  const runs: InlineRun[] = [];
  // Regex-based inline parsing
  const tokenPattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~|<u>(.+?)<\/u>|`(.+?)`|([^*~`<]+|[*~`<]))/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match[2]) {
      runs.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      runs.push({ text: match[3], bold: true });
    } else if (match[4]) {
      runs.push({ text: match[4], italic: true });
    } else if (match[5]) {
      runs.push({ text: match[5], strike: true });
    } else if (match[6]) {
      runs.push({ text: match[6], underline: true });
    } else if (match[7]) {
      runs.push({ text: match[7] });
    } else if (match[8]) {
      runs.push({ text: match[8] });
    }
  }

  if (runs.length === 0 && text) {
    runs.push({ text });
  }

  return runs;
}

/**
 * Parse Markdown into structured blocks for DOCX/PDF export.
 */
export function markdownToBlocks(md: string | null): MarkdownBlock[] {
  if (!md) return [];
  const lines = md.split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line → skip
    if (!line.trim()) {
      i++;
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const text = codeLines.join('\n');
      blocks.push({ type: 'codeBlock', text, runs: [{ text }] });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: 'horizontalRule', text: '', runs: [] });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      blocks.push({ type: 'heading', level, text, runs: parseInlineRuns(text) });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ') || line === '>') {
      const text = line.replace(/^>\s?/, '');
      blocks.push({ type: 'blockquote', text, runs: parseInlineRuns(text) });
      i++;
      continue;
    }

    // Bullet list item
    const bulletMatch = line.match(/^\s*[-*+]\s+(.*)/);
    if (bulletMatch) {
      blocks.push({ type: 'bulletItem', text: bulletMatch[1], runs: parseInlineRuns(bulletMatch[1]) });
      i++;
      continue;
    }

    // Ordered list item
    const orderedMatch = line.match(/^\s*(\d+)\.\s+(.*)/);
    if (orderedMatch) {
      blocks.push({ type: 'orderedItem', text: orderedMatch[2], runs: parseInlineRuns(orderedMatch[2]) });
      i++;
      continue;
    }

    // Image
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]*)\)/);
    if (imageMatch) {
      blocks.push({ type: 'image', text: imageMatch[1], runs: [{ text: imageMatch[1] }] });
      i++;
      continue;
    }

    // Normal paragraph
    blocks.push({ type: 'paragraph', text: line, runs: parseInlineRuns(line) });
    i++;
  }

  return blocks;
}

// ── Screenplay / Fountain parsing ─────────────────────────

/**
 * Parse Markdown/Fountain content into screenplay blocks.
 */
export function markdownToScreenplayBlocks(md: string | null): ScreenplayBlock[] {
  if (!md) return [];
  const lines = md.split('\n');
  const blocks: ScreenplayBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Scene heading: starts with INT/EXT/EST/I\/E or forced with '.'
    if (/^(INT|EXT|EST|I\/E)[.\s/]/i.test(trimmed) || (trimmed.startsWith('.') && trimmed.length > 1 && !trimmed.startsWith('..'))) {
      const text = trimmed.startsWith('.') ? trimmed.slice(1) : trimmed;
      blocks.push({ type: 'scene-heading', text });
      continue;
    }

    // Transition: ends with TO: or forced with '>'
    if (trimmed.startsWith('>') && !trimmed.startsWith('> ')) {
      blocks.push({ type: 'transition', text: trimmed.slice(1).trim() });
      continue;
    }
    if (/^[A-Z\s]+TO:$/.test(trimmed)) {
      blocks.push({ type: 'transition', text: trimmed });
      continue;
    }

    // Parenthetical
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      blocks.push({ type: 'parenthetical', text: trimmed });
      continue;
    }

    // Character: forced with '@' or all-caps line preceded by blank
    if (trimmed.startsWith('@')) {
      blocks.push({ type: 'character', text: trimmed.slice(1).trim() });
      continue;
    }
    const prevLine = i > 0 ? lines[i - 1].trim() : '';
    if (prevLine === '' && /^[A-Z][A-Z\s'.\-]{0,40}(\s*\(.*\))?$/.test(trimmed) && trimmed.length > 1) {
      blocks.push({ type: 'character', text: trimmed });
      // Check if next line is parenthetical or dialogue
      continue;
    }

    // If previous block was character or parenthetical, this is dialogue
    const lastBlock = blocks[blocks.length - 1];
    if (lastBlock && (lastBlock.type === 'character' || lastBlock.type === 'parenthetical')) {
      blocks.push({ type: 'dialogue', text: trimmed });
      continue;
    }

    // Default: action
    blocks.push({ type: 'action', text: trimmed });
  }

  return blocks;
}

/**
 * Extract dialogue grouped by speaker from Markdown/Fountain content.
 * Used by voiceFingerprint analysis.
 */
export function extractDialogueBySpeaker(content: string | null): Record<string, string[]> {
  if (!content) return {};
  const blocks = markdownToScreenplayBlocks(content);
  const result: Record<string, string[]> = {};
  let currentSpeaker: string | null = null;

  for (const block of blocks) {
    if (block.type === 'character') {
      currentSpeaker = block.text.replace(/\s*\(.*\)$/, '').trim();
      if (!result[currentSpeaker]) result[currentSpeaker] = [];
    } else if (block.type === 'dialogue' && currentSpeaker) {
      result[currentSpeaker].push(block.text);
    } else if (block.type !== 'parenthetical') {
      currentSpeaker = null;
    }
  }

  // Also try extracting prose dialogue: "SPEAKER: dialogue text"
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^([A-Z][A-Z\s'.\-]{1,40}):\s+(.+)$/);
    if (match) {
      const speaker = match[1].trim();
      if (!result[speaker]) result[speaker] = [];
      result[speaker].push(match[2]);
    }
  }

  return result;
}
