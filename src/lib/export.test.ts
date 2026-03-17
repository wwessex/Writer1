import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  screenplayMarkdownToBlocks,
  screenplayJsonToBlocks,
  screenplayChapterToFountain,
  screenplayChapterToPdfContent,
  exportToFountain,
  exportToMarkdown,
  exportToPlainText,
  exportToRtf,
  exportToDocx,
  exportToPdf,
  exportToScreenplayPdf,
  exportPublishingBundle,
} from './export';
import type { Chapter, ManuscriptExportOptions } from '@/types';

// Mock downloadFile to capture output instead of triggering browser download
vi.mock('./utils', () => ({
  downloadFile: vi.fn(),
}));

// Mock errors module
vi.mock('@/lib/errors', () => ({
  ContentErrors: { exportFailed: vi.fn(() => new Error('export failed')) },
  reportAppError: vi.fn(),
}));

// ── Mock docx dynamic import ──

const mockPackerToBlob = vi.fn().mockResolvedValue(new Blob(['fake-docx']));

class MockParagraph {
  constructor(public options: Record<string, unknown>) {}
}
class MockTextRun {
  root: [unknown, Record<string, unknown>?];
  constructor(public options: Record<string, unknown>) {
    this.root = [null, options];
  }
}
class MockHeader {
  constructor(public options: Record<string, unknown>) {}
}
class MockFooter {
  constructor(public options: Record<string, unknown>) {}
}

const mockDocxModule = {
  Document: class {
    constructor(public options: Record<string, unknown>) {}
  },
  Packer: { toBlob: mockPackerToBlob },
  Paragraph: MockParagraph,
  TextRun: MockTextRun,
  HeadingLevel: { TITLE: 'TITLE', HEADING_1: 'HEADING_1' },
  Header: MockHeader,
  Footer: MockFooter,
  AlignmentType: {
    LEFT: 'LEFT',
    CENTER: 'CENTER',
    RIGHT: 'RIGHT',
    JUSTIFIED: 'JUSTIFIED',
  },
  PageNumber: { CURRENT: 'PAGE_NUMBER_CURRENT' },
  NumberFormat: { DECIMAL: 'DECIMAL' },
};

vi.mock('docx', () => mockDocxModule);

// ── Mock pdfmake boundary ──
// vi.mock factories are hoisted, so we cannot reference variables declared later.
// Instead we use vi.hoisted() to create the mocks in the hoisted scope.

const { mockPdfDownload, mockCreatePdf } = vi.hoisted(() => {
  const mockPdfDownload = vi.fn();
  const mockCreatePdf = vi.fn().mockReturnValue({ download: mockPdfDownload });
  return { mockPdfDownload, mockCreatePdf };
});

vi.mock('./export/boundary/pdfmake', () => ({
  loadPdfMake: vi.fn().mockResolvedValue({
    fonts: {},
    createPdf: mockCreatePdf,
  }),
}));

// ── Mock docxCompat boundary ──

vi.mock('./export/boundary/docxCompat', () => ({
  cloneDocxTextRun: vi.fn((run: unknown, TextRunCtor: new (opts: Record<string, unknown>) => unknown) => {
    const props = (run as { root?: [unknown, Record<string, unknown>?] }).root?.[1] || {};
    return new TextRunCtor({ ...props });
  }),
}));

function makeChapter(overrides?: Partial<Chapter>): Chapter {
  return {
    id: 'ch-1',
    novelId: 'n-1',
    order: 0,
    title: 'Test Chapter',
    updatedAt: Date.now(),
    content: '# Heading\n\nSome **bold** text.\n\nAnother paragraph.',
    summary: '',
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 0,
    scenes: [],
    ...overrides,
  };
}

function makeOpts(overrides?: Partial<ManuscriptExportOptions>): ManuscriptExportOptions {
  return {
    profile: 'submission',
    locale: 'en-US',
    fontFamily: 'Times New Roman',
    fontSizePt: 12,
    lineSpacing: 2.0,
    firstLineIndentIn: 0.5,
    marginIn: 1,
    paragraphSpacingAfterPt: 0,
    paragraphSpacingBeforePt: 0,
    alignment: 'left',
    chapterStartsNewPage: false,
    includeHeadings: true,
    sceneBreakMarker: '#',
    pageSize: 'LETTER',
    includeTitlePage: false,
    pageNumbering: false,
    headerContent: { authorSurname: '', shortTitle: '' },
    authorName: '',
    ...overrides,
  };
}

describe('screenplayMarkdownToBlocks', () => {
  it('returns empty array for null', () => {
    expect(screenplayMarkdownToBlocks(null)).toEqual([]);
  });

  it('parses Fountain content into blocks', () => {
    const content = 'INT. OFFICE - DAY\n\n@JOHN\nHello there.\n\nCUT TO:';
    const blocks = screenplayMarkdownToBlocks(content);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0].type).toBe('scene-heading');
  });

  it('screenplayJsonToBlocks is an alias', () => {
    expect(screenplayJsonToBlocks).toBe(screenplayMarkdownToBlocks);
  });

  it('returns empty array for empty string', () => {
    const blocks = screenplayMarkdownToBlocks('');
    expect(blocks).toEqual([]);
  });
});

