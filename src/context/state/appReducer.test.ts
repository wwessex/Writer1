import { describe, expect, it } from 'vitest';
import type { AppState, Chapter, Novel } from '@/types';
import { appReducer, createInitialAppState, type AppAction } from './appReducer';

function createChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'chapter-1',
    novelId: 'novel-1',
    order: 0,
    title: 'Chapter 1',
    updatedAt: Date.now(),
    content: null,
    summary: '',
    pov: '',
    status: 'planned',
    tags: [],
    wordGoal: 0,
    scenes: [],
    ...overrides
  };
}

function createState(): AppState {
  return {
    ...createInitialAppState({ isMobile: false, isOnline: true }),
    novelId: 'novel-1',
    chapters: [createChapter()],
    activeChapterId: 'chapter-1'
  };
}

describe('appReducer', () => {
  it('handles all action types', () => {
    const novel: Novel = { id: 'novel-2', title: 'New', projectType: 'screenplay', updatedAt: Date.now() };
    const chapterA = createChapter({ id: 'a', order: 0 });
    const chapterB = createChapter({ id: 'b', order: 1 });

    const cases: Array<{
      action: AppAction;
      assert: (state: AppState) => void;
      getState?: () => AppState;
    }> = [
      {
        action: { type: 'SET_NOVEL', payload: { novel, chapters: [chapterA] } },
        assert: state => {
          expect(state.projectType).toBe('screenplay');
          expect(state.novelId).toBe('novel-2');
          expect(state.activeChapterId).toBe('a');
        }
      },
      {
        action: { type: 'SET_PROJECT_TYPE', payload: 'book' },
        assert: state => expect(state.projectType).toBe('book')
      },
      {
        action: { type: 'SET_CHAPTERS', payload: [chapterA, chapterB] },
        assert: state => expect(state.chapters).toHaveLength(2)
      },
      {
        action: { type: 'SET_ACTIVE_CHAPTER', payload: 'b' },
        assert: state => expect(state.activeChapterId).toBe('b')
      },
      {
        action: { type: 'UPDATE_CHAPTER', payload: { id: 'chapter-1', updates: { title: 'Updated' } } },
        assert: state => expect(state.chapters[0].title).toBe('Updated')
      },
      {
        action: { type: 'ADD_CHAPTER', payload: chapterB },
        assert: state => {
          expect(state.chapters).toHaveLength(2);
          expect(state.activeChapterId).toBe('b');
        }
      },
      {
        action: { type: 'DELETE_CHAPTER', payload: 'chapter-1' },
        assert: state => expect(state.chapters).toHaveLength(0)
      },
      {
        action: { type: 'REORDER_CHAPTERS', payload: ['b', 'a'] },
        getState: () => ({ ...createState(), chapters: [chapterA, chapterB] }),
        assert: state => {
          expect(state.chapters[0].id).toBe('b');
          expect(state.chapters[0].order).toBe(0);
        }
      },
      {
        action: { type: 'SET_NOVEL_TITLE', payload: 'Renamed' },
        assert: state => expect(state.novelTitle).toBe('Renamed')
      },
      {
        action: { type: 'SET_SETTINGS', payload: { autosaveMs: 999 } },
        assert: state => expect(state.settings.autosaveMs).toBe(999)
      },
      {
        action: { type: 'SET_ONLINE', payload: false },
        assert: state => expect(state.isOnline).toBe(false)
      },
      {
        action: { type: 'SET_SAVING', payload: true },
        assert: state => expect(state.isSaving).toBe(true)
      },
      {
        action: { type: 'TOGGLE_SIDEBAR' },
        getState: () => ({ ...createState(), settings: { ...createState().settings, sidebarHidden: false } }),
        assert: state => expect(state.settings.sidebarHidden).toBe(true)
      },
      {
        action: { type: 'TOGGLE_PAGE_VIEW' },
        getState: () => ({ ...createState(), settings: { ...createState().settings, pageView: false } }),
        assert: state => expect(state.settings.pageView).toBe(true)
      },
      {
        action: { type: 'SET_THEME', payload: 'light' },
        assert: state => expect(state.settings.theme).toBe('light')
      },
      {
        action: { type: 'TOGGLE_FOCUS_MODE' },
        getState: () => ({ ...createState(), settings: { ...createState().settings, focusMode: false } }),
        assert: state => expect(state.settings.focusMode).toBe(true)
      }
    ];

    for (const testCase of cases) {
      const result = appReducer(testCase.getState ? testCase.getState() : createState(), testCase.action);
      testCase.assert(result);
    }
  });

  it('returns default initial state shape', () => {
    const result = createInitialAppState({ isMobile: false, isOnline: false });
    expect(result.novelTitle).toBe('My Novel');
    expect(result.isOnline).toBe(false);
    expect(result.settings).toBeDefined();
  });
});
