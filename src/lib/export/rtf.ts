import type { Chapter, ManuscriptExportOptions } from '@/types';
import { editorToPlainText, downloadFile } from '@/lib/utils';
import { isSceneBreakLine } from './shared';

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
