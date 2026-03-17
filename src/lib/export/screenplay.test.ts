import { describe, expect, it } from 'vitest';
import {
  screenplayMarkdownToBlocks,
  screenplayChapterToFountain,
  screenplayChapterToPdfContent,
} from './screenplay';
import type { Chapter } from '@/types';

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'ch-1',
    novelId: 'novel-1',
    order: 0,
    title: 'Test Scene',
    updatedAt: Date.now(),
    content: null,
    summary: '',
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 0,
    scenes: [],
    ...overrides,
  };
}

describe('screenplayMarkdownToBlocks', () => {
  it('returns empty array for null content', () => {
    expect(screenplayMarkdownToBlocks(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(screenplayMarkdownToBlocks('')).toEqual([]);
  });

  it('parses a scene heading', () => {
    const blocks = screenplayMarkdownToBlocks('INT. OFFICE - DAY');
    expect(blocks).toEqual([{ type: 'scene-heading', text: 'INT. OFFICE - DAY' }]);
  });

  it('parses EXT scene heading', () => {
    const blocks = screenplayMarkdownToBlocks('EXT. PARK - NIGHT');
    expect(blocks).toEqual([{ type: 'scene-heading', text: 'EXT. PARK - NIGHT' }]);
  });

  it('parses a forced scene heading with dot prefix', () => {
    const blocks = screenplayMarkdownToBlocks('.FLASHBACK');
    expect(blocks).toEqual([{ type: 'scene-heading', text: 'FLASHBACK' }]);
  });

  it('parses a transition ending with TO:', () => {
    const blocks = screenplayMarkdownToBlocks('CUT TO:');
    expect(blocks).toEqual([{ type: 'transition', text: 'CUT TO:' }]);
  });

  it('parses a forced transition with > prefix', () => {
    const blocks = screenplayMarkdownToBlocks('>FADE OUT.');
    expect(blocks).toEqual([{ type: 'transition', text: 'FADE OUT.' }]);
  });

  it('parses a parenthetical', () => {
    const blocks = screenplayMarkdownToBlocks('(whispering)');
    expect(blocks).toEqual([{ type: 'parenthetical', text: '(whispering)' }]);
  });

  it('parses a forced character with @ prefix', () => {
    const blocks = screenplayMarkdownToBlocks('@McCOY');
    expect(blocks).toEqual([{ type: 'character', text: 'McCOY' }]);
  });

  it('parses action as default block type', () => {
    const blocks = screenplayMarkdownToBlocks('The door swings open.');
    expect(blocks).toEqual([{ type: 'action', text: 'The door swings open.' }]);
  });

  it('parses a complete scene with multiple block types', () => {
    const fountain = [
      'INT. COFFEE SHOP - DAY',
      '',
      'JANE',
      'Hello there.',
      '',
      'CUT TO:',
    ].join('\n');

    const blocks = screenplayMarkdownToBlocks(fountain);
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toEqual({ type: 'scene-heading', text: 'INT. COFFEE SHOP - DAY' });
    expect(blocks[1]).toEqual({ type: 'character', text: 'JANE' });
    expect(blocks[2]).toEqual({ type: 'dialogue', text: 'Hello there.' });
    expect(blocks[3]).toEqual({ type: 'transition', text: 'CUT TO:' });
  });

  it('parses character followed by parenthetical and dialogue', () => {
    const fountain = [
      '',
      'BOB',
      '(sarcastically)',
      'Sure thing, boss.',
    ].join('\n');

    const blocks = screenplayMarkdownToBlocks(fountain);
    expect(blocks[0]).toEqual({ type: 'character', text: 'BOB' });
    expect(blocks[1]).toEqual({ type: 'parenthetical', text: '(sarcastically)' });
    expect(blocks[2]).toEqual({ type: 'dialogue', text: 'Sure thing, boss.' });
  });
});

describe('screenplayChapterToFountain', () => {
  it('returns empty string for null content', () => {
    const chapter = makeChapter({ content: null });
    expect(screenplayChapterToFountain(chapter)).toBe('');
  });

  it('returns empty string for empty content', () => {
    const chapter = makeChapter({ content: '' });
    expect(screenplayChapterToFountain(chapter)).toBe('');
  });

  it('returns cleaned content with leading newlines removed', () => {
    const chapter = makeChapter({ content: '\n\nINT. ROOM - NIGHT\n\nAction line.' });
    const result = screenplayChapterToFountain(chapter);
    expect(result).toBe('INT. ROOM - NIGHT\n\nAction line.');
  });

  it('collapses triple newlines to double', () => {
    const chapter = makeChapter({ content: 'INT. ROOM - DAY\n\n\n\nJANE\nHello.' });
    const result = screenplayChapterToFountain(chapter);
    expect(result).toBe('INT. ROOM - DAY\n\nJANE\nHello.');
  });

  it('trims trailing whitespace', () => {
    const chapter = makeChapter({ content: 'INT. ROOM - DAY\n\n  ' });
    const result = screenplayChapterToFountain(chapter);
    expect(result).toBe('INT. ROOM - DAY');
  });

  it('returns simple content as-is when already clean', () => {
    const chapter = makeChapter({ content: 'EXT. PARK - NIGHT' });
    expect(screenplayChapterToFountain(chapter)).toBe('EXT. PARK - NIGHT');
  });
});

describe('screenplayChapterToPdfContent', () => {
  it('returns empty array for null content', () => {
    const chapter = makeChapter({ content: null });
    expect(screenplayChapterToPdfContent(chapter)).toEqual([]);
  });

  it('returns scene heading with correct style and margin', () => {
    const chapter = makeChapter({ content: 'INT. OFFICE - DAY' });
    const nodes = screenplayChapterToPdfContent(chapter);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].style).toBe('sceneHeading');
    expect(nodes[0].text).toBe('INT. OFFICE - DAY');
    expect(nodes[0].margin).toEqual([0, 12, 0, 6]);
  });

  it('uppercases scene heading text', () => {
    const chapter = makeChapter({ content: 'INT. office - day' });
    const nodes = screenplayChapterToPdfContent(chapter);
    expect(nodes[0].text).toBe('INT. OFFICE - DAY');
  });

  it('returns action with correct style', () => {
    const chapter = makeChapter({ content: 'The door opens slowly.' });
    const nodes = screenplayChapterToPdfContent(chapter);
    expect(nodes[0].style).toBe('action');
    expect(nodes[0].margin).toEqual([0, 0, 0, 8]);
  });

  it('returns transition with right alignment', () => {
    const chapter = makeChapter({ content: 'CUT TO:' });
    const nodes = screenplayChapterToPdfContent(chapter);
    expect(nodes[0].style).toBe('transition');
    expect(nodes[0].alignment).toBe('right');
    expect(nodes[0].text).toBe('CUT TO:');
    expect(nodes[0].margin).toEqual([0, 10, 0, 6]);
  });

  it('returns character with correct margin', () => {
    const chapter = makeChapter({ content: '@JANE' });
    const nodes = screenplayChapterToPdfContent(chapter);
    expect(nodes[0].style).toBe('character');
    expect(nodes[0].text).toBe('JANE');
    expect(nodes[0].margin).toEqual([170, 10, 0, 0]);
  });

  it('returns parenthetical with correct margin', () => {
    const chapter = makeChapter({
      content: '@BOB\n(quietly)',
    });
    const nodes = screenplayChapterToPdfContent(chapter);
    const paren = nodes.find(n => n.style === 'parenthetical');
    expect(paren).toBeDefined();
    expect(paren!.text).toBe('(quietly)');
    expect(paren!.margin).toEqual([140, 0, 120, 0]);
  });

  it('returns dialogue with correct margin', () => {
    const chapter = makeChapter({
      content: '@BOB\nHello there.',
    });
    const nodes = screenplayChapterToPdfContent(chapter);
    const dialogue = nodes.find(n => n.style === 'dialogue');
    expect(dialogue).toBeDefined();
    expect(dialogue!.text).toBe('Hello there.');
    expect(dialogue!.margin).toEqual([110, 0, 110, 4]);
  });

  it('handles a full scene with multiple block types', () => {
    const chapter = makeChapter({
      content: [
        'INT. COFFEE SHOP - DAY',
        '',
        '@JANE',
        '(smiling)',
        'Good morning!',
        '',
        'CUT TO:',
      ].join('\n'),
    });

    const nodes = screenplayChapterToPdfContent(chapter);
    const styles = nodes.map(n => n.style);
    expect(styles).toEqual([
      'sceneHeading',
      'character',
      'parenthetical',
      'dialogue',
      'transition',
    ]);
  });
});
