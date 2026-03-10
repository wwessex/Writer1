import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/continuityMemory', () => ({
  getContinuityMemorySnapshot: vi.fn(() => ({
    characters: [{ name: 'Alice' }],
    timelineEvents: [],
    worldRules: [{ rule: 'magic exists' }],
    unresolvedThreads: [],
    conflicts: [],
  })),
}));

import type { Chapter } from '@/types';
import {
  buildChapterMetrics,
  summarizeProjectMetrics,
  getProjectMetrics,
  calculateSceneSimulationMetrics,
  buildProjectHeuristicInsights,
} from './projectMetrics';

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'ch-1',
    novelId: 'n-1',
    order: 0,
    title: 'Test Chapter',
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world. This is a test sentence.' }] },
      ],
    },
    updatedAt: Date.now(),
    summary: '',
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 500,
    scenes: [],
    ...overrides,
  };
}

describe('projectMetrics', () => {
  describe('buildChapterMetrics', () => {
    it('computes word, sentence, paragraph counts from chapter content', () => {
      const metrics = buildChapterMetrics([makeChapter()]);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].words).toBeGreaterThan(0);
      expect(metrics[0].sentences).toBeGreaterThan(0);
      expect(metrics[0].paragraphs).toBeGreaterThan(0);
      expect(metrics[0].status).toBe('draft');
      expect(metrics[0].title).toBe('Test Chapter');
    });

    it('handles null content', () => {
      const metrics = buildChapterMetrics([makeChapter({ content: null })]);
      expect(metrics[0].words).toBe(0);
    });

    it('handles empty chapters array', () => {
      expect(buildChapterMetrics([])).toEqual([]);
    });
  });

  describe('summarizeProjectMetrics', () => {
    it('aggregates chapter metrics', () => {
      const chapterMetrics = buildChapterMetrics([
        makeChapter({ id: 'ch-1', status: 'draft' }),
        makeChapter({ id: 'ch-2', status: 'final' }),
      ]);
      const summary = summarizeProjectMetrics(chapterMetrics);
      expect(summary.totalChapters).toBe(2);
      expect(summary.totalWords).toBeGreaterThan(0);
      expect(summary.avgWordsPerChapter).toBeGreaterThan(0);
      expect(summary.statusCounts.draft).toBe(1);
      expect(summary.statusCounts.final).toBe(1);
      expect(summary.statusCounts.planned).toBe(0);
      expect(summary.statusCounts.revised).toBe(0);
    });

    it('returns zero averages for empty input', () => {
      const summary = summarizeProjectMetrics([]);
      expect(summary.totalChapters).toBe(0);
      expect(summary.avgWordsPerChapter).toBe(0);
    });
  });

  describe('getProjectMetrics', () => {
    it('returns base metrics without novelId', () => {
      const result = getProjectMetrics([makeChapter()]);
      expect(result.totalChapters).toBe(1);
      expect(result.continuity.characterCount).toBe(0);
    });

    it('includes continuity metrics with novelId', () => {
      const result = getProjectMetrics([makeChapter()], 'novel-1');
      expect(result.continuity.characterCount).toBe(1);
      expect(result.continuity.worldRuleCount).toBe(1);
    });
  });

  describe('calculateSceneSimulationMetrics', () => {
    it('computes delta between baseline and simulated', () => {
      const result = calculateSceneSimulationMetrics(
        { tension: 50, readability: 70, thematicAlignment: 60 },
        { tension: 65, readability: 75, thematicAlignment: 55 },
      );
      expect(result.delta.tension).toBe(15);
      expect(result.delta.readability).toBe(5);
      expect(result.delta.thematicAlignment).toBe(-5);
    });

    it('rounds values to one decimal place', () => {
      const result = calculateSceneSimulationMetrics(
        { tension: 33.333, readability: 66.666, thematicAlignment: 0 },
        { tension: 33.333, readability: 66.666, thematicAlignment: 0 },
      );
      expect(result.baseline.tension).toBe(33.3);
      expect(result.baseline.readability).toBe(66.7);
      expect(result.delta.tension).toBe(0);
    });
  });

  describe('buildProjectHeuristicInsights', () => {
    it('returns insights for each chapter', () => {
      const chapters = [
        makeChapter({ id: 'ch-1', title: 'First' }),
        makeChapter({ id: 'ch-2', title: 'Second', order: 1 }),
      ];
      const insights = buildProjectHeuristicInsights(chapters);
      expect(insights).toHaveLength(2);
      expect(insights[0].chapterId).toBe('ch-1');
      expect(insights[1].chapterId).toBe('ch-2');
    });

    it('includes all five heuristic scores', () => {
      const insights = buildProjectHeuristicInsights([makeChapter()]);
      const scores = insights[0].scores;
      expect(scores).toHaveProperty('openingHookStrength');
      expect(scores).toHaveProperty('chapterTensionCurve');
      expect(scores).toHaveProperty('genreConventionCoverage');
      expect(scores).toHaveProperty('readabilityByAudienceTarget');
      expect(scores).toHaveProperty('pacingConsistency');
      for (const key of Object.keys(scores)) {
        const s = scores[key as keyof typeof scores];
        expect(s.score).toBeGreaterThanOrEqual(0);
        expect(s.score).toBeLessThanOrEqual(100);
        expect(s.confidence).toBeGreaterThan(0);
        expect(s.aiAssisted).toBe(false);
      }
    });

    it('detects genre markers from chapter tags and summary', () => {
      const chapters = [
        makeChapter({
          tags: ['fantasy'],
          summary: 'A kingdom under threat from a dark prophecy and magic',
          content: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The magic of the kingdom was fading. The sword lay broken.' }] }],
          },
        }),
      ];
      const insights = buildProjectHeuristicInsights(chapters);
      expect(insights[0].scores.genreConventionCoverage.score).toBeGreaterThan(25);
    });

    it('adjusts readability score based on audience target', () => {
      const chapters = [makeChapter()];
      const adult = buildProjectHeuristicInsights(chapters, { audienceTarget: 'adult' });
      const mg = buildProjectHeuristicInsights(chapters, { audienceTarget: 'middle-grade' });
      // Different targets should produce different readability scores
      expect(adult[0].scores.readabilityByAudienceTarget.score).not.toBe(mg[0].scores.readabilityByAudienceTarget.score);
    });

    it('blends AI assist scores when provided', () => {
      const chapters = [makeChapter({ id: 'ch-1' })];
      const insights = buildProjectHeuristicInsights(chapters, {
        aiAssist: [{ chapterId: 'ch-1', metric: 'openingHookStrength', score: 90, confidence: 0.9 }],
      });
      expect(insights[0].scores.openingHookStrength.aiAssisted).toBe(true);
    });

    it('generates recommendations for low scores only', () => {
      const insights = buildProjectHeuristicInsights([makeChapter()]);
      for (const rec of insights[0].recommendations) {
        expect(rec.severity).not.toBe('good');
        expect(rec.badge).toBeTruthy();
        expect(rec.quickFixPrompt).toBeTruthy();
      }
    });

    it('handles chapters with empty content', () => {
      const insights = buildProjectHeuristicInsights([makeChapter({ content: null })]);
      expect(insights).toHaveLength(1);
      // Should not throw, scores should be valid numbers
      for (const key of Object.keys(insights[0].scores)) {
        expect(typeof insights[0].scores[key as keyof typeof insights[0]['scores']].score).toBe('number');
      }
    });

    it('handles empty chapters array', () => {
      expect(buildProjectHeuristicInsights([])).toEqual([]);
    });

    it('detects tension words in content', () => {
      const chapters = [makeChapter({
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Danger! The threat was urgent. She was afraid of the fight ahead. Panic set in!' }] }],
        },
      })];
      const insights = buildProjectHeuristicInsights(chapters);
      expect(insights[0].scores.chapterTensionCurve.score).toBeGreaterThan(30);
    });

    it('detects hook words in opening', () => {
      const chapters = [makeChapter({
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Suddenly, before anyone could react, the secret was revealed. Never had there been such a warning. Blood covered the floor.' }] }],
        },
      })];
      const insights = buildProjectHeuristicInsights(chapters);
      expect(insights[0].scores.openingHookStrength.score).toBeGreaterThan(40);
    });
  });
});
