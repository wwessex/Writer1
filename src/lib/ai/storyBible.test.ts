import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  assembleStoryBibleContext,
  formatStoryBibleForPrompt,
  loadStoryBible,
  saveStoryBible,
} from './storyBible';
import type { ContinuityMemorySnapshot } from '@/lib/continuityMemory';
import type { Chapter } from '@/types';

// Mock localStorage
const mockStorage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
});

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'ch-1',
    novelId: 'novel-1',
    order: 1,
    title: 'Chapter One',
    updatedAt: Date.now(),
    content: null,
    summary: 'Sarah discovers the mysterious letter.',
    pov: 'Sarah',
    status: 'draft',
    tags: [],
    wordGoal: 2000,
    scenes: [],
    ...overrides,
  };
}

function makeContinuitySnapshot(): ContinuityMemorySnapshot {
  return {
    novelId: 'novel-1',
    updatedAt: Date.now(),
    characters: [
      {
        key: 'sarah',
        canonicalName: 'Sarah',
        attributes: { age: '28' },
        relationships: ['sister of Marcus'],
        seenChapterIds: ['ch-1'],
      },
      {
        key: 'marcus',
        canonicalName: 'Marcus',
        attributes: {},
        relationships: ['brother of Sarah'],
        seenChapterIds: ['ch-1'],
      },
    ],
    timelineEvents: [],
    worldRules: [],
    unresolvedThreads: ['The missing key'],
    conflicts: [],
  };
}

describe('storyBible', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  describe('loadStoryBible / saveStoryBible', () => {
    it('returns null when no data stored', () => {
      expect(loadStoryBible('novel-1')).toBeNull();
    });

    it('round-trips save and load', () => {
      const bible = {
        novelId: 'novel-1',
        updatedAt: Date.now(),
        entities: [
          { name: 'Sarah', type: 'character' as const, description: 'Protagonist', triggerKeywords: ['sarah'] },
        ],
        styleNotes: 'Gothic tone',
      };

      saveStoryBible(bible);
      const loaded = loadStoryBible('novel-1');

      expect(loaded).not.toBeNull();
      expect(loaded!.entities).toHaveLength(1);
      expect(loaded!.styleNotes).toBe('Gothic tone');
    });

    it('returns null for mismatched novelId', () => {
      saveStoryBible({
        novelId: 'novel-2',
        updatedAt: Date.now(),
        entities: [],
        styleNotes: '',
      });

      expect(loadStoryBible('novel-1')).toBeNull();
    });
  });

  describe('assembleStoryBibleContext', () => {
    it('extracts entities from continuity snapshot', () => {
      const chapters = [makeChapter()];
      const snapshot = makeContinuitySnapshot();

      const context = assembleStoryBibleContext('novel-1', chapters, 'ch-1', snapshot);

      expect(context.entities.length).toBeGreaterThan(0);
      const names = context.entities.map(e => e.name);
      expect(names).toContain('Sarah');
      expect(names).toContain('Marcus');
    });

    it('includes recent scene summaries', () => {
      const chapters = [
        makeChapter({ id: 'ch-1', order: 1, summary: 'Sarah finds the letter' }),
        makeChapter({ id: 'ch-2', order: 2, summary: 'Marcus arrives' }),
        makeChapter({ id: 'ch-3', order: 3, summary: 'The confrontation' }),
      ];

      const context = assembleStoryBibleContext('novel-1', chapters, 'ch-3', null);

      expect(context.recentSceneSummaries.length).toBeGreaterThan(0);
      expect(context.recentSceneSummaries.some(s => s.includes('Sarah finds the letter'))).toBe(true);
    });

    it('merges stored entities with continuity entities', () => {
      saveStoryBible({
        novelId: 'novel-1',
        updatedAt: Date.now(),
        entities: [
          { name: 'The Mansion', type: 'location', description: 'Old Victorian house', triggerKeywords: ['mansion', 'house'] },
        ],
        styleNotes: 'Dark and brooding',
      });

      const chapters = [makeChapter()];
      const snapshot = makeContinuitySnapshot();

      const context = assembleStoryBibleContext('novel-1', chapters, 'ch-1', snapshot);

      const names = context.entities.map(e => e.name);
      expect(names).toContain('The Mansion');
      expect(context.styleNotes).toBe('Dark and brooding');
    });

    it('respects token budget', () => {
      const chapters = [makeChapter()];
      // Very small budget
      const context = assembleStoryBibleContext('novel-1', chapters, 'ch-1', makeContinuitySnapshot(), 50);

      // The budget should limit how many entities are included
      expect(context.entities.length).toBeLessThanOrEqual(3);
    });
  });

  describe('formatStoryBibleForPrompt', () => {
    it('formats entities and summaries into text', () => {
      const context = {
        entities: [
          { name: 'Sarah', type: 'character' as const, description: 'Protagonist, age 28', triggerKeywords: ['sarah'] },
        ],
        recentSceneSummaries: ['[Chapter One] Sarah discovers the letter'],
        styleNotes: 'Gothic noir',
      };

      const text = formatStoryBibleForPrompt(context);

      expect(text).toContain('Story Bible:');
      expect(text).toContain('Sarah (character): Protagonist, age 28');
      expect(text).toContain('Recent scenes:');
      expect(text).toContain('discovers the letter');
      expect(text).toContain('Style guide: Gothic noir');
    });

    it('handles empty context gracefully', () => {
      const text = formatStoryBibleForPrompt({
        entities: [],
        recentSceneSummaries: [],
        styleNotes: '',
      });

      expect(text).toBe('');
    });
  });
});
