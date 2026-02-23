import type { Chapter, ManuscriptExportOptions } from '@/types';
import { editorToPlainText } from '@/lib/utils';
import { SCREENPLAY_PDF_FONTS, isSceneBreakLine } from './shared';
import { screenplayChapterToPdfContent } from './screenplay';
import { loadPdfMake } from './boundary/pdfmake';
import type { PdfAlignment, PdfContentNode, PdfDocumentDefinition, PdfMakeApi } from './types';

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

  if (opts?.includeTitlePage) {
    content.push({ text: '', margin: [0, 180, 0, 0] });
    content.push({ text: title, alignment: 'center', fontSize: fontSizePt, bold: true, margin: [0, 0, 0, 20] });
    content.push({ text: 'by', alignment: 'center', fontSize: fontSizePt, margin: [0, 0, 0, 10] });
    content.push({ text: opts.authorName || 'Author Name', alignment: 'center', fontSize: fontSizePt, margin: [0, 0, 0, 40] });

    const totalWords = chapters.reduce((sum, ch) => sum + editorToPlainText(ch.content).split(/\s+/).filter(w => w.length > 0).length, 0);
    const roundedWords = Math.round(totalWords / 1000) * 1000;
    content.push({ text: `Approx. ${roundedWords.toLocaleString()} words`, alignment: 'center', fontSize: fontSizePt, margin: [0, 100, 0, 0] });
    content.push({ text: '', pageBreak: 'after' });
  } else {
    content.push({ text: title, style: 'title', margin: [0, 0, 0, 20] });
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

    for (const para of editorToPlainText(chapter.content).split('\n')) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      if (isSceneBreakLine(trimmed)) {
        content.push({ text: sceneBreakMarker, alignment: 'center', style: 'body', margin: [0, 10, 0, 10] });
        continue;
      }
      content.push({ text: para, style: 'body', alignment: pdfAlignment, margin: [firstLineIndent, 0, 0, 0] });
    }
  }

  const headerSurname = opts?.headerContent?.authorSurname ?? '';
  const shortTitle = opts?.headerContent?.shortTitle ?? '';
  const headerText = [headerSurname, shortTitle].filter(Boolean).join(' / ');

  const docDefinition: PdfDocumentDefinition = {
    pageSize,
    pageMargins: [marginPt, marginPt, marginPt, marginPt],
    content,
    ...(opts?.pageNumbering || headerText ? {
      header: (currentPage: number) => {
        if (opts?.includeTitlePage && currentPage === 1) return null;
        const parts = [];
        if (headerText) parts.push(headerText);
        if (opts?.pageNumbering) parts.push(String(currentPage));
        return { text: parts.join(' / '), alignment: 'right', margin: [marginPt, marginPt / 2, marginPt, 0], fontSize: fontSizePt - 2 };
      },
    } : {}),
    styles: {
      title: { fontSize: fontSizePt + 12, bold: true },
      heading: { fontSize: fontSizePt + 2, bold: true, alignment: 'center' },
      body: { fontSize: fontSizePt, lineHeight },
    },
    defaultStyle: { font: 'Helvetica' },
  };

  pdfMakeModule.createPdf(docDefinition).download(`${title}.pdf`);
}

export async function exportToScreenplayPdf(chapters: Chapter[], title: string): Promise<void> {
  let pdfMakeModule: PdfMakeApi;
  try {
    pdfMakeModule = await loadPdfMake();
  } catch (cause) {
    throw new Error('Failed to load the PDF export library. Check your connection and try again.', { cause });
  }

  pdfMakeModule.fonts = SCREENPLAY_PDF_FONTS;

  const content: PdfContentNode[] = [{ text: title.toUpperCase(), style: 'title', margin: [0, 0, 0, 20] }];
  for (const chapter of chapters) {
    if (chapter.title) content.push({ text: chapter.title.toUpperCase(), style: 'section', margin: [0, 18, 0, 8] });
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
    defaultStyle: { font: 'Courier', lineHeight: 1 },
  };

  pdfMakeModule.createPdf(docDefinition).download(`${title}.screenplay.pdf`);
}
