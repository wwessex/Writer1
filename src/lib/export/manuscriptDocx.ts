import type { Chapter, ManuscriptExportOptions } from '@/types';
import { editorToPlainText, downloadFile } from '@/lib/utils';
import { ContentErrors, reportAppError } from '@/lib/errors';
import { cloneDocxTextRun } from './boundary/docxCompat';
import {
  extractTextFromNode,
  extractInlineRuns,
  isSceneBreakLine,
  inchesToTwips,
  ptToHalfPt,
  lineSpacingTo240ths,
} from './shared';
import type { DocxAlignment, DocxSection, DocxClasses } from './types';

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
            underline: run.underline ? { type: 'single' } : undefined,
            strike: run.strike,
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
    void reportAppError(ContentErrors.exportFailed('DOCX', cause), { category: 'export_failure' });
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
