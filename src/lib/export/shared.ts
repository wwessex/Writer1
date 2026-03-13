import type { JSONContent } from '@tiptap/core';

export const SCREENPLAY_PDF_FONTS = {
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

export function extractTextFromNode(node: JSONContent | null | undefined): string {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (!node.content?.length) return '';
  return node.content.map(extractTextFromNode).join('');
}

export function isSceneBreakLine(line: string): boolean {
  const trimmed = line.trim();
  return /^(\*\s*){3,}$/.test(trimmed) ||
    /^(-\s*){3,}$/.test(trimmed) ||
    /^(#\s*){3,}$/.test(trimmed) ||
    /^(~\s*){3,}$/.test(trimmed) ||
    trimmed === '#';
}

export function inchesToTwips(inches: number): number {
  return Math.round(inches * 1440);
}

export function ptToHalfPt(pt: number): number {
  return pt * 2;
}

export function lineSpacingTo240ths(spacing: number): number {
  return Math.round(spacing * 240);
}

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export function extractInlineRuns(node: JSONContent | null | undefined): InlineRun[] {
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
