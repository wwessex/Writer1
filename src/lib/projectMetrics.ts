import type { Chapter, ChapterStatus } from '@/types';
import { countWords, countSentences, countParagraphs, countCharacters, editorToPlainText } from '@/lib/utils';
import { getContinuityMemorySnapshot } from '@/lib/continuityMemory';

export interface ChapterMetric {
  id: string;
  order: number;
  title: string;
  words: number;
  sentences: number;
  paragraphs: number;
  characters: number;
  status: ChapterStatus;
  wordGoal: number;
  updatedAt: number;
}

export interface ContinuityHealthMetrics {
  characterCount: number;
  timelineEventCount: number;
  worldRuleCount: number;
  unresolvedThreadCount: number;
  conflictCount: number;
}

export interface ProjectMetrics {
  chapters: ChapterMetric[];
  totalWords: number;
  totalSentences: number;
  totalParagraphs: number;
  totalCharacters: number;
  totalChapters: number;
  avgWordsPerChapter: number;
  statusCounts: Record<ChapterStatus, number>;
  continuity: ContinuityHealthMetrics;
}

export function buildChapterMetrics(chapters: Chapter[]): ChapterMetric[] {
  return chapters.map(chapter => {
    const text = editorToPlainText(chapter.content);
    return {
      id: chapter.id,
      order: chapter.order,
      title: chapter.title,
      words: countWords(text),
      sentences: countSentences(text),
      paragraphs: countParagraphs(text),
      characters: countCharacters(text),
      status: chapter.status,
      wordGoal: chapter.wordGoal,
      updatedAt: chapter.updatedAt,
    };
  });
}

export function summarizeProjectMetrics(chapterMetrics: ChapterMetric[]): ProjectMetrics {
  const totalWords = chapterMetrics.reduce((sum, chapter) => sum + chapter.words, 0);
  const totalSentences = chapterMetrics.reduce((sum, chapter) => sum + chapter.sentences, 0);
  const totalParagraphs = chapterMetrics.reduce((sum, chapter) => sum + chapter.paragraphs, 0);
  const totalCharacters = chapterMetrics.reduce((sum, chapter) => sum + chapter.characters, 0);
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
    totalSentences,
    totalParagraphs,
    totalCharacters,
    totalChapters,
    avgWordsPerChapter: totalChapters > 0 ? Math.round(totalWords / totalChapters) : 0,
    statusCounts,
    continuity: {
      characterCount: 0,
      timelineEventCount: 0,
      worldRuleCount: 0,
      unresolvedThreadCount: 0,
      conflictCount: 0,
    },
  };
}

export function getProjectMetrics(chapters: Chapter[], novelId = ''): ProjectMetrics {
  const base = summarizeProjectMetrics(buildChapterMetrics(chapters));
  if (!novelId) return base;

  const continuity = getContinuityMemorySnapshot(novelId, chapters);
  return {
    ...base,
    continuity: {
      characterCount: continuity.characters.length,
      timelineEventCount: continuity.timelineEvents.length,
      worldRuleCount: continuity.worldRules.length,
      unresolvedThreadCount: continuity.unresolvedThreads.length,
      conflictCount: continuity.conflicts.length,
    },
  };
}


export interface SceneSimulationMetricsDelta {
  baseline: {
    tension: number;
    readability: number;
    thematicAlignment: number;
  };
  simulated: {
    tension: number;
    readability: number;
    thematicAlignment: number;
  };
  delta: {
    tension: number;
    readability: number;
    thematicAlignment: number;
  };
}

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateSceneSimulationMetrics(
  baseline: { tension: number; readability: number; thematicAlignment: number },
  simulated: { tension: number; readability: number; thematicAlignment: number },
): SceneSimulationMetricsDelta {
  return {
    baseline: {
      tension: roundMetric(baseline.tension),
      readability: roundMetric(baseline.readability),
      thematicAlignment: roundMetric(baseline.thematicAlignment),
    },
    simulated: {
      tension: roundMetric(simulated.tension),
      readability: roundMetric(simulated.readability),
      thematicAlignment: roundMetric(simulated.thematicAlignment),
    },
    delta: {
      tension: roundMetric(simulated.tension - baseline.tension),
      readability: roundMetric(simulated.readability - baseline.readability),
      thematicAlignment: roundMetric(simulated.thematicAlignment - baseline.thematicAlignment),
    },
  };
}
