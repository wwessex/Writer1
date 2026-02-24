import type { JSONContent } from '@tiptap/core';
import type { Chapter, ScreenplayBlockType, ManuscriptExportOptions } from '@/types';
import { editorToPlainText, downloadFile } from './utils';
import { loadPdfMake } from './export/boundary/pdfmake';
import { cloneDocxTextRun } from './export/boundary/docxCompat';
import type { PdfAlignment, PdfContentNode, PdfDocumentDefinition, DocxAlignment, DocxSection, DocxClasses, PdfMakeApi } from './export/types';

export interface ScreenplayBlock {
  type: ScreenplayBlockType;
  text: string;
}

export interface FountainMetadata {
  credit?: string;
  author?: string;
  draftDate?: string;
  source?: string;
}

export interface ScreenplayFountainOptions {
  sceneSeparator?: string;
}

export interface FountainExportOptions {
  includeSectionTitles?: boolean;
  includeMetadataBlock?: boolean;
  metadata?: FountainMetadata;
  sceneSeparator?: string;
  sectionSeparator?: string;
  filenameConvention?: 'title' | 'title-screenplay' | 'title-fountain';
}

const SCREENPLAY_PDF_FONTS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  },
  Courier: {
    normal: 'Courier',
    bold: 'Courier-Bold',
    italics: 'Courier-Oblique',
    bolditalics: 'Courier-BoldOblique'
  },
};

function extractTextFromNode(node: JSONContent | null | undefined): string {
  if (!node) return '';

  if (typeof node.text === 'string') {
    return node.text;
  }

  if (!node.content?.length) {
    return '';
  }

  return node.content.map(extractTextFromNode).join('');
}

function isScreenplayBlockType(value: string | null | undefined): value is ScreenplayBlockType {
  return value === 'scene-heading'
    || value === 'action'
    || value === 'character'
    || value === 'parenthetical'
    || value === 'dialogue'
    || value === 'transition';
}

/**
 * Convert editor JSON content to screenplay-aware block list.
 */
export function screenplayJsonToBlocks(content: JSONContent | null): ScreenplayBlock[] {
  if (!content?.content?.length) {
    return [];
  }

  const blocks: ScreenplayBlock[] = [];

  for (const node of content.content) {
    if (node.type !== 'paragraph') {
      continue;
    }

    const screenplayType = node.attrs?.screenplayType;
    if (!isScreenplayBlockType(typeof screenplayType === 'string' ? screenplayType : null)) {
      continue;
    }

    const text = extractTextFromNode(node).trim();
    if (!text) {
      continue;
    }

    blocks.push({
      type: screenplayType,
      text,
    });
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

/**
 * Convert screenplay chapter JSON into Fountain text.
 */
export function screenplayChapterToFountain(chapter: Chapter, options: ScreenplayFountainOptions = {}): string {
  const sceneSeparator = options.sceneSeparator ?? '\n\n';
  const chunks: string[] = [];
  let hasScene = false;

  const pushBlock = (text: string, withLeadingSpacer = false) => {
    if (!text) {
      return;
    }
    if (withLeadingSpacer && chunks.length > 0 && chunks[chunks.length - 1] !== '') {
      chunks.push('');
    }
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
        pushBlock(normalized, true);
        break;
      case 'transition':
        pushBlock(normalized, true);
        break;
      case 'character':
      case 'dialogue':
      case 'parenthetical':
      default:
        pushBlock(normalized, false);
        break;
    }
  }

  return chunks.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Build pdfmake content blocks for screenplay formatting.
 */
export function screenplayChapterToPdfContent(chapter: Chapter): PdfContentNode[] {
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
      case 'action':
      default:
        return { text: normalized, style: 'action', margin: [0, 0, 0, 8] };
    }
  });
}

// ── Helpers for rich text extraction ──

interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

function extractInlineRuns(node: JSONContent | null | undefined): InlineRun[] {
  if (!node) return [];

  if (node.type === 'text' && typeof node.text === 'string') {
    const marks = node.marks || [];
    const run: InlineRun = { text: node.text };
    for (const mark of marks) {
      if (mark.type === 'bold') run.bold = true;
      if (mark.type === 'italic') run.italic = true;
      if (mark.type === 'underline') run.underline = true;
      if (mark.type === 'strike') run.strike = true;
    }
    return [run];
  }

  if (node.content?.length) {
    return node.content.flatMap(child => extractInlineRuns(child));
  }

  return [];
}

