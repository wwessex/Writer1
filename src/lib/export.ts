import type { Chapter } from '@/types';
import { editorToPlainText, downloadFile } from './utils';

/**
 * Export chapters to DOCX format
 */
export async function exportToDocx(
  chapters: Chapter[],
  title: string,
  includeHeadings: boolean = true
): Promise<void> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

  const children: InstanceType<typeof Paragraph>[] = [];

  // Title
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE
    })
  );

  // Chapters
  for (const chapter of chapters) {
    if (includeHeadings) {
      children.push(
        new Paragraph({
          text: chapter.title,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        })
      );
    }

    const text = editorToPlainText(chapter.content);
    const paragraphs = text.split('\n').filter(p => p.trim());

    for (const para of paragraphs) {
      children.push(
        new Paragraph({
          children: [new TextRun(para)],
          spacing: { after: 200 }
        })
      );
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children
    }]
  });

  const blob = await Packer.toBlob(doc);
  downloadFile(blob, `${title}.docx`);
}

/**
 * Export chapters to PDF format
 */
export async function exportToPdf(
  chapters: Chapter[],
  title: string,
  includeHeadings: boolean = true
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfMake = (await import('pdfmake/build/pdfmake.min.js')) as any;
  const pdfMakeModule = pdfMake.default || pdfMake;

  // Use built-in fonts
  pdfMakeModule.fonts = {
    Roboto: {
      normal: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/fonts/Roboto/Roboto-Regular.ttf',
      bold: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/fonts/Roboto/Roboto-Medium.ttf',
      italics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/fonts/Roboto/Roboto-Italic.ttf',
      bolditalics: 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/fonts/Roboto/Roboto-MediumItalic.ttf'
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  // Title
  content.push({
    text: title,
    style: 'title',
    margin: [0, 0, 0, 20]
  });

  // Chapters
  for (const chapter of chapters) {
    if (includeHeadings) {
      content.push({
        text: chapter.title,
        style: 'heading',
        margin: [0, 20, 0, 10]
      });
    }

    const text = editorToPlainText(chapter.content);
    const paragraphs = text.split('\n').filter(p => p.trim());

    for (const para of paragraphs) {
      content.push({
        text: para,
        style: 'body',
        margin: [0, 0, 0, 10]
      });
    }
  }

  const docDefinition = {
    content,
    styles: {
      title: {
        fontSize: 24,
        bold: true
      },
      heading: {
        fontSize: 18,
        bold: true
      },
      body: {
        fontSize: 12,
        lineHeight: 1.5
      }
    },
    defaultStyle: {
      font: 'Roboto'
    }
  };

  pdfMakeModule.createPdf(docDefinition).download(`${title}.pdf`);
}

/**
 * Export chapters to RTF format
 */
export async function exportToRtf(
  chapters: Chapter[],
  title: string,
  includeHeadings: boolean = true
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const htmlToRtf = (await import('html-to-rtf')) as any;

  let html = `<h1>${escapeHtml(title)}</h1>`;

  for (const chapter of chapters) {
    if (includeHeadings) {
      html += `<h2>${escapeHtml(chapter.title)}</h2>`;
    }

    const text = editorToPlainText(chapter.content);
    const paragraphs = text.split('\n').filter(p => p.trim());

    for (const para of paragraphs) {
      html += `<p>${escapeHtml(para)}</p>`;
    }
  }

  const converter = htmlToRtf.default || htmlToRtf;
  const rtf = converter.convertHtmlToRtf(html);
  downloadFile(rtf, `${title}.rtf`, 'application/rtf');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
