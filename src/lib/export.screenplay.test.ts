import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Chapter } from '@/types';
import { screenplayJsonToBlocks, screenplayChapterToFountain, screenplayChapterToPdfContent, exportToFountain } from './export';

const { downloadFileMock } = vi.hoisted(() => ({
  downloadFileMock: vi.fn(),
}));

vi.mock('./utils', async () => {
  const actual = await vi.importActual<typeof import('./utils')>('./utils');
  return {
    ...actual,
    downloadFile: downloadFileMock,
  };
});

function readFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), 'src/lib/fixtures/export', name), 'utf8');
}

function readJsonFixture<T>(name: string): T {
  return JSON.parse(readFixture(name)) as T;
}

const screenplayFixture = readJsonFixture<Chapter>('chapter-screenplay.json');
const expectedFountain = readFixture('chapter-screenplay.fountain.txt').trim();
const expectedPdfContent = readJsonFixture<ReturnType<typeof screenplayChapterToPdfContent>>('chapter-screenplay.pdf-content.json');


function createChapter(id: string, title: string, paragraphs: Array<{ screenplayType?: string; text: string }>): Chapter {
  // Convert screenplay-typed paragraphs to Fountain Markdown
  const lines: string[] = [];
  for (const p of paragraphs) {
    switch (p.screenplayType) {
      case 'scene-heading': {
        if (lines.length > 0) lines.push('');
        const heading = p.text.toUpperCase();
        lines.push(/^(INT|EXT|EST|I\/E)\.?\s/i.test(heading) ? heading : `.${heading}`);
        break;
      }
      case 'character':
        if (lines.length > 0) lines.push('');
        lines.push(p.text.toUpperCase());
        break;
      case 'parenthetical':
        lines.push(p.text.startsWith('(') ? p.text : `(${p.text})`);
        break;
      case 'dialogue':
        lines.push(p.text);
        break;
      case 'transition': {
        if (lines.length > 0) lines.push('');
        const t = p.text.toUpperCase();
        lines.push(t.endsWith('TO:') ? t : `>${t}`);
        break;
      }
      case 'action':
        if (lines.length > 0) lines.push('');
        lines.push(p.text);
        break;
      default:
        if (lines.length > 0) lines.push('');
        lines.push(p.text);
        break;
    }
  }
  return {
    ...screenplayFixture,
    id,
    title,
    content: lines.join('\n'),
  };
}

describe('screenplay export helpers', () => {
  beforeEach(() => {
    downloadFileMock.mockReset();
  });

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
    expect(screenplayChapterToFountain(screenplayFixture)).toBe(expectedFountain);
  });

  it('keeps character and dialogue grouped, spaces transitions, and marks non-standard scene headings', () => {
    const chapter = createChapter('chapter-2', 'Alt', [
      { screenplayType: 'scene-heading', text: 'Flashback - Beach' },
      { screenplayType: 'action', text: 'Waves crash hard.' },
      { screenplayType: 'character', text: 'Jules' },
      { screenplayType: 'dialogue', text: 'I remember this place.' },
      { screenplayType: 'transition', text: 'smash cut to:' },
      { screenplayType: 'scene-heading', text: 'Ext. Road - Dawn' },
      { screenplayType: 'action', text: 'A bus rounds the corner.' },
    ]);

    expect(screenplayChapterToFountain(chapter, { sceneSeparator: '\n\n***\n\n' })).toBe(
`.FLASHBACK - BEACH

Waves crash hard.

JULES
I remember this place.

SMASH CUT TO:

EXT. ROAD - DAWN

A bus rounds the corner.`
    );
  });

  it('renders PDF content with screenplay-specific styles and indents', () => {
    expect(screenplayChapterToPdfContent(screenplayFixture)).toEqual(expectedPdfContent);
  });

  it('exports multi-chapter Fountain output with metadata and section titles', async () => {
    const secondChapter = createChapter('chapter-3', 'Second Movement', [
      { screenplayType: 'scene-heading', text: 'Ext. Alley - Night' },
      { screenplayType: 'action', text: 'A cat darts between cans.' },
    ]);

    await exportToFountain([screenplayFixture, secondChapter], 'Project Echo', {
      includeSectionTitles: true,
      includeMetadataBlock: true,
      metadata: {
        credit: 'Written for the screen by',
        author: 'Dev Writer',
        draftDate: '2026-02-14',
        source: 'Story outline v2',
      },
      sectionSeparator: '\n\n===\n\n',
      filenameConvention: 'title-screenplay',
    });

    expect(downloadFileMock).toHaveBeenCalledWith(
      `Title: Project Echo\nCredit: Written for the screen by\nAuthor: Dev Writer\nDraft date: 2026-02-14\nSource: Story outline v2\n\n# Opening\n\nInt. House - Night\n\nRain pounds the windows.\n\n@Sam\n(whispering)\nWe need to leave. Now.\n\n>Cut to:\n\n===\n\n# Second Movement\n\nEXT. ALLEY - NIGHT\n\nA cat darts between cans.`,
      'Project Echo.screenplay.fountain',
      'text/plain;charset=utf-8'
    );
  });

  it('handles empty chapters and exports all content lines', async () => {
    const mixedChapter = createChapter('chapter-4', 'Mixed', [
      { text: 'Plain text line' },
      { screenplayType: 'action', text: 'Only this action exports.' },
      { text: 'Another plain line' },
    ]);

    const emptyChapter = createChapter('chapter-5', 'Empty Chapter', []);

    await exportToFountain([mixedChapter, emptyChapter], 'Noir', {
      includeSectionTitles: true,
      includeMetadataBlock: false,
      sectionSeparator: '\n\n--\n\n',
      filenameConvention: 'title-fountain',
    });

    expect(downloadFileMock).toHaveBeenCalledWith(
      '# Mixed\n\nPlain text line\n\nOnly this action exports.\n\nAnother plain line\n\n--\n\n# Empty Chapter',
      'Noir.fountain-export.fountain',
      'text/plain;charset=utf-8'
    );
  });
});