// Inches → twips (twentieths of a point × 72 points = 1 inch, 1 inch = 1440 twips)
function inchesToTwips(inches: number): number {
  return Math.round(inches * 1440);
}

// Points → half-points (docx uses half-points for font sizes)
function ptToHalfPt(pt: number): number {
  return pt * 2;
}

// Line spacing: docx uses 240ths of a line
function lineSpacingTo240ths(spacing: number): number {
  return Math.round(spacing * 240);
}

/**
 * Detect scene breaks in plain text: lines that are purely separator markers
 * (e.g. "***", "* * *", "---", "###", "~ ~ ~", or blank lines between content).
 */
function isSceneBreakLine(line: string): boolean {
  const trimmed = line.trim();
  return /^(\*\s*){3,}$/.test(trimmed) ||
    /^(-\s*){3,}$/.test(trimmed) ||
    /^(#\s*){3,}$/.test(trimmed) ||
    /^(~\s*){3,}$/.test(trimmed) ||
    trimmed === '#';
}

/**
 * Export chapters to DOCX format.
 * When manuscriptOptions is provided, applies industry-standard manuscript
 * formatting (headers, footers, page breaks, indents, scene breaks, title page).
 */
export async function exportToDocx(
  chapters: Chapter[],
  title: string,
  includeHeadings: boolean = true,
  manuscriptOptions?: ManuscriptExportOptions,
): Promise<void> {
  let docx;
  try {
    docx = await import('docx');
  } catch (cause) {
    throw new Error('Failed to load the DOCX export library. Check your connection and try again.', { cause });
  }
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Header,
    Footer,
    AlignmentType,
    PageNumber,
    NumberFormat,
  } = docx;

  const opts = manuscriptOptions;

  // Compute formatting values from manuscript options (or use basic defaults)
  const fontFamily = opts?.fontFamily ?? 'Times New Roman';
  const fontSizePt = opts?.fontSizePt ?? 12;
  const lineSpacing = opts?.lineSpacing ?? 1.15;
  const firstLineIndent = opts ? inchesToTwips(opts.firstLineIndentIn) : 0;
  const marginTwips = opts ? inchesToTwips(opts.marginIn) : inchesToTwips(1);
  const paragraphSpacingAfter = opts ? opts.paragraphSpacingAfterPt * 20 : 200;
  const paragraphSpacingBefore = opts ? opts.paragraphSpacingBeforePt * 20 : 0;
  const sceneBreakMarker = opts?.sceneBreakMarker ?? '#';
  const alignment = opts?.alignment === 'justified'
    ? AlignmentType.JUSTIFIED
    : opts?.alignment === 'center'
      ? AlignmentType.CENTER
      : opts?.alignment === 'right'
        ? AlignmentType.RIGHT
        : AlignmentType.LEFT;
  const chapterStartsNewPage = opts?.chapterStartsNewPage ?? false;
  const doIncludeHeadings = opts?.includeHeadings ?? includeHeadings;
  const includeTitlePage = opts?.includeTitlePage ?? false;
  const pageSize = opts?.pageSize ?? 'LETTER';

  // Page size dimensions in twips
  const pageDims = pageSize === 'A4'
    ? { width: 11906, height: 16838 }  // A4: 210mm × 297mm
    : { width: 12240, height: 15840 };  // US Letter: 8.5" × 11"

  // Build header
  const headerChildren: InstanceType<typeof TextRun>[] = [];
  if (opts?.headerContent?.authorSurname) {
    headerChildren.push(new TextRun({
      text: opts.headerContent.authorSurname,
      font: fontFamily,
      size: ptToHalfPt(fontSizePt),
    }));
    if (opts.headerContent.shortTitle) {
      headerChildren.push(new TextRun({
        text: ` / ${opts.headerContent.shortTitle}`,
        font: fontFamily,
        size: ptToHalfPt(fontSizePt),
        italics: true,
      }));
    }
    headerChildren.push(new TextRun({
      text: ' / ',
      font: fontFamily,
      size: ptToHalfPt(fontSizePt),
    }));
  }
  if (opts?.pageNumbering) {
    headerChildren.push(new TextRun({
      children: [PageNumber.CURRENT],
      font: fontFamily,
      size: ptToHalfPt(fontSizePt),
    }));
  }

  const hasHeader = headerChildren.length > 0;

  // Build sections: one section per chapter when chapterStartsNewPage is true
  // Otherwise one big section
  const sections: DocxSection[] = [];

  // Title page section (if requested)
  if (includeTitlePage && opts) {
    const titlePageChildren: unknown[] = [];

    // Approximately 1/3 down the page: title
    titlePageChildren.push(new Paragraph({ spacing: { before: 4800 } }));
    titlePageChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: title,
          font: fontFamily,
          size: ptToHalfPt(fontSizePt),
          bold: true,
        })],
      }),
    );

    // "by" line
    titlePageChildren.push(new Paragraph({ spacing: { before: 400 } }));
    titlePageChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: 'by',
          font: fontFamily,
          size: ptToHalfPt(fontSizePt),
        })],
      }),
    );

    // Author name
    titlePageChildren.push(new Paragraph({ spacing: { before: 200 } }));
    titlePageChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: opts.authorName || 'Author Name',
          font: fontFamily,
          size: ptToHalfPt(fontSizePt),
        })],
      }),
    );

    // Word count (approximate)
    const totalWords = chapters.reduce((sum, ch) => {
      return sum + editorToPlainText(ch.content).split(/\s+/).filter(w => w.length > 0).length;
    }, 0);
    // Round to nearest thousand
    const roundedWords = Math.round(totalWords / 1000) * 1000;

    titlePageChildren.push(new Paragraph({ spacing: { before: 2400 } }));
    titlePageChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text: `Approx. ${roundedWords.toLocaleString()} words`,
          font: fontFamily,
          size: ptToHalfPt(fontSizePt),
        })],
      }),
    );

    sections.push({
      properties: {
        page: {
          size: pageDims,
          margin: {
            top: marginTwips,
            bottom: marginTwips,
            left: marginTwips,
            right: marginTwips,
          },
          pageNumbers: { start: 0 },
        },
        titlePage: true,
      },
      children: titlePageChildren,
    });
  }

  if (chapterStartsNewPage) {
    // One section per chapter
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const children: unknown[] = [];

      if (doIncludeHeadings) {
        // Chapter heading: centred, bold, with space before/after
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 2400, after: 600 },
            children: [new TextRun({
              text: chapter.title,
              font: fontFamily,
              size: ptToHalfPt(fontSizePt),
              bold: true,
            })],
          }),
        );
      }

      // Process content with rich text support
      const contentChildren = buildDocxChapterContent(
        chapter, fontFamily, fontSizePt, lineSpacing,
        firstLineIndent, paragraphSpacingBefore, paragraphSpacingAfter,
        alignment, sceneBreakMarker,
        { Paragraph, TextRun, AlignmentType },
      );
      children.push(...contentChildren);

          const sectionProps: Record<string, unknown> = {
        page: {
          size: pageDims,
          margin: {
            top: marginTwips,
            bottom: marginTwips,
            left: marginTwips,
            right: marginTwips,
          },
          pageNumbers: {
            formatType: NumberFormat.DECIMAL,
          },
        },
      };

      if (hasHeader) {
        sectionProps.headers = {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: headerChildren.map(run => {
                // Clone TextRuns for each section to avoid shared references
                              return cloneDocxTextRun(run, TextRun) as InstanceType<typeof TextRun>;
              }),
            })],
          }),
        };
      }

      if (opts?.pageNumbering && !hasHeader) {
        sectionProps.footers = {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({
                children: [PageNumber.CURRENT],
                font: fontFamily,
                size: ptToHalfPt(fontSizePt),
              })],
            })],
          }),
        };
      }

      sections.push({ properties: sectionProps, children });
    }
  } else {
    // All chapters in a single section
    const children: unknown[] = [];

    if (!includeTitlePage) {
      // Simple title at top
      children.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.TITLE,
        }),
      );
    }

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];

      if (doIncludeHeadings) {
        children.push(
          new Paragraph({
            text: chapter.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
        );
      }

      const contentChildren = buildDocxChapterContent(
        chapter, fontFamily, fontSizePt, lineSpacing,
        firstLineIndent, paragraphSpacingBefore, paragraphSpacingAfter,
        alignment, sceneBreakMarker,
        { Paragraph, TextRun, AlignmentType },
      );
      children.push(...contentChildren);
    }

      const sectionProps: Record<string, unknown> = {
      page: {
        size: pageDims,
        margin: {
          top: marginTwips,
          bottom: marginTwips,
          left: marginTwips,
          right: marginTwips,
        },
      },
    };

    if (hasHeader) {
      sectionProps.headers = {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [...headerChildren],
          })],
        }),
      };
    }

    if (opts?.pageNumbering && !hasHeader) {
      sectionProps.footers = {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              children: [PageNumber.CURRENT],
              font: fontFamily,
              size: ptToHalfPt(fontSizePt),
            })],
          })],
        }),
      };
    }

    sections.push({ properties: sectionProps, children });
  }

  const doc = new Document({ sections: sections as never });
  const blob = await Packer.toBlob(doc);
  downloadFile(blob, `${title}.docx`);
}

