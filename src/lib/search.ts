import type { Chapter } from '@/types';
import { editorToPlainText } from '@/lib/utils';

export interface ChapterSearchBlob {
  chapterId: string;
  chapterTitle: string;
  plainText: string;
  normalizedText: string;
}

export interface SearchMatchRange {
  start: number;
  end: number;
}

export interface ChapterSearchResult {
  chapterId: string;
  chapterTitle: string;
  snippet: string;
  match: SearchMatchRange;
  score: number;
}

export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildChapterSearchIndex(chapters: Chapter[]): ChapterSearchBlob[] {
  return chapters.map((chapter, index) => {
    const chapterTitle = chapter.title?.trim() || `Chapter ${index + 1}`;
    const plainText = editorToPlainText(chapter.content);

    return {
      chapterId: chapter.id,
      chapterTitle,
      plainText,
      normalizedText: normalizeSearchText(plainText),
    };
  });
}

function buildSnippet(content: string, start: number, end: number, radius: number = 80): string {
  if (!content) return '';
  const snippetStart = Math.max(0, start - radius);
  const snippetEnd = Math.min(content.length, end + radius);
  const prefix = snippetStart > 0 ? '…' : '';
  const suffix = snippetEnd < content.length ? '…' : '';
  return `${prefix}${content.slice(snippetStart, snippetEnd).trim()}${suffix}`;
}

export function findChapterContentMatches(
  blobs: ChapterSearchBlob[],
  rawQuery: string,
  maxResults: number = 30
): ChapterSearchResult[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) return [];

  const results: ChapterSearchResult[] = [];

  for (const blob of blobs) {
    const normalizedTitle = normalizeSearchText(blob.chapterTitle);
    let fromIndex = 0;

    while (results.length < maxResults) {
      const start = blob.normalizedText.indexOf(query, fromIndex);
      if (start === -1) break;
      const end = start + query.length;

      const titleBoost = normalizedTitle.includes(query) ? 12 : 0;
      results.push({
        chapterId: blob.chapterId,
        chapterTitle: blob.chapterTitle,
        snippet: buildSnippet(blob.plainText, start, end),
        match: { start, end },
        score: 40 + titleBoost,
      });

      fromIndex = end;
    }

    if (results.length >= maxResults) {
      break;
    }
  }

  return results.slice(0, maxResults);
}
