import type { Chapter, ChapterStatus } from '@/types';
import { analyzeText, countWords, countSentences, countParagraphs, editorToPlainText } from '@/lib/utils';
import { getContinuityMemorySnapshot } from '@/lib/continuityMemory';

export type HeuristicMetricKey =
  | 'openingHookStrength'
  | 'chapterTensionCurve'
  | 'genreConventionCoverage'
  | 'readabilityByAudienceTarget'
  | 'pacingConsistency';

export interface ChapterHeuristicScore {
  score: number;
  confidence: number;
  reasons: string[];
  aiAssisted: boolean;
}

export interface ChapterHeuristicRecommendation {
  metric: HeuristicMetricKey;
  severity: 'good' | 'watch' | 'fix';
  badge: string;
  summary: string;
  quickFixPrompt: string;
}

export interface ChapterHeuristicInsights {
  chapterId: string;
  chapterTitle: string;
  scores: Record<HeuristicMetricKey, ChapterHeuristicScore>;
  recommendations: ChapterHeuristicRecommendation[];
}

export interface AIScoreAssist {
  chapterId: string;
  metric: HeuristicMetricKey;
  score: number;
  confidence?: number;
  note?: string;
}

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
    const stats = analyzeText(text);
    return {
      id: chapter.id,
      order: chapter.order,
      title: chapter.title,
      words: stats.wordCount,
      sentences: stats.sentenceCount,
      paragraphs: stats.paragraphCount,
      characters: stats.characterCount,
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

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function blendHeuristicWithAI(heuristic: number, ai?: { score: number; confidence?: number }): { score: number; aiAssisted: boolean; confidence: number } {
  if (!ai) {
    return { score: clampScore(heuristic), aiAssisted: false, confidence: 0.72 };
  }

  const aiConfidence = Math.max(0.25, Math.min(0.95, ai.confidence ?? 0.7));
  const aiWeight = 0.2 + aiConfidence * 0.45;
  const score = clampScore(heuristic * (1 - aiWeight) + ai.score * aiWeight);
  return { score, aiAssisted: true, confidence: Math.round((0.65 + aiConfidence * 0.3) * 100) / 100 };
}

const HOOK_WORDS = ['suddenly', 'before', 'first', 'never', 'immediately', 'when', 'warning', 'blood', 'fire', 'secret'];
const TENSION_WORDS = ['threat', 'danger', 'afraid', 'panic', 'fight', 'chase', 'betray', 'risk', 'deadline', 'urgent'];
const GENRE_MARKERS: Record<string, string[]> = {
  fantasy: ['magic', 'kingdom', 'sword', 'prophecy', 'dragon'],
  mystery: ['clue', 'murder', 'investigate', 'suspect', 'alibi'],
  romance: ['kiss', 'longing', 'heart', 'desire', 'chemistry'],
  thriller: ['conspiracy', 'pursuit', 'explosion', 'surveillance', 'hunt'],
  scifi: ['ship', 'orbit', 'ai', 'protocol', 'quantum'],
};

function countMatches(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  return words.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
}

function inferGenre(chapters: Chapter[]): keyof typeof GENRE_MARKERS | null {
  const corpus = chapters.map(ch => `${ch.title} ${(ch.tags || []).join(' ')} ${ch.summary || ''}`).join(' ').toLowerCase();
  let best: keyof typeof GENRE_MARKERS | null = null;
  let bestHits = 0;
  (Object.keys(GENRE_MARKERS) as Array<keyof typeof GENRE_MARKERS>).forEach((genre) => {
    const hits = countMatches(corpus, GENRE_MARKERS[genre]);
    if (hits > bestHits) {
      bestHits = hits;
      best = genre;
    }
  });
  return best;
}

export function buildProjectHeuristicInsights(
  chapters: Chapter[],
  options?: { audienceTarget?: 'middle-grade' | 'ya' | 'adult'; aiAssist?: AIScoreAssist[] }
): ChapterHeuristicInsights[] {
  const audienceTarget = options?.audienceTarget ?? 'adult';
  const aiAssistByKey = new Map((options?.aiAssist || []).map(entry => [`${entry.chapterId}:${entry.metric}`, entry]));
  const genre = inferGenre(chapters);

  const baselinePace = chapters.length > 0
    ? chapters.reduce((sum, ch) => {
      const text = editorToPlainText(ch.content);
      const words = countWords(text);
      const sentences = Math.max(1, countSentences(text));
      return sum + words / sentences;
    }, 0) / chapters.length
    : 0;

  return chapters.map((chapter, index) => {
    const text = editorToPlainText(chapter.content);
    const wordCount = Math.max(1, countWords(text));
    const sentences = Math.max(1, countSentences(text));
    const avgSentence = wordCount / sentences;
    const paragraphCount = Math.max(1, countParagraphs(text));

    const openingSlice = text.split(/[.!?]/).slice(0, 3).join(' ');
    const hookDensity = countMatches(openingSlice, HOOK_WORDS);
    const openingHeuristic = clampScore(40 + hookDensity * 12 + Math.min(30, openingSlice.length / 8));

    const tensionHits = countMatches(text, TENSION_WORDS);
    const exclamationHits = (text.match(/!/g) || []).length;
    const tensionCurveHeuristic = clampScore(30 + (tensionHits * 5) + (exclamationHits * 2) + Math.min(25, paragraphCount * 1.5));

    const genreCoverageHeuristic = clampScore(
      genre
        ? 25 + (countMatches(`${chapter.title} ${chapter.summary || ''} ${(chapter.tags || []).join(' ')} ${text}`, GENRE_MARKERS[genre]) * 14)
        : 55
    );

    const targetSentence = audienceTarget === 'middle-grade' ? 12 : audienceTarget === 'ya' ? 16 : 20;
    const readabilityGap = Math.abs(avgSentence - targetSentence);
    const readabilityHeuristic = clampScore(96 - readabilityGap * 5);

    const chapterPace = wordCount / sentences;
    const paceGap = Math.abs(chapterPace - baselinePace);
    const pacingHeuristic = clampScore(92 - paceGap * 4 - Math.max(0, index - 1) * 0.5);

    const scoreFor = (metric: HeuristicMetricKey, heuristic: number, reasons: string[]): ChapterHeuristicScore => {
      const blended = blendHeuristicWithAI(heuristic, aiAssistByKey.get(`${chapter.id}:${metric}`));
      return {
        score: blended.score,
        confidence: blended.confidence,
        reasons,
        aiAssisted: blended.aiAssisted,
      };
    };

    const scores: Record<HeuristicMetricKey, ChapterHeuristicScore> = {
      openingHookStrength: scoreFor('openingHookStrength', openingHeuristic, [
        `Opening paragraph contains ${hookDensity} hook marker${hookDensity === 1 ? '' : 's'}.`,
        'First lines are weighted for stakes, motion, and curiosity.',
      ]),
      chapterTensionCurve: scoreFor('chapterTensionCurve', tensionCurveHeuristic, [
        `Detected ${tensionHits} tension tokens and ${exclamationHits} urgency punctuation marks.`,
        'Chapter shape rewards escalation across paragraphs.',
      ]),
      genreConventionCoverage: scoreFor('genreConventionCoverage', genreCoverageHeuristic, [
        genre ? `Inferred genre: ${genre}.` : 'Genre markers are mixed; using neutral baseline.',
        'Score favors alignment with expected motifs and scene framing.',
      ]),
      readabilityByAudienceTarget: scoreFor('readabilityByAudienceTarget', readabilityHeuristic, [
        `Average sentence length is ${Math.round(avgSentence * 10) / 10} words (target: ${targetSentence}).`,
        'Shorter and clearer syntax improves accessibility for broader audiences.',
      ]),
      pacingConsistency: scoreFor('pacingConsistency', pacingHeuristic, [
        `Pacing delta vs project baseline: ${Math.round(paceGap * 10) / 10} words/sentence.`,
        'Score tracks rhythm consistency while still allowing intentional variation.',
      ]),
    };

    const metricConfig: Array<{ key: HeuristicMetricKey; badge: string; improvement: string }> = [
      { key: 'openingHookStrength', badge: 'Hook', improvement: 'Rewrite the opening so the first 2-3 lines establish an immediate question, conflict, or emotional hook.' },
      { key: 'chapterTensionCurve', badge: 'Tension', improvement: 'Restructure this chapter into escalating beats: setup, pressure, and a sharper end-of-chapter turn.' },
      { key: 'genreConventionCoverage', badge: 'Genre', improvement: 'Add genre-specific cues and imagery while preserving originality and character voice.' },
      { key: 'readabilityByAudienceTarget', badge: 'Readability', improvement: `Edit this chapter for ${audienceTarget} readability using clearer sentence structure and simpler transitions.` },
      { key: 'pacingConsistency', badge: 'Pacing', improvement: 'Adjust pacing by balancing sentence length and dialogue to align with nearby chapters.' },
    ];

    const recommendations: ChapterHeuristicRecommendation[] = metricConfig
      .map(cfg => {
        const score = scores[cfg.key].score;
        const severity: ChapterHeuristicRecommendation['severity'] = score >= 75 ? 'good' : score >= 55 ? 'watch' : 'fix';
        return {
          metric: cfg.key,
          severity,
          badge: `${cfg.badge} ${score}`,
          summary: severity === 'good' ? `${cfg.badge} is strong.` : severity === 'watch' ? `${cfg.badge} could be sharpened.` : `${cfg.badge} needs revision focus.`,
          quickFixPrompt: `${cfg.improvement}\n\nCurrent chapter: ${chapter.title}\nScore: ${score}/100`,
        };
      })
      .filter(rec => rec.severity !== 'good');

    return {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      scores,
      recommendations,
    };
  });
}