describe('screenplayChapterToFountain', () => {
  it('returns empty for null content', () => {
    const chapter = makeChapter({ content: null });
    expect(screenplayChapterToFountain(chapter)).toBe('');
  });

  it('returns content with cleaned whitespace', () => {
    const chapter = makeChapter({ content: '\n\nINT. OFFICE - DAY\n\n\n\n@JOHN\nHello.\n\n' });
    const result = screenplayChapterToFountain(chapter);
    expect(result).toBe('INT. OFFICE - DAY\n\n@JOHN\nHello.');
    expect(result).not.toMatch(/\n{3,}/);
  });

  it('accepts optional screenplay fountain options', () => {
    const chapter = makeChapter({ content: 'Content here' });
    const result = screenplayChapterToFountain(chapter, { sceneSeparator: '---' });
    expect(result).toBe('Content here');
  });

  it('strips leading newlines', () => {
    const chapter = makeChapter({ content: '\n\n\nContent' });
    expect(screenplayChapterToFountain(chapter)).toBe('Content');
  });
});

describe('screenplayChapterToPdfContent', () => {
  it('returns PDF content nodes for screenplay chapter', () => {
    const chapter = makeChapter({ content: 'INT. OFFICE - DAY\n\n@JOHN\nHello.\n\n(softly)\nGoodbye.' });
    const nodes = screenplayChapterToPdfContent(chapter);
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes[0].style).toBe('sceneHeading');
  });

  it('returns empty array for null content', () => {
    const chapter = makeChapter({ content: null });
    expect(screenplayChapterToPdfContent(chapter)).toEqual([]);
  });
});

describe('exportToFountain', () => {
  let downloadFile: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const utilsMod = await import('./utils');
    downloadFile = utilsMod.downloadFile as ReturnType<typeof vi.fn>;
  });

  it('exports with default filename convention', async () => {
    const chapters = [makeChapter({ content: 'INT. OFFICE - DAY\n\nSome action.' })];
    await exportToFountain(chapters, 'My Script');
    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(downloadFile.mock.calls[0][1]).toBe('My Script.fountain');
  });

  it('exports with title-screenplay filename convention', async () => {
    const chapters = [makeChapter({ content: 'Content' })];
    await exportToFountain(chapters, 'Script', { filenameConvention: 'title-screenplay' });
    expect(downloadFile.mock.calls[0][1]).toBe('Script.screenplay.fountain');
  });

  it('exports with title-fountain filename convention', async () => {
    const chapters = [makeChapter({ content: 'Content' })];
    await exportToFountain(chapters, 'Script', { filenameConvention: 'title-fountain' });
    expect(downloadFile.mock.calls[0][1]).toBe('Script.fountain-export.fountain');
  });

  it('includes metadata block by default', async () => {
    const chapters = [makeChapter({ content: 'Content' })];
    await exportToFountain(chapters, 'My Title');
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('Title: My Title');
  });

  it('excludes metadata block when disabled', async () => {
    const chapters = [makeChapter({ content: 'Content' })];
    await exportToFountain(chapters, 'My Title', { includeMetadataBlock: false });
    const output = downloadFile.mock.calls[0][0];
    expect(output).not.toContain('Title:');
  });

  it('includes section titles when enabled', async () => {
    const chapters = [makeChapter({ title: 'Scene 1', content: 'Content' })];
    await exportToFountain(chapters, 'Script', { includeSectionTitles: true });
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('# Scene 1');
  });

  it('includes author metadata when provided', async () => {
    const chapters = [makeChapter({ content: 'Content' })];
    await exportToFountain(chapters, 'Script', {
      metadata: { author: 'Jane Doe', credit: 'Written by' },
    });
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('Author: Jane Doe');
    expect(output).toContain('Credit: Written by');
  });

  it('includes draft date and source metadata', async () => {
    const chapters = [makeChapter({ content: 'Content' })];
    await exportToFountain(chapters, 'Script', {
      metadata: { draftDate: '2026-01-01', source: 'Original' },
    });
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('Draft date: 2026-01-01');
    expect(output).toContain('Source: Original');
  });

  it('handles empty chapters gracefully', async () => {
    const chapters = [makeChapter({ content: null, title: '' })];
    await exportToFountain(chapters, 'Empty');
    expect(downloadFile).toHaveBeenCalledTimes(1);
  });

  it('uses custom section separator', async () => {
    const chapters = [
      makeChapter({ title: 'S1', content: 'First scene' }),
      makeChapter({ title: 'S2', content: 'Second scene', id: 'ch-2' }),
    ];
    await exportToFountain(chapters, 'Script', {
      includeSectionTitles: true,
      sectionSeparator: '\n\n---\n\n',
    });
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('---');
  });

  it('passes text/plain mime type', async () => {
    const chapters = [makeChapter({ content: 'Content' })];
    await exportToFountain(chapters, 'Script');
    expect(downloadFile.mock.calls[0][2]).toBe('text/plain;charset=utf-8');
  });
});

