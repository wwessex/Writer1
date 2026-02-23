import type { Chapter } from '@/types';
import { downloadFile } from '@/lib/utils';
import { screenplayChapterToFountain } from './screenplay';

export interface FountainMetadata {
  credit?: string;
  author?: string;
  draftDate?: string;
  source?: string;
}

export interface FountainExportOptions {
  includeSectionTitles?: boolean;
  includeMetadataBlock?: boolean;
  metadata?: FountainMetadata;
  sceneSeparator?: string;
  sectionSeparator?: string;
  filenameConvention?: 'title' | 'title-screenplay' | 'title-fountain';
}

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

      if (!includeSectionTitles || !chapter.title) return chapterBody;
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
