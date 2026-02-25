import { describe, expect, it } from 'vitest';
import {
  CHAPTER_STATUSES,
} from './index';
import type {
  Chapter,
  Snapshot,
  AppSettings,
  Scene,
  ChapterStatus,
  Novel,
} from './index';

describe('types/index', () => {
  it('CHAPTER_STATUSES contains expected values', () => {
    expect(CHAPTER_STATUSES).toEqual(['planned', 'draft', 'revised', 'final']);
    expect(CHAPTER_STATUSES).toHaveLength(4);
  });

  it('Chapter type supports the part field', () => {
    const chapter: Partial<Chapter> = {
      id: 'ch-1',
      title: 'Test',
      part: 'Part I',
      status: 'draft',
      tags: ['action'],
    };
    expect(chapter.part).toBe('Part I');
  });

  it('Snapshot type supports the label field', () => {
    const snapshot: Partial<Snapshot> = {
      id: 'snap-1',
      chapterId: 'ch-1',
      createdAt: Date.now(),
      label: 'Auto',
    };
    expect(snapshot.label).toBe('Auto');
  });

  it('AppSettings type supports novelDeadline', () => {
    const settings: Partial<AppSettings> = {
      dailyWordGoal: 500,
      novelWordGoal: 80000,
      novelDeadline: '2026-12-31',
    };
    expect(settings.novelDeadline).toBe('2026-12-31');
  });

  it('ChapterStatus values are valid', () => {
    const statuses: ChapterStatus[] = ['planned', 'draft', 'revised', 'final'];
    expect(statuses).toHaveLength(4);
    statuses.forEach(s => expect(CHAPTER_STATUSES).toContain(s));
  });

  it('Scene type has expected fields', () => {
    const scene: Partial<Scene> = {
      id: 'scene-1',
      title: 'Opening',
      summary: 'The hero arrives',
      status: 'draft',
      pov: 'Alice',
      location: 'Castle',
    };
    expect(scene.location).toBe('Castle');
  });

  it('Novel type has expected fields', () => {
    const novel: Partial<Novel> = {
      id: 'n-1',
      title: 'My Novel',
      projectType: 'book',
    };
    expect(novel.projectType).toBe('book');
  });
});
