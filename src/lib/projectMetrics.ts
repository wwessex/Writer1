import type { Chapter, ChapterStatus } from '@/types';
import { countWords, editorToPlainText } from '@/lib/utils';

export interface ChapterMetric {
  id: string;
  order: number;
  title: string;
  words: number;
  status: ChapterStatus;
  wordGoal: number;
  updatedAt: number;
}

export interface ProjectMetrics {
  chapters: ChapterMetric[];
  totalWords: number;
  totalChapters: number;
  avgWordsPerChapter: number;
  statusCounts: Record<ChapterStatus, number>;
}

export function buildChapterMetrics(chapters: Chapter[]): ChapterMetric[] {
  return chapters.map(chapter => ({
    id: chapter.id,
    order: chapter.order,
    title: chapter.title,
    words: countWords(editorToPlainText(chapter.content)),
    status: chapter.status,
    wordGoal: chapter.wordGoal,
    updatedAt: chapter.updatedAt,
  }));
}

export function summarizeProjectMetrics(chapterMetrics: ChapterMetric[]): ProjectMetrics {
  const totalWords = chapterMetrics.reduce((sum, chapter) => sum + chapter.words, 0);
  const totalChapters = chapterMetrics.length;

  const statusCounts: Record<ChapterStatus, number> = {
    planned: 0,
    draft: 0,
    revised: 0,
    final: 0,
  };

  for (const chapter of chapterMetrics) {
    statusCounts[chapter.status] += 1;
  }

  return {
    chapters: chapterMetrics,
    totalWords,
    totalChapters,
    avgWordsPerChapter: totalChapters > 0 ? Math.round(totalWords / totalChapters) : 0,
    statusCounts,
  };
}

export function getProjectMetrics(chapters: Chapter[]): ProjectMetrics {
  return summarizeProjectMetrics(buildChapterMetrics(chapters));
}
