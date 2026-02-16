import type { JSONContent } from '@tiptap/core';
import type { Chapter, ScreenplayBlockType } from '@/types';
import { editorToPlainText, downloadFile } from './utils';

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
      case 'action':
      default:
        return { text: normalized, style: 'action', margin: [0, 0, 0, 8] };
    }
  });
}

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

  pdfMakeModule.fonts = SCREENPLAY_PDF_FONTS;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [];

  content.push({
    text: title,
    style: 'title',
    margin: [0, 0, 0, 20]
  });

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
      font: 'Helvetica'
    }
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfMake = (await import('pdfmake/build/pdfmake.min.js')) as any;
  const pdfMakeModule = pdfMake.default || pdfMake;

  pdfMakeModule.fonts = SCREENPLAY_PDF_FONTS;

  const content: Array<Record<string, unknown>> = [{
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

  const docDefinition = {
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
 * Build a simple RTF document from plain text without external dependencies.
 * html-to-rtf requires Node.js `fs` module which is unavailable in browsers.
 */
function buildRtf(title: string, chapters: Chapter[], includeHeadings: boolean): string {
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');

  const parts: string[] = [
    '{\\rtf1\\ansi\\deff0',
    '{\\fonttbl{\\f0 Times New Roman;}}',
    '\\f0\\fs24',
    `\\pard\\qc\\b\\fs36 ${escape(title)}\\b0\\fs24\\par\\par`,
  ];

  for (const chapter of chapters) {
    if (includeHeadings) {
      parts.push(`\\pard\\b\\fs28 ${escape(chapter.title)}\\b0\\fs24\\par\\par`);
    }

    const text = editorToPlainText(chapter.content);
    const paragraphs = text.split('\n').filter(p => p.trim());

    for (const para of paragraphs) {
      parts.push(`\\pard ${escape(para)}\\par\\par`);
    }
  }

  parts.push('}');
  return parts.join('\n');
}

/**
 * Export chapters to RTF format
 */
export async function exportToRtf(
  chapters: Chapter[],
  title: string,
  includeHeadings: boolean = true
): Promise<void> {
  const rtf = buildRtf(title, chapters, includeHeadings);
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