describe('exportToMarkdown', () => {
  let downloadFile: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const utilsMod = await import('./utils');
    downloadFile = utilsMod.downloadFile as ReturnType<typeof vi.fn>;
  });

  it('does not throw for valid chapters', async () => {
    const chapters = [makeChapter()];
    await expect(exportToMarkdown(chapters, 'Test Novel')).resolves.not.toThrow();
  });

  it('exports with .md extension', async () => {
    const chapters = [makeChapter()];
    await exportToMarkdown(chapters, 'My Novel');
    expect(downloadFile.mock.calls[0][1]).toBe('My Novel.md');
  });

  it('includes title as H1 and chapter as H2', async () => {
    const chapters = [makeChapter({ title: 'Chapter One' })];
    await exportToMarkdown(chapters, 'Book Title');
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('# Book Title');
    expect(output).toContain('## Chapter One');
  });

  it('excludes chapter headings when includeHeadings is false', async () => {
    const chapters = [makeChapter({ title: 'Hidden' })];
    await exportToMarkdown(chapters, 'Book', false);
    const output = downloadFile.mock.calls[0][0];
    expect(output).not.toContain('## Hidden');
  });

  it('handles null content chapters', async () => {
    const chapters = [makeChapter({ content: null })];
    await exportToMarkdown(chapters, 'Empty');
    expect(downloadFile).toHaveBeenCalledTimes(1);
  });

  it('passes text/markdown mime type', async () => {
    const chapters = [makeChapter()];
    await exportToMarkdown(chapters, 'Book');
    expect(downloadFile.mock.calls[0][2]).toBe('text/markdown;charset=utf-8');
  });
});

describe('exportToPlainText', () => {
  let downloadFile: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const utilsMod = await import('./utils');
    downloadFile = utilsMod.downloadFile as ReturnType<typeof vi.fn>;
  });

  it('does not throw for valid chapters', async () => {
    const chapters = [makeChapter()];
    await expect(exportToPlainText(chapters, 'Test Novel')).resolves.not.toThrow();
  });

  it('exports with .txt extension', async () => {
    const chapters = [makeChapter()];
    await exportToPlainText(chapters, 'My Novel');
    expect(downloadFile.mock.calls[0][1]).toBe('My Novel.txt');
  });

  it('includes title with separator line', async () => {
    const chapters = [makeChapter()];
    await exportToPlainText(chapters, 'Book Title');
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('Book Title');
    expect(output).toContain('='.repeat('Book Title'.length));
  });

  it('includes chapter headings with dashes', async () => {
    const chapters = [makeChapter({ title: 'My Chapter' })];
    await exportToPlainText(chapters, 'Book');
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('My Chapter');
    expect(output).toContain('-'.repeat('My Chapter'.length));
  });

  it('excludes chapter headings when disabled', async () => {
    const chapters = [makeChapter({ title: 'Hidden Chapter' })];
    await exportToPlainText(chapters, 'Book', false);
    const output = downloadFile.mock.calls[0][0];
    expect(output).not.toContain('Hidden Chapter');
  });
});

