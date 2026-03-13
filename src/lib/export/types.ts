import type { ScreenplayBlockType } from '@/types';

export type PdfAlignment = 'left' | 'right' | 'center' | 'justify';

export type PdfMargin = [number, number, number, number];

export interface PdfContentNode {
  text: string;
  style?: string;
  margin?: PdfMargin;
  alignment?: PdfAlignment;
  bold?: boolean;
  fontSize?: number;
  pageBreak?: 'before' | 'after';
}

export interface PdfHeaderNode {
  text: string;
  alignment: Exclude<PdfAlignment, 'justify'>;
  margin: PdfMargin;
  fontSize: number;
}

export interface PdfStyles {
  [styleName: string]: {
    fontSize?: number;
    bold?: boolean;
    italics?: boolean;
    alignment?: PdfAlignment;
    lineHeight?: number;
  };
}

export interface PdfDocumentDefinition {
  pageSize: 'LETTER' | 'A4';
  pageMargins: PdfMargin;
  content: PdfContentNode[];
  header?: (currentPage: number, pageCount: number) => PdfHeaderNode | null;
  styles: PdfStyles;
  defaultStyle: {
    font: 'Helvetica' | 'Courier';
    lineHeight?: number;
  };
}

export interface PdfMakeApi {
  fonts: Record<string, unknown>;
  createPdf: (definition: PdfDocumentDefinition) => {
    download: (filename: string) => void;
  };
}

export type PdfMakeImport = {
  default?: PdfMakeApi;
} & Partial<PdfMakeApi>;

export type DocxAlignment = string;

export type DocxTextRunCtor = new (options: Record<string, unknown>) => unknown;

export interface DocxTextRunLike {
  root?: [unknown, Record<string, unknown>?];
}

export interface DocxSection {
  properties: Record<string, unknown>;
  children: unknown[];
}

export interface DocxClasses {
  Paragraph: new (options: Record<string, unknown>) => unknown;
  TextRun: DocxTextRunCtor;
  AlignmentType: {
    CENTER: string;
  };
}

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

export interface PublishingBundleData {
  bookDescription: string;
  shortSynopsis: string;
  longSynopsis: string;
  authorBioShort: string;
  authorBioLong: string;
  keywordSuggestions: string[];
  categorySuggestions: string[];
  backCoverCopy: string;
  hookLines: string[];
}

export interface PublishingBundleOptions {
  includeHeadings?: boolean;
  includeKdpTemplate?: boolean;
  manuscriptFormat?: 'docx' | 'pdf' | 'rtf' | 'markdown' | 'txt';
  data: PublishingBundleData;
}