/**
 * Build paragraph elements for one chapter's content,
 * preserving inline formatting (bold/italic/underline) and handling scene breaks.
 */
function buildDocxChapterContent(
  chapter: Chapter,
  fontFamily: string,
  fontSizePt: number,
  lineSpacing: number,
  firstLineIndent: number,
  spacingBefore: number,
  spacingAfter: number,
  alignment: DocxAlignment,
  sceneBreakMarker: string,
  docxClasses: DocxClasses,
): unknown[] {
  const { Paragraph, TextRun, AlignmentType } = docxClasses;
  const children: unknown[] = [];

  if (!chapter.content?.content) {
    return children;
  }

  for (const node of chapter.content.content) {
    if (node.type === 'paragraph') {
      const text = extractTextFromNode(node).trim();

      // Detect scene breaks
      if (isSceneBreakLine(text)) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 240 },
            children: [new TextRun({
              text: sceneBreakMarker,
              font: fontFamily,
              size: ptToHalfPt(fontSizePt),
            })],
          }),
        );
        continue;
      }

      // Skip empty paragraphs
      if (!text) continue;

      // Build runs with inline formatting
      const runs = extractInlineRuns(node);
      const textRuns = runs.map(run => new TextRun({
        text: run.text,
        font: fontFamily,
        size: ptToHalfPt(fontSizePt),
        bold: run.bold,
        italics: run.italic,
        underline: run.underline ? { type: 'single' } : undefined,
        strike: run.strike,
      }));

      children.push(
        new Paragraph({
          alignment,
          indent: firstLineIndent ? { firstLine: firstLineIndent } : undefined,
          spacing: {
            before: spacingBefore,
            after: spacingAfter,
            line: lineSpacingTo240ths(lineSpacing),
          },
          children: textRuns,
        }),
      );
    } else if (node.type === 'heading') {
      // Preserve headings within chapter content (H2, etc.)
      const level = node.attrs?.level ?? 2;
      const headingText = extractTextFromNode(node);
      if (headingText.trim()) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
            children: [new TextRun({
              text: headingText,
              font: fontFamily,
              size: ptToHalfPt(level === 1 ? fontSizePt + 4 : fontSizePt + 2),
              bold: true,
            })],
          }),
        );
      }
    } else if (node.type === 'horizontalRule') {
      // Horizontal rules → scene break marker
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 240 },
          children: [new TextRun({
            text: sceneBreakMarker,
            font: fontFamily,
            size: ptToHalfPt(fontSizePt),
          })],
        }),
      );
    } else if (node.type === 'blockquote') {
      // Blockquotes: indented
      for (const child of node.content || []) {
        if (child.type === 'paragraph') {
          const runs = extractInlineRuns(child);
          const textRuns = runs.map(run => new TextRun({
            text: run.text,
            font: fontFamily,
            size: ptToHalfPt(fontSizePt),
            bold: run.bold,
            italics: run.italic,
          }));
          children.push(
            new Paragraph({
              alignment,
              indent: { left: inchesToTwips(0.5), firstLine: firstLineIndent },
              spacing: {
                before: spacingBefore,
                after: spacingAfter,
                line: lineSpacingTo240ths(lineSpacing),
              },
              children: textRuns,
            }),
          );
        }
      }
    }
  }

  return children;
}