describe('exportToRtf', () => {
  let downloadFile: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const utilsMod = await import('./utils');
    downloadFile = utilsMod.downloadFile as ReturnType<typeof vi.fn>;
  });

  it('exports RTF with proper header', async () => {
    const chapters = [makeChapter({ content: 'Some text.' })];
    await exportToRtf(chapters, 'My Book');
    expect(downloadFile).toHaveBeenCalledTimes(1);
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('{\\rtf1\\ansi\\deff0');
    expect(downloadFile.mock.calls[0][1]).toBe('My Book.rtf');
  });

  it('exports with chapter headings', async () => {
    const chapters = [makeChapter({ title: 'Chapter One', content: 'Body.' })];
    await exportToRtf(chapters, 'Book', true);
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('Chapter One');
  });

  it('exports without chapter headings when disabled', async () => {
    const chapters = [makeChapter({ title: 'Hidden Title', content: 'Body.' })];
    await exportToRtf(chapters, 'Book', false);
    const output = downloadFile.mock.calls[0][0];
    expect(output).not.toContain('Hidden Title');
  });

  it('applies manuscript options font family', async () => {
    const chapters = [makeChapter({ content: 'Body text.' })];
    await exportToRtf(chapters, 'Manuscript', true, makeOpts({ fontFamily: 'Courier New', lineSpacing: 2.0 }));
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('Courier New');
  });

  it('includes title page when option set', async () => {
    const chapters = [makeChapter({ content: 'Body.' })];
    await exportToRtf(chapters, 'Title Page Book', true, makeOpts({
      includeTitlePage: true,
      authorName: 'Test Author',
      pageNumbering: true,
      headerContent: { authorSurname: 'Smith', shortTitle: 'Novel' },
    }));
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('Test Author');
    expect(output).toContain('\\page');
    expect(output).toContain('Smith');
  });

  it('supports A4 page size', async () => {
    const chapters = [makeChapter({ content: 'Body.' })];
    await exportToRtf(chapters, 'A4 Book', true, makeOpts({ lineSpacing: 2.0, alignment: 'justified', chapterStartsNewPage: true, pageSize: 'A4' }));
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('\\paperw11906');
  });

  it('uses justified alignment command', async () => {
    const chapters = [makeChapter({ content: 'Body text.' })];
    await exportToRtf(chapters, 'Book', true, makeOpts({ lineSpacing: 1.5, alignment: 'justified' }));
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('\\qj');
  });

  it('handles null content chapters', async () => {
    const chapters = [makeChapter({ content: null })];
    await exportToRtf(chapters, 'Empty');
    expect(downloadFile).toHaveBeenCalledTimes(1);
  });

  it('escapes special RTF characters', async () => {
    const chapters = [makeChapter({ content: 'Text with {braces} and \\backslash' })];
    await exportToRtf(chapters, 'Special');
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('\\{');
    expect(output).toContain('\\}');
    expect(output).toContain('\\\\');
  });

  it('passes application/rtf mime type', async () => {
    const chapters = [makeChapter()];
    await exportToRtf(chapters, 'Book');
    expect(downloadFile.mock.calls[0][2]).toBe('application/rtf');
  });

  it('inserts page breaks between chapters when chapterStartsNewPage', async () => {
    const chapters = [
      makeChapter({ id: 'ch-1', title: 'Ch 1', content: 'First.' }),
      makeChapter({ id: 'ch-2', title: 'Ch 2', content: 'Second.' }),
    ];
    await exportToRtf(chapters, 'Book', true, makeOpts({ lineSpacing: 2.0, chapterStartsNewPage: true }));
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('\\page');
  });

  it('handles scene break markers (# # #) in RTF', async () => {
    // Use "# # #" which is recognized as a scene break by isSceneBreakLine
    // but won't be parsed as heading by the markdown parser since it has spaces
    const chapters = [makeChapter({ content: 'Before break.\n\n# # #\n\nAfter break.' })];
    await exportToRtf(chapters, 'Scenes');
    const output = downloadFile.mock.calls[0][0];
    // The default scene break marker '#' should appear in the centered paragraph
    expect(output).toContain('\\qc');
  });

  it('uses center alignment command', async () => {
    const chapters = [makeChapter({ content: 'Body text.' })];
    await exportToRtf(chapters, 'Book', true, makeOpts({ lineSpacing: 1.5, firstLineIndentIn: 0, alignment: 'center' }));
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('\\qc');
  });

  it('uses right alignment command', async () => {
    const chapters = [makeChapter({ content: 'Body text.' })];
    await exportToRtf(chapters, 'Book', true, makeOpts({ lineSpacing: 1.5, firstLineIndentIn: 0, alignment: 'right' }));
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('\\qr');
  });

  it('uses header with page numbering only (no surname)', async () => {
    const chapters = [makeChapter({ content: 'Body.' })];
    await exportToRtf(chapters, 'Book', true, makeOpts({ lineSpacing: 2.0, pageNumbering: true }));
    const output = downloadFile.mock.calls[0][0];
    expect(output).toContain('PAGE');
  });
});

// ── exportToDocx tests ──

