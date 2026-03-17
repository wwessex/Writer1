import { markdownToPlainText } from '@/lib/editor/markdownParser';

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

export function extractTextFromNode(content: string | null | undefined): string {
  if (!content) return '';
  return markdownToPlainText(content);
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