/**
 * Export chapters to PDF format.
 * When manuscriptOptions is provided, applies industry-standard formatting.
 */
export async function exportToPdf(
  chapters: Chapter[],
  title: string,
  includeHeadings: boolean = true,
  manuscriptOptions?: ManuscriptExportOptions,
): Promise<void> {
  let pdfMakeModule: PdfMakeApi;
  try {
    pdfMakeModule = await loadPdfMake();
  } catch (cause) {
    throw new Error('Failed to load the PDF export library. Check your connection and try again.', { cause });
  }

  pdfMakeModule.fonts = SCREENPLAY_PDF_FONTS;

  const opts = manuscriptOptions;
  const fontSizePt = opts?.fontSizePt ?? 12;
  const lineHeight = opts?.lineSpacing ?? 1.5;
  const doIncludeHeadings = opts?.includeHeadings ?? includeHeadings;
  const chapterStartsNewPage = opts?.chapterStartsNewPage ?? false;
  const sceneBreakMarker = opts?.sceneBreakMarker ?? '#';
  const firstLineIndent = opts ? opts.firstLineIndentIn * 72 : 0;
  const marginPt = opts ? opts.marginIn * 72 : 72;
  const pdfAlignment: PdfAlignment = opts?.alignment === 'justified' ? 'justify' : (opts?.alignment ?? 'left');
  const pageSize = opts?.pageSize ?? 'LETTER';

  const content: PdfContentNode[] = [];

  // Title page
  if (opts?.includeTitlePage) {
    content.push({ text: '', margin: [0, 180, 0, 0] });
    content.push({
      text: title,
      alignment: 'center',
      fontSize: fontSizePt,
      bold: true,
      margin: [0, 0, 0, 20],
    });
    content.push({
      text: 'by',
      alignment: 'center',
      fontSize: fontSizePt,
      margin: [0, 0, 0, 10],
    });
    content.push({
      text: opts.authorName || 'Author Name',
      alignment: 'center',
      fontSize: fontSizePt,
      margin: [0, 0, 0, 40],
    });

    // Word count
    const totalWords = chapters.reduce((sum, ch) => {
      return sum + editorToPlainText(ch.content).split(/\s+/).filter(w => w.length > 0).length;
    }, 0);
    const roundedWords = Math.round(totalWords / 1000) * 1000;
    content.push({
      text: `Approx. ${roundedWords.toLocaleString()} words`,
      alignment: 'center',
      fontSize: fontSizePt,
      margin: [0, 100, 0, 0],
    });

    content.push({ text: '', pageBreak: 'after' });
  } else {
    content.push({
      text: title,
      style: 'title',
      margin: [0, 0, 0, 20],
    });
  }

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];

    if (doIncludeHeadings) {
      content.push({
        text: chapter.title,
        style: 'heading',
        margin: [0, chapterStartsNewPage ? 100 : 20, 0, 10],
        ...(chapterStartsNewPage && i > 0 ? { pageBreak: 'before' } : {}),
      });
    } else if (chapterStartsNewPage && i > 0) {
      content.push({ text: '', pageBreak: 'before' });
    }

    const text = editorToPlainText(chapter.content);
    const paragraphs = text.split('\n');

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if (isSceneBreakLine(trimmed)) {
        content.push({
          text: sceneBreakMarker,
          alignment: 'center',
          style: 'body',
          margin: [0, 10, 0, 10],
        });
        continue;
      }

      content.push({
        text: para,
        style: 'body',
        alignment: pdfAlignment,
        margin: [firstLineIndent, 0, 0, 0],
      });
    }
  }

  // Build header/footer
  const headerSurname = opts?.headerContent?.authorSurname ?? '';
  const shortTitle = opts?.headerContent?.shortTitle ?? '';
  const headerText = [headerSurname, shortTitle].filter(Boolean).join(' / ');

  const docDefinition: PdfDocumentDefinition = {
    pageSize,
    pageMargins: [marginPt, marginPt, marginPt, marginPt],
    content,
    ...(opts?.pageNumbering || headerText ? {
      header: (currentPage: number, _pageCount: number) => {
        if (opts?.includeTitlePage && currentPage === 1) return null;
        const parts = [];
        if (headerText) parts.push(headerText);
        if (opts?.pageNumbering) parts.push(String(currentPage));
        return {
          text: parts.join(' / '),
          alignment: 'right',
          margin: [marginPt, marginPt / 2, marginPt, 0],
          fontSize: fontSizePt - 2,
        };
      },
    } : {}),
    styles: {
      title: {
        fontSize: fontSizePt + 12,
        bold: true,
      },
      heading: {
        fontSize: fontSizePt + 2,
        bold: true,
        alignment: 'center',
      },
      body: {
        fontSize: fontSizePt,
        lineHeight,
      },
    },
    defaultStyle: {
      font: 'Helvetica',
    },
  };

  pdfMakeModule.createPdf(docDefinition).download(`${title}.pdf`);
}

