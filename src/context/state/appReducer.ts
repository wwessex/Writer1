import type { AppSettings, AppState, Chapter, Novel, ProjectType } from '@/types';
import { createDefaultSettings, mergeSettings, type SettingsUpdate } from '@/context/appSettings';

export type AppAction =
  | { type: 'SET_NOVEL'; payload: { novel: Novel; chapters: Chapter[] } }
  | { type: 'SET_PROJECT_TYPE'; payload: ProjectType }
  | { type: 'SET_CHAPTERS'; payload: Chapter[] }
  | { type: 'SET_ACTIVE_CHAPTER'; payload: string | null }
  | { type: 'UPDATE_CHAPTER'; payload: { id: string; updates: Partial<Chapter> } }
  | { type: 'ADD_CHAPTER'; payload: Chapter }
  | { type: 'DELETE_CHAPTER'; payload: string }
  | { type: 'REORDER_CHAPTERS'; payload: string[] }
  | { type: 'SET_NOVEL_TITLE'; payload: string }
  | { type: 'SET_SETTINGS'; payload: SettingsUpdate }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_PAGE_VIEW' }
  | { type: 'SET_THEME'; payload: 'dark' | 'light' | 'high-contrast' }
  | { type: 'TOGGLE_FOCUS_MODE' };

export function createInitialAppState(options?: { isMobile?: boolean; isOnline?: boolean }): AppState {
  const defaultSettings: AppSettings = createDefaultSettings(Boolean(options?.isMobile));

  return {
    projectType: 'book',
    novelId: '',
    novelTitle: 'My Novel',
    chapters: [],
    activeChapterId: null,
    isOnline: options?.isOnline ?? true,
    isSaving: false,
    settings: defaultSettings
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_NOVEL':
      return {
        ...state,
        projectType: action.payload.novel.projectType || 'book',
        novelId: action.payload.novel.id,
        novelTitle: action.payload.novel.title,
        chapters: action.payload.chapters,
        activeChapterId: action.payload.chapters[0]?.id || null
      };

    case 'SET_PROJECT_TYPE':
      return { ...state, projectType: action.payload };

    case 'SET_CHAPTERS':
      return { ...state, chapters: action.payload };

    case 'SET_ACTIVE_CHAPTER':
      return { ...state, activeChapterId: action.payload };

    case 'UPDATE_CHAPTER':
      return {
        ...state,
        chapters: state.chapters.map(ch => (
          ch.id === action.payload.id
            ? { ...ch, ...action.payload.updates }
            : ch
        ))
      };

    case 'ADD_CHAPTER':
      return {
        ...state,
        chapters: [...state.chapters, action.payload],
        activeChapterId: action.payload.id
      };

    case 'DELETE_CHAPTER': {
      const newChapters = state.chapters.filter(ch => ch.id !== action.payload);
      return {
        ...state,
        chapters: newChapters,
        activeChapterId:
          state.activeChapterId === action.payload
            ? newChapters[0]?.id || null
            : state.activeChapterId
      };
    }

    case 'REORDER_CHAPTERS': {
      const orderedChapters = action.payload
        .map((id, index) => {
          const chapter = state.chapters.find(ch => ch.id === id);
          return chapter ? { ...chapter, order: index } : null;
        })
        .filter((ch): ch is Chapter => ch !== null);
      return { ...state, chapters: orderedChapters };
    }

    case 'SET_NOVEL_TITLE':
      return { ...state, novelTitle: action.payload };

    case 'SET_SETTINGS':
      return {
        ...state,
        settings: mergeSettings(state.settings, action.payload)
      };

    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload };

    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        settings: {
          ...state.settings,
          sidebarHidden: !state.settings.sidebarHidden
        }
      };

    case 'TOGGLE_PAGE_VIEW':
      return {
        ...state,
        settings: {
          ...state.settings,
          pageView: !state.settings.pageView
        }
      };

    case 'SET_THEME':
      return {
        ...state,
        settings: { ...state.settings, theme: action.payload }
      };

    case 'TOGGLE_FOCUS_MODE':
      return {
        ...state,
        settings: {
          ...state.settings,
          focusMode: !state.settings.focusMode
        }
      };

    default:
      return state;
  }
}
