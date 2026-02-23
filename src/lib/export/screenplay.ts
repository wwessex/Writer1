import type { JSONContent } from '@tiptap/core';
import type { Chapter, ScreenplayBlockType } from '@/types';
import { extractTextFromNode } from './shared';

export interface ScreenplayBlock {
  type: ScreenplayBlockType;
  text: string;
}

export interface ScreenplayFountainOptions {
  sceneSeparator?: string;
}

function isScreenplayBlockType(value: string | null | undefined): value is ScreenplayBlockType {
  return value === 'scene-heading'
    || value === 'action'
    || value === 'character'
    || value === 'parenthetical'
    || value === 'dialogue'
    || value === 'transition';
}

export function screenplayJsonToBlocks(content: JSONContent | null): ScreenplayBlock[] {
  if (!content?.content?.length) {
    return [];
  }

  const blocks: ScreenplayBlock[] = [];

  for (const node of content.content) {
    if (node.type !== 'paragraph') continue;
    const screenplayType = node.attrs?.screenplayType;
    if (!isScreenplayBlockType(typeof screenplayType === 'string' ? screenplayType : null)) continue;

    const text = extractTextFromNode(node).trim();
    if (!text) continue;
    blocks.push({ type: screenplayType, text });
  }

  return blocks;
}

function normalizeScreenplayText(block: ScreenplayBlock): string {
  if (block.type === 'scene-heading' || block.type === 'character' || block.type === 'transition') {
    return block.text.toUpperCase();
  }

  return block.text;
}

function formatSceneHeadingForFountain(text: string): string {
  const normalized = text.toUpperCase();
  const isStandardSceneHeading = /^(INT|EXT|EST|INT\/EXT|I\/E)\.?\s/.test(normalized);
  return isStandardSceneHeading ? normalized : `.${normalized}`;
}

export function screenplayChapterToFountain(chapter: Chapter, options: ScreenplayFountainOptions = {}): string {
  const sceneSeparator = options.sceneSeparator ?? '\n\n';
  const chunks: string[] = [];
  let hasScene = false;

  const pushBlock = (text: string, withLeadingSpacer = false) => {
    if (!text) return;
    if (withLeadingSpacer && chunks.length > 0 && chunks[chunks.length - 1] !== '') chunks.push('');
    chunks.push(text);
  };

  for (const block of screenplayJsonToBlocks(chapter.content)) {
    const normalized = normalizeScreenplayText(block);

    switch (block.type) {
      case 'scene-heading': {
        if (hasScene && sceneSeparator) {
          const separatorLines = sceneSeparator.split('\n');
          chunks.push(...separatorLines);
        }
        pushBlock(formatSceneHeadingForFountain(normalized), !hasScene);
        hasScene = true;
        break;
      }
      case 'action':
      case 'transition':
        pushBlock(normalized, true);
        break;
      default:
        pushBlock(normalized, false);
        break;
    }
  }

  return chunks.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function screenplayChapterToPdfContent(chapter: Chapter): Array<Record<string, unknown>> {
  return screenplayJsonToBlocks(chapter.content).map(block => {
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