/**
 * Export chapters to screenplay-formatted PDF.
 */
export async function exportToScreenplayPdf(
  chapters: Chapter[],
  title: string,
): Promise<void> {
  let pdfMakeModule: PdfMakeApi;
  try {
    pdfMakeModule = await loadPdfMake();
  } catch (cause) {
    throw new Error('Failed to load the PDF export library. Check your connection and try again.', { cause });
  }

  pdfMakeModule.fonts = SCREENPLAY_PDF_FONTS;

  const content: PdfContentNode[] = [{
    text: title.toUpperCase(),
    style: 'title',
    margin: [0, 0, 0, 20],
  }];

  for (const chapter of chapters) {
    if (chapter.title) {
      content.push({ text: chapter.title.toUpperCase(), style: 'section', margin: [0, 18, 0, 8] });
    }
    content.push(...screenplayChapterToPdfContent(chapter));
  }

  const docDefinition: PdfDocumentDefinition = {
    pageSize: 'LETTER',
    pageMargins: [72, 72, 72, 72],
    content,
    styles: {
      title: { fontSize: 16, bold: true, alignment: 'center' },
      section: { fontSize: 11, bold: true },
      sceneHeading: { fontSize: 12, bold: true },
      action: { fontSize: 12 },
      character: { fontSize: 12, bold: true },
      parenthetical: { fontSize: 12, italics: true },
      dialogue: { fontSize: 12 },
      transition: { fontSize: 12, bold: true },
    },
    defaultStyle: {
      font: 'Courier',
      lineHeight: 1,
    },
  };

  pdfMakeModule.createPdf(docDefinition).download(`${title}.screenplay.pdf`);
}

