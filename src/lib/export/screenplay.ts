import type { Chapter, ScreenplayBlockType } from '@/types';
import type { PdfContentNode } from './types';
import { markdownToScreenplayBlocks } from '@/lib/editor/markdownParser';

export interface ScreenplayBlock {
  type: ScreenplayBlockType;
  text: string;
}

export interface ScreenplayFountainOptions {
  sceneSeparator?: string;
}

export function screenplayMarkdownToBlocks(content: string | null): ScreenplayBlock[] {
  return markdownToScreenplayBlocks(content);
}

/** @deprecated Use screenplayMarkdownToBlocks instead */
export const screenplayJsonToBlocks = screenplayMarkdownToBlocks;

function normalizeScreenplayText(block: ScreenplayBlock): string {
  if (block.type === 'scene-heading' || block.type === 'character' || block.type === 'transition') {
    return block.text.toUpperCase();
  }

  return block.text;
}

/**
 * Convert a screenplay chapter to Fountain text.
 * Since chapter content is already stored as Fountain/Markdown,
 * this returns the content directly with minimal cleanup.
 */
export function screenplayChapterToFountain(chapter: Chapter, _options?: ScreenplayFountainOptions): string {
  if (!chapter.content) return '';

  // Content is already Fountain-formatted Markdown; return with whitespace cleanup
  return chapter.content.replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function screenplayChapterToPdfContent(chapter: Chapter): PdfContentNode[] {
  return screenplayMarkdownToBlocks(chapter.content).map(block => {
    const normalized = normalizeScreenplayText(block);

    switch (block.type) {
      case 'scene-heading':
        return { text: normalized, style: 'sceneHeading', margin: [0, 12, 0, 6] };
      case 'character':
        return { text: normalized, style: 'character', margin: [170, 10, 0, 0] };
      case 'parenthetical':
        return { text: normalized, style: 'parenthetical', margin: [140, 0, 120, 0] };
      case 'dialogue':
        return { text: normalized, style: 'dialogue', margin: [110, 0, 110, 4] };
      case 'transition':
        return { text: normalized, style: 'transition', margin: [0, 10, 0, 6], alignment: 'right' };
      default:
        return { text: normalized, style: 'action', margin: [0, 0, 0, 8] };
    }
  });
}
