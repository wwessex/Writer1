import { describe, expect, it } from 'vitest';
import { analyzeTimelineConsistency } from './timelineConsistency';
import type { Chapter, Scene } from '@/types';

function makeScene(id: string, title: string, summary: string, location?: string): Scene {
  return {
    id,
    title,
    summary,
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 0,
    location,
  };
}

function makeChapter(id: string, order: number, scenes: Scene[]): Chapter {
  return {
    id,
    novelId: 'novel-1',
    order,
    title: `Chapter ${order}`,
    updatedAt: 0,
    content: '',
    summary: '',
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 0,
    scenes,
  };
}

describe('analyzeTimelineConsistency', () => {
  it('flags prerequisite order violations', () => {
    const chapters = [
      makeChapter('c1', 1, [makeScene('s1', 'A', '2025-01-01 10:00 Event: escape after: steal key')]),
      makeChapter('c2', 2, [makeScene('s2', 'B', '2025-01-01 11:00 Event: steal key')]),
    ];

    const result = analyzeTimelineConsistency(chapters);
    expect(result.findings.some(f => f.type === 'prerequisite_order_violation')).toBe(true);
  });

  it('flags age regression contradictions', () => {
    const chapters = [
      makeChapter('c1', 1, [makeScene('s1', 'A', '2025-01-01 Mira is 30 years old.')]),
      makeChapter('c2', 2, [makeScene('s2', 'B', '2025-01-02 Mira is 29 years old.')]),
    ];

    const result = analyzeTimelineConsistency(chapters);
    expect(result.findings.some(f => f.type === 'age_regression')).toBe(true);
  });

  it('flags possession state transition conflicts', () => {
    const chapters = [
      makeChapter('c1', 1, [makeScene('s1', 'A', '2025-01-01 Nora picks up the key.')]),
      makeChapter('c2', 2, [makeScene('s2', 'B', '2025-01-01 12:00 Liam gives the key to Ava.')]),
    ];

    const result = analyzeTimelineConsistency(chapters);
    expect(result.findings.some(f => f.type === 'state_transition_conflict')).toBe(true);
  });

  it('flags travel time violations and overlap conflicts', () => {
    const chapters = [
      makeChapter('c1', 1, [makeScene('s1', 'A', '2025-01-01 08:00 Kai travels from Paris to Berlin in 5 hours', 'Paris')]),
      makeChapter('c2', 2, [makeScene('s2', 'B', '2025-01-01 10:00 Kai travels from Madrid to Rome in 4 hours', 'Rome')]),
    ];

    const result = analyzeTimelineConsistency(chapters);
    expect(result.findings.some(f => f.type === 'travel_time_violation')).toBe(true);
    expect(result.findings.some(f => f.type === 'overlap_conflict')).toBe(true);
  });

  it('keeps coherent timelines free of paradox findings', () => {
    const chapters = [
      makeChapter('c1', 1, [makeScene('s1', 'A', '2025-01-01 08:00 Mira is 30 years old. Event: wake')]),
      makeChapter('c2', 2, [makeScene('s2', 'B', '2025-01-01 14:00 Mira turns 31. Event: celebration after: wake')]),
      makeChapter('c3', 3, [makeScene('s3', 'C', '2025-01-02 10:00 Mira gives the map to Juno. Juno travels from London to York in 2 hours')]),
    ];

    const result = analyzeTimelineConsistency(chapters);
    expect(result.findings).toHaveLength(0);
  });
});