/**
 * Export chapters to Fountain format.
 */
export async function exportToFountain(
  chapters: Chapter[],
  title: string,
  options: FountainExportOptions = {}
): Promise<void> {
  const {
    includeSectionTitles = false,
    includeMetadataBlock = true,
    metadata,
    sceneSeparator,
    sectionSeparator = '\n\n',
    filenameConvention = 'title',
  } = options;

  const headerLines = [
    `Title: ${title}`,
    metadata?.credit ? `Credit: ${metadata.credit}` : null,
    metadata?.author ? `Author: ${metadata.author}` : null,
    metadata?.draftDate ? `Draft date: ${metadata.draftDate}` : null,
    metadata?.source ? `Source: ${metadata.source}` : null,
  ].filter((line): line is string => Boolean(line));

  const header = includeMetadataBlock ? `${headerLines.join('\n')}\n\n` : '';

  const body = chapters
    .map(chapter => {
      const chapterBody = screenplayChapterToFountain(chapter, { sceneSeparator });
      if (!chapterBody) {
        return includeSectionTitles && chapter.title ? `# ${chapter.title}` : '';
      }

      if (!includeSectionTitles || !chapter.title) {
        return chapterBody;
      }

      return `# ${chapter.title}\n\n${chapterBody}`;
    })
    .filter(Boolean)
    .join(sectionSeparator);

  const output = `${header}${body}`.trim();

  const filename = filenameConvention === 'title-screenplay'
    ? `${title}.screenplay.fountain`
    : filenameConvention === 'title-fountain'
      ? `${title}.fountain-export.fountain`
      : `${title}.fountain`;

  downloadFile(output, filename, 'text/plain;charset=utf-8');
}

