import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  assembleStoryBibleContext,
  formatStoryBibleForPrompt,
  loadCharacterBibleEntities,
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

  describe('loadCharacterBibleEntities', () => {
    it('returns empty array when no data stored', () => {
      expect(loadCharacterBibleEntities('novel-1')).toEqual([]);
    });

    it('loads characters and maps to StoryBibleEntity format', () => {
      mockStorage.set('draftharbour_characters', JSON.stringify([
        {
          id: 'char-1', novelId: 'novel-1', name: 'Elena', aliases: ['Lena'],
          description: 'A brave detective', role: 'protagonist', traits: ['courageous', 'clever'],
          notes: '', relationships: [], createdAt: 1, updatedAt: 1,
        },
      ]));

      const entities = loadCharacterBibleEntities('novel-1');

      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Elena');
      expect(entities[0].type).toBe('character');
      expect(entities[0].description).toContain('brave detective');
      expect(entities[0].description).toContain('protagonist');
      expect(entities[0].description).toContain('courageous');
      expect(entities[0].triggerKeywords).toContain('elena');
      expect(entities[0].triggerKeywords).toContain('lena');
    });

    it('loads world entries and maps to StoryBibleEntity format', () => {
      mockStorage.set('draftharbour_world', JSON.stringify([
        {
          id: 'world-1', novelId: 'novel-1', category: 'location', name: 'The Castle',
          description: 'An ancient fortress', tags: ['medieval', 'stone'],
          linkedCharacters: [], notes: '', createdAt: 1, updatedAt: 1,
        },
      ]));

      const entities = loadCharacterBibleEntities('novel-1');

      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('The Castle');
      expect(entities[0].type).toBe('location');
      expect(entities[0].triggerKeywords).toContain('the castle');
      expect(entities[0].triggerKeywords).toContain('medieval');
    });

    it('filters by novelId', () => {
      mockStorage.set('draftharbour_characters', JSON.stringify([
        { id: 'c1', novelId: 'novel-1', name: 'A', aliases: [], description: '', role: 'other', traits: [], notes: '', relationships: [], createdAt: 1, updatedAt: 1 },
        { id: 'c2', novelId: 'novel-2', name: 'B', aliases: [], description: '', role: 'other', traits: [], notes: '', relationships: [], createdAt: 1, updatedAt: 1 },
      ]));

      const entities = loadCharacterBibleEntities('novel-1');
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('A');
    });
  });

  describe('assembleStoryBibleContext with Character Bible', () => {
    it('includes Character Bible entities in assembled context', () => {
      mockStorage.set('draftharbour_characters', JSON.stringify([
        {
          id: 'char-1', novelId: 'novel-1', name: 'Elena', aliases: [],
          description: 'Protagonist', role: 'protagonist', traits: [],
          notes: '', relationships: [], createdAt: 1, updatedAt: 1,
        },
      ]));

      const chapters = [makeChapter()];
      const context = assembleStoryBibleContext('novel-1', chapters, 'ch-1', null);

      const names = context.entities.map(e => e.name);
      expect(names).toContain('Elena');
    });

    it('deduplicates Character Bible entities with continuity entities', () => {
      mockStorage.set('draftharbour_characters', JSON.stringify([
        {
          id: 'char-1', novelId: 'novel-1', name: 'Sarah', aliases: [],
          description: 'Protagonist', role: 'protagonist', traits: [],
          notes: '', relationships: [], createdAt: 1, updatedAt: 1,
        },
      ]));

      const chapters = [makeChapter()];
      const snapshot = makeContinuitySnapshot(); // Also has Sarah
      const context = assembleStoryBibleContext('novel-1', chapters, 'ch-1', snapshot);

      const sarahEntities = context.entities.filter(e => e.name.toLowerCase() === 'sarah');
      expect(sarahEntities).toHaveLength(1);
    });
  });
});
