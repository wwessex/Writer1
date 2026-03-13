import type { Chapter } from '@/types';
import { downloadFile } from '@/lib/utils';
import type { PublishingBundleOptions } from './types';
import { exportToDocx } from './manuscriptDocx';
import { exportToPdf } from './pdf';
import { exportToRtf } from './rtf';
import { exportToMarkdown } from './markdown';
import { exportToPlainText } from './plaintext';

function buildKdpTemplate(title: string): Record<string, string | string[]> {
  return {
    title,
    subtitle: '',
    seriesName: '',
    editionNumber: '',
    primaryAuthor: '',
    contributors: [],
    language: 'English',
    ageRange: '',
    territories: 'Worldwide',
    releaseDate: '',
    isbn: '',
    categories: [],
    keywords: [],
    pricing: '',
  };
}

export async function exportPublishingBundle(
  chapters: Chapter[],
  title: string,
  options: PublishingBundleOptions,
): Promise<void> {
  const includeHeadings = options.includeHeadings ?? true;
  const manuscriptFormat = options.manuscriptFormat ?? 'docx';

  switch (manuscriptFormat) {
    case 'pdf':
      await exportToPdf(chapters, title, includeHeadings);
      break;
    case 'rtf':
      await exportToRtf(chapters, title, includeHeadings);
      break;
    case 'markdown':
      await exportToMarkdown(chapters, title, includeHeadings);
      break;
    case 'txt':
      await exportToPlainText(chapters, title, includeHeadings);
      break;
    case 'docx':
    default:
      await exportToDocx(chapters, title, includeHeadings);
      break;
  }

  const metadata = {
    projectTitle: title,
    exportedAt: new Date().toISOString(),
    chapterCount: chapters.length,
    ...options.data,
    kdpTemplate: options.includeKdpTemplate ? buildKdpTemplate(title) : undefined,
  };

  const metadataTxt = [
    `Title: ${title}`,
    `Exported: ${metadata.exportedAt}`,
    `Chapter count: ${chapters.length}`,
    '',
    `Book description: ${options.data.bookDescription}`,
    '',
    `Short synopsis: ${options.data.shortSynopsis}`,
    '',
    `Long synopsis: ${options.data.longSynopsis}`,
    '',
    `Author bio (short): ${options.data.authorBioShort}`,
    '',
    `Author bio (long): ${options.data.authorBioLong}`,
    '',
    `Keywords: ${options.data.keywordSuggestions.join(', ')}`,
    `Categories: ${options.data.categorySuggestions.join(', ')}`,
  ];

  if (options.includeKdpTemplate) {
    metadataTxt.push('', 'Amazon KDP Template:', JSON.stringify(buildKdpTemplate(title), null, 2));
  }

  const marketingTxt = [
    '# Back Cover Copy',
    options.data.backCoverCopy,
    '',
    '# Hook Lines',
    ...options.data.hookLines.map((line, idx) => `${idx + 1}. ${line}`),
  ].join('\n');

  downloadFile(JSON.stringify(metadata, null, 2), `${title}.publishing-metadata.json`, 'application/json;charset=utf-8');
  downloadFile(metadataTxt.join('\n'), `${title}.publishing-metadata.txt`, 'text/plain;charset=utf-8');
  downloadFile(marketingTxt, `${title}.marketing-copy.txt`, 'text/plain;charset=utf-8');
}