/**
 * Build an RTF document from plain text without external dependencies.
 * Supports manuscript formatting options when provided.
 */
function buildRtf(
  title: string,
  chapters: Chapter[],
  includeHeadings: boolean,
  manuscriptOptions?: ManuscriptExportOptions,
): string {
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');

  const opts = manuscriptOptions;
  const fontFamily = opts?.fontFamily ?? 'Times New Roman';
  const fontSizeHalf = (opts?.fontSizePt ?? 12) * 2; // RTF uses half-points
  const lineSpacing = opts?.lineSpacing ?? 1.0;
  // RTF \sl is in twips: fontSize × lineSpacing × 20
  const slTwips = Math.round((opts?.fontSizePt ?? 12) * lineSpacing * 20);
  const firstLineIndent = opts ? Math.round(opts.firstLineIndentIn * 1440) : 0;
  const marginTwips = opts ? Math.round(opts.marginIn * 1440) : 1440;
  const doIncludeHeadings = opts?.includeHeadings ?? includeHeadings;
  const chapterStartsNewPage = opts?.chapterStartsNewPage ?? false;
  const sceneBreakMarker = opts?.sceneBreakMarker ?? '#';

  // RTF page size
  const paperw = opts?.pageSize === 'A4' ? 11906 : 12240;
  const paperh = opts?.pageSize === 'A4' ? 16838 : 15840;

  // Alignment
  const alignCmd = opts?.alignment === 'justified' ? '\\qj'
    : opts?.alignment === 'center' ? '\\qc'
      : opts?.alignment === 'right' ? '\\qr'
        : '\\ql';

  const parts: string[] = [
    '{\\rtf1\\ansi\\deff0',
    `{\\fonttbl{\\f0 ${escape(fontFamily)};}}`,
    `\\paperw${paperw}\\paperh${paperh}`,
    `\\margl${marginTwips}\\margr${marginTwips}\\margt${marginTwips}\\margb${marginTwips}`,
    `\\f0\\fs${fontSizeHalf}`,
  ];

  // Header with author/title/page number
  if (opts?.pageNumbering || opts?.headerContent?.authorSurname) {
    const headerParts: string[] = [];
    if (opts?.headerContent?.authorSurname) {
      headerParts.push(escape(opts.headerContent.authorSurname));
      if (opts.headerContent.shortTitle) {
        headerParts.push(`{\\i ${escape(opts.headerContent.shortTitle)}}`);
      }
    }
    parts.push(`{\\header\\pard\\qr\\fs${fontSizeHalf - 4} ${headerParts.join(' / ')}${opts?.pageNumbering ? ' / {\\field{\\*\\fldinst PAGE}}' : ''}\\par}`);
  }

  // Title page
  if (opts?.includeTitlePage) {
    parts.push('\\pard\\qc\\sb4800');
    parts.push(`\\b\\fs${fontSizeHalf} ${escape(title)}\\b0\\par`);
    parts.push('\\sb400');
    parts.push(`\\fs${fontSizeHalf} by\\par`);
    parts.push('\\sb200');
    parts.push(`\\fs${fontSizeHalf} ${escape(opts.authorName || 'Author Name')}\\par`);
    parts.push('\\page');
  } else {
    parts.push(`\\pard\\qc\\b\\fs${fontSizeHalf + 12} ${escape(title)}\\b0\\fs${fontSizeHalf}\\par\\par`);
  }

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];

    if (chapterStartsNewPage && i > 0) {
      parts.push('\\page');
    }

    if (doIncludeHeadings) {
      parts.push(`\\pard\\qc\\sb480\\sa240\\b\\fs${fontSizeHalf + 4} ${escape(chapter.title)}\\b0\\fs${fontSizeHalf}\\par`);
    }

    const text = editorToPlainText(chapter.content);
    const paragraphs = text.split('\n');

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if (isSceneBreakLine(trimmed)) {
        parts.push(`\\pard\\qc\\sb240\\sa240\\fs${fontSizeHalf} ${escape(sceneBreakMarker)}\\par`);
        continue;
      }

      parts.push(`\\pard${alignCmd}\\fi${firstLineIndent}\\sl${slTwips}\\slmult1 ${escape(trimmed)}\\par`);
    }
  }

  parts.push('}');
  return parts.join('\n');
}