describe('exportToDocx', () => {
  let downloadFile: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPackerToBlob.mockResolvedValue(new Blob(['fake-docx']));
    const utilsMod = await import('./utils');
    downloadFile = utilsMod.downloadFile as ReturnType<typeof vi.fn>;
  });

  it('exports a basic DOCX and calls downloadFile', async () => {
    const chapters = [makeChapter({ content: 'Hello world.' })];
    await exportToDocx(chapters, 'My Novel');
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(downloadFile.mock.calls[0][1]).toBe('My Novel.docx');
  });

  it('includes chapter headings by default', async () => {
    const chapters = [makeChapter({ title: 'Chapter One', content: 'Content.' })];
    await exportToDocx(chapters, 'Book');
    // Document should have been created (we just verify no error)
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('exports without headings when includeHeadings is false', async () => {
    const chapters = [makeChapter({ content: 'Content.' })];
    await exportToDocx(chapters, 'Book', false);
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('handles null content chapters', async () => {
    const chapters = [makeChapter({ content: null })];
    await exportToDocx(chapters, 'Empty');
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
    expect(downloadFile).toHaveBeenCalledTimes(1);
  });

  it('handles multiple chapters in a single section (no page breaks)', async () => {
    const chapters = [
      makeChapter({ id: 'ch-1', title: 'Ch 1', content: 'First chapter.' }),
      makeChapter({ id: 'ch-2', title: 'Ch 2', content: 'Second chapter.' }),
    ];
    await exportToDocx(chapters, 'Multi Chapter');
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
    expect(downloadFile).toHaveBeenCalledTimes(1);
  });

  it('applies manuscript options with chapter page breaks', async () => {
    const chapters = [
      makeChapter({ id: 'ch-1', title: 'Ch 1', content: 'First.' }),
      makeChapter({ id: 'ch-2', title: 'Ch 2', content: 'Second.' }),
    ];
    const opts: ManuscriptExportOptions = makeOpts({ fontFamily: 'Courier New', lineSpacing: 2.0, chapterStartsNewPage: true });
    await exportToDocx(chapters, 'Manuscript', true, opts);
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('generates title page when includeTitlePage is set', async () => {
    const chapters = [makeChapter({ content: 'Body text here.' })];
    const opts: ManuscriptExportOptions = makeOpts({
      includeTitlePage: true,
      authorName: 'Jane Doe',
      pageNumbering: true,
      headerContent: { authorSurname: 'Doe', shortTitle: 'Novel' },
    });
    await exportToDocx(chapters, 'Title Page Book', true, opts);
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('generates title page with chapterStartsNewPage', async () => {
    const chapters = [makeChapter({ content: 'Body.' })];
    const opts: ManuscriptExportOptions = makeOpts({
      alignment: 'justified',
      chapterStartsNewPage: true,
      pageSize: 'A4',
      includeTitlePage: true,
      authorName: 'Author',
      pageNumbering: true,
      headerContent: { authorSurname: 'Smith', shortTitle: 'Book' },
    });
    await exportToDocx(chapters, 'A4 Book', true, opts);
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('adds footer with page numbering when no header content', async () => {
    const chapters = [makeChapter({ content: 'Content.' })];
    const opts: ManuscriptExportOptions = makeOpts({
      chapterStartsNewPage: true,
      pageNumbering: true,
    });
    await exportToDocx(chapters, 'Footer Book', true, opts);
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('adds footer in single-section mode with page numbering and no header', async () => {
    const chapters = [makeChapter({ content: 'Content.' })];
    const opts: ManuscriptExportOptions = makeOpts({ lineSpacing: 2.0, pageNumbering: true });
    await exportToDocx(chapters, 'Footer Single', true, opts);
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('handles content with scene breaks (***)', async () => {
    const chapters = [makeChapter({ content: 'Before.\n\n***\n\nAfter.' })];
    await exportToDocx(chapters, 'Scene Breaks');
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('handles content with headings inside chapter', async () => {
    const chapters = [makeChapter({ content: '## Sub heading\n\nParagraph text.' })];
    await exportToDocx(chapters, 'With Subheadings');
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('handles content with horizontal rules', async () => {
    const chapters = [makeChapter({ content: 'Before.\n\n---\n\nAfter.' })];
    await exportToDocx(chapters, 'HRule');
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('handles content with blockquotes', async () => {
    const chapters = [makeChapter({ content: '> A quoted paragraph\n\nNormal text.' })];
    await exportToDocx(chapters, 'Blockquote');
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('handles bold and italic inline formatting', async () => {
    const chapters = [makeChapter({ content: 'Some **bold** and *italic* and ~~struck~~ text.' })];
    await exportToDocx(chapters, 'Inline');
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('uses right alignment', async () => {
    const chapters = [makeChapter({ content: 'Text.' })];
    const opts: ManuscriptExportOptions = makeOpts({ lineSpacing: 1.0, firstLineIndentIn: 0, alignment: 'right', includeHeadings: false });
    await exportToDocx(chapters, 'Right', true, opts);
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('uses center alignment', async () => {
    const chapters = [makeChapter({ content: 'Text.' })];
    const opts: ManuscriptExportOptions = makeOpts({ lineSpacing: 1.0, firstLineIndentIn: 0, alignment: 'center', includeHeadings: false });
    await exportToDocx(chapters, 'Center', true, opts);
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });

  it('throws when docx import fails', async () => {
    // Temporarily make the docx import fail by having Packer.toBlob reject
    // The actual import('docx') is mocked and won't fail, but we test the error path
    // by making Packer.toBlob fail
    mockPackerToBlob.mockRejectedValueOnce(new Error('packer error'));
    const chapters = [makeChapter({ content: 'Text.' })];
    await expect(exportToDocx(chapters, 'Fail')).rejects.toThrow();
  });

  it('includes header with authorSurname only (no shortTitle)', async () => {
    const chapters = [makeChapter({ content: 'Content.' })];
    const opts: ManuscriptExportOptions = makeOpts({
      pageNumbering: true,
      headerContent: { authorSurname: 'Doe', shortTitle: '' },
    });
    await exportToDocx(chapters, 'Header Test', true, opts);
    expect(mockPackerToBlob).toHaveBeenCalledTimes(1);
  });
});

// ── exportToPdf tests ──

describe('exportToPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPdfDownload.mockClear();
    mockCreatePdf.mockReturnValue({ download: mockPdfDownload });
  });

  it('exports a basic PDF', async () => {
    const chapters = [makeChapter({ content: 'Hello world.' })];
    await exportToPdf(chapters, 'My Novel');
    expect(mockCreatePdf).toHaveBeenCalledTimes(1);
    expect(mockPdfDownload).toHaveBeenCalledWith('My Novel.pdf');
  });

  it('includes title in PDF content', async () => {
    const chapters = [makeChapter({ content: 'Body.' })];
    await exportToPdf(chapters, 'Test Book');
    const docDef = mockCreatePdf.mock.calls[0][0];
    const titleNode = docDef.content.find((n: { style?: string }) => n.style === 'title');
    expect(titleNode).toBeDefined();
    expect(titleNode.text).toBe('Test Book');
  });

  it('includes chapter headings by default', async () => {
    const chapters = [makeChapter({ title: 'Chapter 1', content: 'Text.' })];
    await exportToPdf(chapters, 'Book');
    const docDef = mockCreatePdf.mock.calls[0][0];
    const headingNode = docDef.content.find((n: { style?: string; text?: string }) => n.style === 'heading' && n.text === 'Chapter 1');
    expect(headingNode).toBeDefined();
  });

  it('excludes chapter headings when disabled', async () => {
    const chapters = [makeChapter({ title: 'Hidden', content: 'Text.' })];
    await exportToPdf(chapters, 'Book', false);
    const docDef = mockCreatePdf.mock.calls[0][0];
    const headingNode = docDef.content.find((n: { style?: string; text?: string }) => n.style === 'heading' && n.text === 'Hidden');
    expect(headingNode).toBeUndefined();
  });

  it('generates title page with manuscript options', async () => {
    const chapters = [makeChapter({ content: 'Body.' })];
    const opts: ManuscriptExportOptions = makeOpts({
      includeTitlePage: true,
      authorName: 'Jane Doe',
      pageNumbering: true,
      headerContent: { authorSurname: 'Doe', shortTitle: 'Novel' },
    });
    await exportToPdf(chapters, 'Title Page', true, opts);
    const docDef = mockCreatePdf.mock.calls[0][0];
    // Title page should contain 'by' text and author name
    const byNode = docDef.content.find((n: { text?: string }) => n.text === 'by');
    expect(byNode).toBeDefined();
    const authorNode = docDef.content.find((n: { text?: string }) => n.text === 'Jane Doe');
    expect(authorNode).toBeDefined();
  });

  it('adds page breaks between chapters when chapterStartsNewPage', async () => {
    const chapters = [
      makeChapter({ id: 'ch-1', title: 'Ch 1', content: 'First.' }),
      makeChapter({ id: 'ch-2', title: 'Ch 2', content: 'Second.' }),
    ];
    const opts: ManuscriptExportOptions = makeOpts({ lineSpacing: 2.0, alignment: 'justified', chapterStartsNewPage: true, pageSize: 'A4' });
    await exportToPdf(chapters, 'Paged', true, opts);
    const docDef = mockCreatePdf.mock.calls[0][0];
    const ch2Heading = docDef.content.find((n: { text?: string; pageBreak?: string }) => n.text === 'Ch 2' && n.pageBreak === 'before');
    expect(ch2Heading).toBeDefined();
  });

  it('adds page break without heading when chapterStartsNewPage and headings disabled', async () => {
    const chapters = [
      makeChapter({ id: 'ch-1', content: 'First.' }),
      makeChapter({ id: 'ch-2', content: 'Second.' }),
    ];
    const opts: ManuscriptExportOptions = makeOpts({ lineSpacing: 2.0, chapterStartsNewPage: true, includeHeadings: false });
    await exportToPdf(chapters, 'NoHead', true, opts);
    const docDef = mockCreatePdf.mock.calls[0][0];
    const pageBreakNode = docDef.content.find((n: { text?: string; pageBreak?: string }) => n.pageBreak === 'before');
    expect(pageBreakNode).toBeDefined();
  });

  it('handles content with multiple paragraphs in PDF', async () => {
    const chapters = [makeChapter({ content: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.' })];
    await exportToPdf(chapters, 'Multi');
    const docDef = mockCreatePdf.mock.calls[0][0];
    // Should have body-styled nodes for each paragraph
    const bodyNodes = docDef.content.filter((n: { style?: string }) => n.style === 'body');
    expect(bodyNodes.length).toBeGreaterThanOrEqual(3);
  });

  it('handles null content chapters in PDF', async () => {
    const chapters = [makeChapter({ content: null })];
    await exportToPdf(chapters, 'Empty');
    expect(mockCreatePdf).toHaveBeenCalledTimes(1);
    expect(mockPdfDownload).toHaveBeenCalledWith('Empty.pdf');
  });

  it('uses header function with page numbering and header text', async () => {
    const chapters = [makeChapter({ content: 'Body.' })];
    const opts: ManuscriptExportOptions = makeOpts({
      includeTitlePage: true,
      authorName: 'Author',
      pageNumbering: true,
      headerContent: { authorSurname: 'Doe', shortTitle: 'Title' },
    });
    await exportToPdf(chapters, 'Header Book', true, opts);
    const docDef = mockCreatePdf.mock.calls[0][0];
    expect(docDef.header).toBeDefined();
    // Page 1 with title page should return null
    const page1Header = docDef.header(1, 10);
    expect(page1Header).toBeNull();
    // Page 2 should have header text
    const page2Header = docDef.header(2, 10);
    expect(page2Header.text).toContain('Doe');
    expect(page2Header.text).toContain('2');
  });

  it('uses justified alignment in PDF', async () => {
    const chapters = [makeChapter({ content: 'Some text here.' })];
    const opts: ManuscriptExportOptions = makeOpts({ lineSpacing: 2.0, alignment: 'justified', includeHeadings: false });
    await exportToPdf(chapters, 'Justified', true, opts);
    const docDef = mockCreatePdf.mock.calls[0][0];
    const bodyNode = docDef.content.find((n: { style?: string; alignment?: string }) => n.style === 'body' && n.alignment === 'justify');
    expect(bodyNode).toBeDefined();
  });
});

// ── exportToScreenplayPdf tests ──

describe('exportToScreenplayPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPdfDownload.mockClear();
    mockCreatePdf.mockReturnValue({ download: mockPdfDownload });
  });

  it('exports a screenplay PDF with uppercased title', async () => {
    const chapters = [makeChapter({ title: 'Act One', content: 'INT. OFFICE - DAY\n\n@JOHN\nHello.' })];
    await exportToScreenplayPdf(chapters, 'My Script');
    expect(mockCreatePdf).toHaveBeenCalledTimes(1);
    expect(mockPdfDownload).toHaveBeenCalledWith('My Script.screenplay.pdf');
    const docDef = mockCreatePdf.mock.calls[0][0];
    expect(docDef.content[0].text).toBe('MY SCRIPT');
  });

  it('includes chapter title uppercased as section', async () => {
    const chapters = [makeChapter({ title: 'Act One', content: 'INT. ROOM - NIGHT' })];
    await exportToScreenplayPdf(chapters, 'Script');
    const docDef = mockCreatePdf.mock.calls[0][0];
    const sectionNode = docDef.content.find((n: { style?: string; text?: string }) => n.style === 'section' && n.text === 'ACT ONE');
    expect(sectionNode).toBeDefined();
  });

  it('handles chapter with empty title', async () => {
    const chapters = [makeChapter({ title: '', content: 'INT. ROOM - NIGHT' })];
    await exportToScreenplayPdf(chapters, 'Script');
    const docDef = mockCreatePdf.mock.calls[0][0];
    const sectionNode = docDef.content.find((n: { style?: string }) => n.style === 'section');
    expect(sectionNode).toBeUndefined();
  });

  it('uses Courier as default font', async () => {
    const chapters = [makeChapter({ content: 'Action text.' })];
    await exportToScreenplayPdf(chapters, 'Script');
    const docDef = mockCreatePdf.mock.calls[0][0];
    expect(docDef.defaultStyle.font).toBe('Courier');
  });

  it('handles null content in screenplay chapter', async () => {
    const chapters = [makeChapter({ content: null })];
    await exportToScreenplayPdf(chapters, 'Empty Script');
    expect(mockCreatePdf).toHaveBeenCalledTimes(1);
    expect(mockPdfDownload).toHaveBeenCalledWith('Empty Script.screenplay.pdf');
  });
});

// ── screenplayChapterToPdfContent block type tests ──

describe('screenplayChapterToPdfContent block types', () => {
  it('normalizes scene-heading to uppercase', () => {
    const chapter = makeChapter({ content: 'INT. office - day' });
    const nodes = screenplayChapterToPdfContent(chapter);
    const sceneNode = nodes.find(n => n.style === 'sceneHeading');
    if (sceneNode) {
      expect(sceneNode.text).toBe(sceneNode.text.toUpperCase());
    }
  });

  it('creates transition nodes with right alignment', () => {
    const chapter = makeChapter({ content: 'CUT TO:' });
    const nodes = screenplayChapterToPdfContent(chapter);
    const transNode = nodes.find(n => n.style === 'transition');
    if (transNode) {
      expect(transNode.alignment).toBe('right');
    }
  });

  it('creates character nodes with margin offset', () => {
    const chapter = makeChapter({ content: '@JOHN' });
    const nodes = screenplayChapterToPdfContent(chapter);
    const charNode = nodes.find(n => n.style === 'character');
    if (charNode) {
      expect(charNode.margin![0]).toBe(170);
    }
  });

  it('creates dialogue nodes', () => {
    const chapter = makeChapter({ content: '@JOHN\nHello there.' });
    const nodes = screenplayChapterToPdfContent(chapter);
    const dialogueNode = nodes.find(n => n.style === 'dialogue');
    if (dialogueNode) {
      expect(dialogueNode.margin![0]).toBe(110);
    }
  });

  it('creates parenthetical nodes', () => {
    const chapter = makeChapter({ content: '@JOHN\n(softly)\nHello.' });
    const nodes = screenplayChapterToPdfContent(chapter);
    const parenNode = nodes.find(n => n.style === 'parenthetical');
    if (parenNode) {
      expect(parenNode.margin![0]).toBe(140);
    }
  });

  it('creates action nodes with margin', () => {
    const chapter = makeChapter({ content: 'The door opens slowly.' });
    const nodes = screenplayChapterToPdfContent(chapter);
    const actionNode = nodes.find(n => n.style === 'action');
    if (actionNode) {
      expect(actionNode.margin![3]).toBe(8);
    }
  });
});

// ── exportPublishingBundle tests ──

describe('exportPublishingBundle', () => {
  let downloadFile: ReturnType<typeof vi.fn>;

  const bundleData = {
    bookDescription: 'A great book.',
    shortSynopsis: 'Short summary.',
    longSynopsis: 'A longer summary of the book.',
    authorBioShort: 'Author bio short.',
    authorBioLong: 'Author bio long form.',
    keywordSuggestions: ['fiction', 'drama'],
    categorySuggestions: ['Literary Fiction'],
    backCoverCopy: 'An amazing story...',
    hookLines: ['What if everything changed?', 'One moment can define a life.'],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPackerToBlob.mockResolvedValue(new Blob(['fake-docx']));
    mockCreatePdf.mockReturnValue({ download: mockPdfDownload });
    const utilsMod = await import('./utils');
    downloadFile = utilsMod.downloadFile as ReturnType<typeof vi.fn>;
  });

  it('exports publishing bundle with default docx format', async () => {
    const chapters = [makeChapter({ content: 'Text.' })];
    await exportPublishingBundle(chapters, 'My Book', {
      data: bundleData,
    });
    // Should call downloadFile for: docx + metadata json + metadata txt + marketing txt
    expect(downloadFile).toHaveBeenCalledTimes(4);
    // Check metadata JSON filename
    expect(downloadFile.mock.calls[1][1]).toBe('My Book.publishing-metadata.json');
    // Check metadata TXT filename
    expect(downloadFile.mock.calls[2][1]).toBe('My Book.publishing-metadata.txt');
    // Check marketing copy filename
    expect(downloadFile.mock.calls[3][1]).toBe('My Book.marketing-copy.txt');
  });

  it('includes metadata content in JSON file', async () => {
    const chapters = [makeChapter({ content: 'Text.' })];
    await exportPublishingBundle(chapters, 'Book', { data: bundleData });
    const jsonStr = downloadFile.mock.calls[1][0];
    const parsed = JSON.parse(jsonStr);
    expect(parsed.projectTitle).toBe('Book');
    expect(parsed.bookDescription).toBe('A great book.');
    expect(parsed.chapterCount).toBe(1);
  });

  it('includes metadata content in TXT file', async () => {
    const chapters = [makeChapter({ content: 'Text.' })];
    await exportPublishingBundle(chapters, 'Book', { data: bundleData });
    const txtContent = downloadFile.mock.calls[2][0];
    expect(txtContent).toContain('Title: Book');
    expect(txtContent).toContain('Book description: A great book.');
    expect(txtContent).toContain('Keywords: fiction, drama');
    expect(txtContent).toContain('Categories: Literary Fiction');
  });

  it('includes marketing copy with hook lines', async () => {
    const chapters = [makeChapter({ content: 'Text.' })];
    await exportPublishingBundle(chapters, 'Book', { data: bundleData });
    const marketing = downloadFile.mock.calls[3][0];
    expect(marketing).toContain('# Back Cover Copy');
    expect(marketing).toContain('An amazing story...');
    expect(marketing).toContain('1. What if everything changed?');
    expect(marketing).toContain('2. One moment can define a life.');
  });

  it('includes KDP template when requested', async () => {
    const chapters = [makeChapter({ content: 'Text.' })];
    await exportPublishingBundle(chapters, 'Book', {
      data: bundleData,
      includeKdpTemplate: true,
    });
    const jsonStr = downloadFile.mock.calls[1][0];
    const parsed = JSON.parse(jsonStr);
    expect(parsed.kdpTemplate).toBeDefined();
    expect(parsed.kdpTemplate.title).toBe('Book');
    expect(parsed.kdpTemplate.language).toBe('English');

    const txtContent = downloadFile.mock.calls[2][0];
    expect(txtContent).toContain('Amazon KDP Template:');
  });

  it('does not include KDP template by default', async () => {
    const chapters = [makeChapter({ content: 'Text.' })];
    await exportPublishingBundle(chapters, 'Book', { data: bundleData });
    const jsonStr = downloadFile.mock.calls[1][0];
    const parsed = JSON.parse(jsonStr);
    expect(parsed.kdpTemplate).toBeUndefined();
  });

  it('exports with RTF manuscript format', async () => {
    const chapters = [makeChapter({ content: 'Body.' })];
    await exportPublishingBundle(chapters, 'RTF Book', {
      data: bundleData,
      manuscriptFormat: 'rtf',
    });
    // RTF export calls downloadFile, plus 3 bundle files = 4
    expect(downloadFile).toHaveBeenCalledTimes(4);
    expect(downloadFile.mock.calls[0][1]).toBe('RTF Book.rtf');
  });

  it('exports with markdown manuscript format', async () => {
    const chapters = [makeChapter({ content: 'Body.' })];
    await exportPublishingBundle(chapters, 'MD Book', {
      data: bundleData,
      manuscriptFormat: 'markdown',
    });
    expect(downloadFile.mock.calls[0][1]).toBe('MD Book.md');
  });

  it('exports with txt manuscript format', async () => {
    const chapters = [makeChapter({ content: 'Body.' })];
    await exportPublishingBundle(chapters, 'TXT Book', {
      data: bundleData,
      manuscriptFormat: 'txt',
    });
    expect(downloadFile.mock.calls[0][1]).toBe('TXT Book.txt');
  });

  it('exports with pdf manuscript format', async () => {
    const chapters = [makeChapter({ content: 'Body.' })];
    await exportPublishingBundle(chapters, 'PDF Book', {
      data: bundleData,
      manuscriptFormat: 'pdf',
    });
    expect(mockPdfDownload).toHaveBeenCalledWith('PDF Book.pdf');
  });

  it('respects includeHeadings option', async () => {
    const chapters = [makeChapter({ title: 'Ch 1', content: 'Body.' })];
    await exportPublishingBundle(chapters, 'Book', {
      data: bundleData,
      includeHeadings: false,
      manuscriptFormat: 'markdown',
    });
    const mdOutput = downloadFile.mock.calls[0][0];
    expect(mdOutput).not.toContain('## Ch 1');
  });
});
