import { describe, expect, it } from 'vitest';
import type { Chapter } from '@/types';
import { screenplayJsonToBlocks, screenplayChapterToFountain, screenplayChapterToPdfContent } from './export';

const screenplayFixture: Chapter = {
  id: 'chapter-1',
  novelId: 'novel-1',
  order: 1,
  title: 'Opening',
  updatedAt: Date.now(),
  summary: '',
  pov: '',
  status: 'draft',
  tags: [],
  wordGoal: 0,
  scenes: [],
  content: {
    type: 'doc',
    content: [
      { type: 'paragraph', attrs: { screenplayType: 'scene-heading' }, content: [{ type: 'text', text: 'Int. House - Night' }] },
      { type: 'paragraph', attrs: { screenplayType: 'action' }, content: [{ type: 'text', text: 'Rain pounds the windows.' }] },
      { type: 'paragraph', attrs: { screenplayType: 'character' }, content: [{ type: 'text', text: 'Sam' }] },
      { type: 'paragraph', attrs: { screenplayType: 'parenthetical' }, content: [{ type: 'text', text: '(whispering)' }] },
      { type: 'paragraph', attrs: { screenplayType: 'dialogue' }, content: [{ type: 'text', text: 'We need to leave. Now.' }] },
      { type: 'paragraph', attrs: { screenplayType: 'transition' }, content: [{ type: 'text', text: 'Cut to:' }] },
    ],
  },
};

describe('screenplay export helpers', () => {
  it('maps screenplay JSON into typed blocks', () => {
    expect(screenplayJsonToBlocks(screenplayFixture.content)).toEqual([
      { type: 'scene-heading', text: 'Int. House - Night' },
      { type: 'action', text: 'Rain pounds the windows.' },
      { type: 'character', text: 'Sam' },
      { type: 'parenthetical', text: '(whispering)' },
      { type: 'dialogue', text: 'We need to leave. Now.' },
      { type: 'transition', text: 'Cut to:' },
    ]);
  });

  it('renders Fountain output with screenplay spacing conventions', () => {
    expect(screenplayChapterToFountain(screenplayFixture)).toBe(
`INT. HOUSE - NIGHT

Rain pounds the windows.

SAM
(whispering)
We need to leave. Now.
CUT TO:`
    );
  });

  it('renders PDF content with screenplay-specific styles and indents', () => {
    expect(screenplayChapterToPdfContent(screenplayFixture)).toEqual([
      { text: 'INT. HOUSE - NIGHT', style: 'sceneHeading', margin: [0, 12, 0, 6] },
      { text: 'Rain pounds the windows.', style: 'action', margin: [0, 0, 0, 8] },
      { text: 'SAM', style: 'character', margin: [170, 10, 0, 0] },
      { text: '(whispering)', style: 'parenthetical', margin: [140, 0, 120, 0] },
      { text: 'We need to leave. Now.', style: 'dialogue', margin: [110, 0, 110, 4] },
      { text: 'CUT TO:', style: 'transition', margin: [0, 10, 0, 6], alignment: 'right' },
    ]);
  });
});
