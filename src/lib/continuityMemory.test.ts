import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildContinuityMemory,
  getContinuityMemorySnapshot,
  formatContinuityContext,
} from './continuityMemory';
import type { Chapter } from '@/types';

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
    updatedAt: 1000,
    content: null,
    summary: '',
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 2000,
    scenes: [],
    ...overrides,
  };
}

describe('continuityMemory', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  describe('buildContinuityMemory', () => {
    it('extracts character age from prose', () => {
      const chapters = [makeChapter({ title: '', content: 'Sarah is 28 years old and lives alone.' })];
      const snapshot = buildContinuityMemory('novel-1', chapters);

      const sarah = snapshot.characters.find(c => c.canonicalName === 'Sarah');
      expect(sarah).toBeDefined();
      expect(sarah!.attributes.age).toBe('28');
    });

    it('detects age conflicts', () => {
      const chapters = [
        makeChapter({ id: 'ch-1', order: 1, content: 'Sarah is 28 years old.' }),
        makeChapter({ id: 'ch-2', order: 2, content: 'Sarah is 32 years old.' }),
      ];
      const snapshot = buildContinuityMemory('novel-1', chapters);

      expect(snapshot.conflicts).toHaveLength(1);
      expect(snapshot.conflicts[0].message).toContain('32');
      expect(snapshot.conflicts[0].message).toContain('28');
    });

    it('extracts names with apostrophes', () => {
      const chapters = [makeChapter({ content: "O'Brien is 45 years old and very stern." })];
      const snapshot = buildContinuityMemory('novel-1', chapters);

      const names = snapshot.characters.map(c => c.canonicalName);
      expect(names.some(n => n.includes("O'Brien") || n.includes("O'brien"))).toBe(true);
    });

    it('detects frequently mentioned proper nouns as characters', () => {
      const text = 'Li walked to the door. Li opened it slowly. Li stared into the darkness. Li whispered a name.';
      const chapters = [makeChapter({ content: text })];
      const snapshot = buildContinuityMemory('novel-1', chapters);

      const names = snapshot.characters.map(c => c.canonicalName);
      expect(names).toContain('Li');
    });

    it('detects hyphenated names via frequency', () => {
      const text = [
        'Jean-Luc stood at the helm.',
        'Jean-Luc gave the order.',
        'Jean-Luc turned to face the crew.',
      ].join(' ');
      const chapters = [makeChapter({ content: text })];
      const snapshot = buildContinuityMemory('novel-1', chapters);

      const names = snapshot.characters.map(c => c.canonicalName);
      expect(names.some(n => n.includes('Jean-Luc'))).toBe(true);
    });

    it('does not register common words as characters', () => {
      const text = 'The door opened. The wind blew. The night was cold. The moon rose.';
      const chapters = [makeChapter({ content: text })];
      const snapshot = buildContinuityMemory('novel-1', chapters);

      const names = snapshot.characters.map(c => c.canonicalName.toLowerCase());
      expect(names).not.toContain('the');
    });

    it('extracts timeline events', () => {
      const chapters = [makeChapter({ content: 'event: The great fire at midnight' })];
      const snapshot = buildContinuityMemory('novel-1', chapters);

      expect(snapshot.timelineEvents).toHaveLength(1);
      expect(snapshot.timelineEvents[0].label).toBe('The great fire');
      expect(snapshot.timelineEvents[0].timestampHint).toBe('midnight');
    });

    it('extracts world rules', () => {
      const chapters = [makeChapter({ content: 'rule: Magic cannot create life.' })];
      const snapshot = buildContinuityMemory('novel-1', chapters);

      expect(snapshot.worldRules.some(r => r.includes('Magic cannot create life'))).toBe(true);
    });

    it('tracks unresolved threads', () => {
      const chapters = [
        makeChapter({ id: 'ch-1', order: 1, content: 'thread: The missing key -> open' }),
        makeChapter({ id: 'ch-2', order: 2, content: 'thread: The stolen map -> open' }),
      ];
      const snapshot = buildContinuityMemory('novel-1', chapters);

      expect(snapshot.unresolvedThreads).toContain('The missing key');
      expect(snapshot.unresolvedThreads).toContain('The stolen map');
    });

    it('removes resolved threads', () => {
      const chapters = [
        makeChapter({ id: 'ch-1', order: 1, content: 'thread: The missing key -> open' }),
        makeChapter({ id: 'ch-2', order: 2, content: 'thread: The missing key -> resolved' }),
      ];
      const snapshot = buildContinuityMemory('novel-1', chapters);

      expect(snapshot.unresolvedThreads).not.toContain('The missing key');
    });
  });

  describe('getContinuityMemorySnapshot caching', () => {
    it('returns cached snapshot when chapters unchanged', () => {
      const chapters = [makeChapter({ updatedAt: 1000 })];

      const first = getContinuityMemorySnapshot('novel-1', chapters);
      expect(mockStorage.has('draftharbour_continuity_memory_novel-1')).toBe(true);

      // Second call with same chapters should use cache
      const second = getContinuityMemorySnapshot('novel-1', chapters);
      expect(second.updatedAt).toBe(first.updatedAt);
    });

    it('rebuilds when chapter updatedAt changes', () => {
      const chapters = [makeChapter({ updatedAt: 1000 })];
      const first = getContinuityMemorySnapshot('novel-1', chapters);

      // Simulate chapter update
      const updatedChapters = [makeChapter({ updatedAt: 2000, content: 'Elena is 25 years old.' })];
      const second = getContinuityMemorySnapshot('novel-1', updatedChapters);

      expect(second.updatedAt).toBe(2000);
      expect(second.updatedAt).not.toBe(first.updatedAt);
    });
  });

  describe('formatContinuityContext', () => {
    it('formats snapshot into readable text', () => {
      const snapshot = buildContinuityMemory('novel-1', [
        makeChapter({ content: 'Sarah is 28 years old.' }),
      ]);

      const text = formatContinuityContext(snapshot);

      expect(text).toContain('Continuity canon:');
      expect(text).toContain('Sarah');
    });
  });
});