/**
 * Export chapters to RTF format.
 * When manuscriptOptions is provided, applies industry-standard formatting.
 */
export async function exportToRtf(
  chapters: Chapter[],
  title: string,
  includeHeadings: boolean = true,
  manuscriptOptions?: ManuscriptExportOptions,
): Promise<void> {
  const rtf = buildRtf(title, chapters, includeHeadings, manuscriptOptions);
  downloadFile(rtf, `${title}.rtf`, 'application/rtf');
}

// ---- Markdown export ----

function inlineNodesToMarkdown(nodes: JSONContent[]): string {
  return nodes.map(node => {
    if (node.type === 'text') {
      let text = node.text || '';
      const marks = node.marks || [];
      for (const mark of marks) {
        switch (mark.type) {
          case 'bold': text = `**${text}**`; break;
          case 'italic': text = `*${text}*`; break;
          case 'underline': text = `<u>${text}</u>`; break;
          case 'strike': text = `~~${text}~~`; break;
        }
      }
      return text;
    }
    if (node.content) {
      return inlineNodesToMarkdown(node.content);
    }
    return '';
  }).join('');
}

function listItemToMarkdown(item: JSONContent): string {
  if (!item.content) return '';
  return item.content.map(child => {
    if (child.type === 'paragraph') {
      return inlineNodesToMarkdown(child.content || []);
    }
    return '';
  }).join(' ');
}

function jsonContentToMarkdown(doc: JSONContent | null): string {
  if (!doc || !doc.content) return '';

  const lines: string[] = [];

  for (const node of doc.content) {
    switch (node.type) {
      case 'heading': {
        const level = node.attrs?.level ?? 1;
        const prefix = '#'.repeat(level);
        const text = inlineNodesToMarkdown(node.content || []);
        lines.push(`${prefix} ${text}`, '');
        break;
      }
      case 'paragraph': {
        const text = inlineNodesToMarkdown(node.content || []);
        lines.push(text, '');
        break;
      }
      case 'bulletList': {
        for (const item of node.content || []) {
          const text = listItemToMarkdown(item);
          lines.push(`- ${text}`);
        }
        lines.push('');
        break;
      }
      case 'orderedList': {
        let idx = 1;
        for (const item of node.content || []) {
          const text = listItemToMarkdown(item);
          lines.push(`${idx}. ${text}`);
          idx++;
        }
        lines.push('');
        break;
      }
      case 'blockquote': {
        const inner = (node.content || []).map(child => {
          if (child.type === 'paragraph') {
            return `> ${inlineNodesToMarkdown(child.content || [])}`;
          }
          return '';
        }).join('\n');
        lines.push(inner, '');
        break;
      }
      case 'horizontalRule':
        lines.push('---', '');
        break;
      default: {
        const text = inlineNodesToMarkdown(node.content || []);
        if (text) lines.push(text, '');
      }
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Export chapters to Markdown format
 */
export async function exportToMarkdown(
  chapters: Chapter[],
  title: string,
  includeHeadings: boolean = true
): Promise<void> {
  const parts: string[] = [`# ${title}`, ''];

  for (const chapter of chapters) {
    if (includeHeadings) {
      parts.push(`## ${chapter.title}`, '');
    }

    const markdown = jsonContentToMarkdown(chapter.content);
    if (markdown) {
      parts.push(markdown, '');
    }
  }

  const output = parts.join('\n').trim();
  downloadFile(output, `${title}.md`, 'text/markdown;charset=utf-8');
}

/**
 * Export chapters to plain text format
 */
export async function exportToPlainText(
  chapters: Chapter[],
  title: string,
  includeHeadings: boolean = true
): Promise<void> {
  const parts: string[] = [title, '='.repeat(title.length), ''];

  for (const chapter of chapters) {
    if (includeHeadings) {
      parts.push(chapter.title, '-'.repeat(chapter.title.length), '');
    }

    const text = editorToPlainText(chapter.content);
    if (text) {
      parts.push(text, '');
    }
  }

  const output = parts.join('\n').trim();
  downloadFile(output, `${title}.txt`, 'text/plain;charset=utf-8');
}
