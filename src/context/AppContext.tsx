import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode
} from 'react';
import type { Chapter, Novel, AppSettings, AppState, Scene } from '@/types';
import * as storage from '@/lib/storage';
import { debounce } from '@/lib/utils';

// Check if mobile viewport (matches the CSS breakpoint)
const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches;

// Default settings
const defaultSettings: AppSettings = {
  autosaveMs: 800,
  dailyWordGoal: 0,
  novelWordGoal: 0,
  sync: {
    novelId: '',
    url: '',
    auth: ''
  },
  assist: {
    languageToolEnabled: false,
    languageToolUrl: 'https://api.languagetool.org/v2/check',
    languageToolLanguage: 'en-US'
  },
  theme: 'dark',
  sidebarHidden: isMobile, // Hidden by default on mobile
  pageView: true,
  focusMode: false,
  typography: {
    fontFamily: 'system',
    fontSize: 16,
    lineHeight: 1.75
  },
  onboardingComplete: false
};

// Initial state
const initialState: AppState = {
  novelId: '',
  novelTitle: 'My Novel',
  chapters: [],
  activeChapterId: null,
  isOnline: navigator.onLine,
  isSaving: false,
  settings: defaultSettings
};

// Action types
type AppAction =
  | { type: 'SET_NOVEL'; payload: { novel: Novel; chapters: Chapter[] } }
  | { type: 'SET_CHAPTERS'; payload: Chapter[] }
  | { type: 'SET_ACTIVE_CHAPTER'; payload: string | null }
  | { type: 'UPDATE_CHAPTER'; payload: { id: string; updates: Partial<Chapter> } }
  | { type: 'ADD_CHAPTER'; payload: Chapter }
  | { type: 'DELETE_CHAPTER'; payload: string }
  | { type: 'REORDER_CHAPTERS'; payload: string[] }
  | { type: 'SET_NOVEL_TITLE'; payload: string }
  | { type: 'SET_SETTINGS'; payload: Partial<AppSettings> }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_SAVING'; payload: boolean }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_PAGE_VIEW' }
  | { type: 'SET_THEME'; payload: 'dark' | 'light' | 'high-contrast' }
  | { type: 'TOGGLE_FOCUS_MODE' };

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_NOVEL':
      return {
        ...state,
        novelId: action.payload.novel.id,
        novelTitle: action.payload.novel.title,
        chapters: action.payload.chapters,
        activeChapterId: action.payload.chapters[0]?.id || null
      };

    case 'SET_CHAPTERS':
      return { ...state, chapters: action.payload };

    case 'SET_ACTIVE_CHAPTER':
      return { ...state, activeChapterId: action.payload };

    case 'UPDATE_CHAPTER':
      return {
        ...state,
        chapters: state.chapters.map(ch =>
          ch.id === action.payload.id
            ? { ...ch, ...action.payload.updates }
            : ch
        )
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
        settings: { ...state.settings, ...action.payload }
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

// Context type
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  activeChapter: Chapter | null;
  // Actions
  loadNovel: () => Promise<void>;
  createChapter: () => Promise<void>;
  deleteChapter: (id: string) => Promise<void>;
  updateChapter: (id: string, updates: Partial<Chapter>) => void;
  updateChapterImmediate: (id: string, updates: Partial<Chapter>) => Promise<void>;
  setActiveChapter: (id: string) => void;
  reorderChapters: (ids: string[]) => Promise<void>;
  updateNovelTitle: (title: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addScene: (chapterId: string) => void;
  updateScene: (chapterId: string, sceneId: string, updates: Partial<Scene>) => void;
  deleteScene: (chapterId: string, sceneId: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

// Settings storage key
const SETTINGS_KEY = 'novelwriter_settings_v1';

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        dispatch({ type: 'SET_SETTINGS', payload: settings });
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  }, [state.settings]);

  // Apply theme
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  // Online/offline tracking
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE', payload: true });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE', payload: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load novel
  const loadNovel = useCallback(async () => {
    const novel = await storage.getOrCreateDefaultNovel();
    const chapters = await storage.getChapters(novel.id);

    // Create first chapter if none exist
    if (chapters.length === 0) {
      const firstChapter = storage.createChapter(novel.id, 0);
      await storage.addChapter(firstChapter);
      chapters.push(firstChapter);
    }

    dispatch({ type: 'SET_NOVEL', payload: { novel, chapters } });
  }, []);

  // Debounced save for content updates
  const debouncedSave = useCallback(
    debounce(async (id: string, updates: Partial<Chapter>) => {
      dispatch({ type: 'SET_SAVING', payload: true });
      await storage.updateChapter(id, updates);
      dispatch({ type: 'SET_SAVING', payload: false });
    }, state.settings.autosaveMs),
    [state.settings.autosaveMs]
  );

  // Create chapter
  const createChapter = useCallback(async () => {
    const order = state.chapters.length;
    const chapter = storage.createChapter(state.novelId, order);
    await storage.addChapter(chapter);
    dispatch({ type: 'ADD_CHAPTER', payload: chapter });
  }, [state.novelId, state.chapters.length]);

  // Delete chapter
  const deleteChapter = useCallback(async (id: string) => {
    await storage.deleteChapter(id);
    dispatch({ type: 'DELETE_CHAPTER', payload: id });
  }, []);

  // Update chapter (debounced for content)
  const updateChapter = useCallback((id: string, updates: Partial<Chapter>) => {
    dispatch({ type: 'UPDATE_CHAPTER', payload: { id, updates } });
    debouncedSave(id, updates);
  }, [debouncedSave]);

  // Update chapter immediately (for title, metadata)
  const updateChapterImmediate = useCallback(async (id: string, updates: Partial<Chapter>) => {
    dispatch({ type: 'UPDATE_CHAPTER', payload: { id, updates } });
    dispatch({ type: 'SET_SAVING', payload: true });
    await storage.updateChapter(id, updates);
    dispatch({ type: 'SET_SAVING', payload: false });
  }, []);

  // Set active chapter
  const setActiveChapter = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE_CHAPTER', payload: id });
  }, []);

  // Reorder chapters
  const reorderChapters = useCallback(async (ids: string[]) => {
    dispatch({ type: 'REORDER_CHAPTERS', payload: ids });
    await storage.reorderChapters(state.novelId, ids);
  }, [state.novelId]);

  // Update novel title
  const updateNovelTitle = useCallback((title: string) => {
    dispatch({ type: 'SET_NOVEL_TITLE', payload: title });
    storage.updateNovel(state.novelId, { title });
  }, [state.novelId]);

  // Update settings
  const updateSettings = useCallback((settings: Partial<AppSettings>) => {
    dispatch({ type: 'SET_SETTINGS', payload: settings });
  }, []);

  // Add scene to chapter
  const addScene = useCallback((chapterId: string) => {
    const chapter = state.chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;

    const existingScenes = chapter.scenes || [];
    const newScene: Scene = {
      id: crypto.randomUUID(),
      title: `Scene ${existingScenes.length + 1}`,
      summary: '',
      pov: '',
      status: 'planned',
      tags: [],
      wordGoal: 0
    };

    const updates = { scenes: [...existingScenes, newScene] };
    dispatch({ type: 'UPDATE_CHAPTER', payload: { id: chapterId, updates } });
    storage.updateChapter(chapterId, updates);
  }, [state.chapters]);

  // Update scene
  const updateScene = useCallback((chapterId: string, sceneId: string, updates: Partial<Scene>) => {
    const chapter = state.chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;

    const scenes = (chapter.scenes || []).map(scene =>
      scene.id === sceneId ? { ...scene, ...updates } : scene
    );

    dispatch({ type: 'UPDATE_CHAPTER', payload: { id: chapterId, updates: { scenes } } });
    storage.updateChapter(chapterId, { scenes });
  }, [state.chapters]);

  // Delete scene
  const deleteScene = useCallback((chapterId: string, sceneId: string) => {
    const chapter = state.chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;

    const scenes = (chapter.scenes || []).filter(scene => scene.id !== sceneId);
    dispatch({ type: 'UPDATE_CHAPTER', payload: { id: chapterId, updates: { scenes } } });
    storage.updateChapter(chapterId, { scenes });
  }, [state.chapters]);

  // Get active chapter
  const activeChapter = state.chapters.find(ch => ch.id === state.activeChapterId) || null;

  const value: AppContextType = {
    state,
    dispatch,
    activeChapter,
    loadNovel,
    createChapter,
    deleteChapter,
    updateChapter,
    updateChapterImmediate,
    setActiveChapter,
    reorderChapters,
    updateNovelTitle,
    updateSettings,
    addScene,
    updateScene,
    deleteScene
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
