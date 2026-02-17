import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode
} from 'react';
import type { Chapter, Novel, AppSettings, AppState, Scene, ProjectType, SidebarPanelId, SidebarPanelsSettings } from '@/types';
import * as storage from '@/lib/storage';
import { debounce, generateId } from '@/lib/utils';
import { loadSettingsFromStorage, createSettingsEnvelope } from '@/lib/settingsMigration';
import { SETTINGS_STORAGE_KEY } from '@/lib/storageKeys';

// Check if mobile viewport (matches the CSS breakpoint)
const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches;


const BASE_SIDEBAR_PANEL_ORDER: SidebarPanelId[] = ['chapters', 'scenePlanner', 'outline'];

const sidebarPanelsForProjectType = (projectType: ProjectType): SidebarPanelsSettings => ({
  order: projectType === 'screenplay'
    ? ['chapters', 'outline', 'scenePlanner']
    : [...BASE_SIDEBAR_PANEL_ORDER],
  collapsed: {
    chapters: false,
    scenePlanner: false,
    outline: false
  },
  visible: {
    chapters: true,
    scenePlanner: true,
    outline: true
  }
});

const normalizeSidebarPanels = (
  rawPanels: SidebarPanelsSettings | undefined,
  projectType: ProjectType
): SidebarPanelsSettings => {
  const defaults = sidebarPanelsForProjectType(projectType);
  const rawOrder = rawPanels?.order || [];
  const dedupedKnown = rawOrder.filter((id, index): id is SidebarPanelId =>
    BASE_SIDEBAR_PANEL_ORDER.includes(id) && rawOrder.indexOf(id) === index
  );
  const missing = BASE_SIDEBAR_PANEL_ORDER.filter(id => !dedupedKnown.includes(id));

  return {
    order: [...dedupedKnown, ...missing],
    collapsed: {
      ...defaults.collapsed,
      ...rawPanels?.collapsed
    },
    visible: {
      ...defaults.visible,
      ...rawPanels?.visible
    }
  };
};

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
  theme: 'light',
  sidebarHidden: isMobile, // Hidden by default on mobile
  pageView: true,
  focusMode: false,
  quickSwitcherMode: 'chapter',
  typography: {
    fontFamily: 'system',
    fontSize: 16,
    lineHeight: 1.75
  },
  onboardingComplete: false,
  typewriterMode: false,
  sidebarPanels: {}
};

// Initial state
const initialState: AppState = {
  projectType: 'book',
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
  | { type: 'SET_PROJECT_TYPE'; payload: ProjectType }
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

// Chapter order history for undo/redo
const MAX_UNDO_STACK = 20;

// Context type
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  activeChapter: Chapter | null;
  // Actions
  loadNovel: () => Promise<void>;
  loadNovelById: (id: string) => Promise<void>;
  createNewNovel: (title: string, projectType: ProjectType) => Promise<Novel>;
  deleteCurrentNovel: () => Promise<void>;
  createChapter: () => Promise<void>;
  deleteChapter: (id: string) => Promise<void>;
  updateChapter: (id: string, updates: Partial<Chapter>) => void;
  updateChapterImmediate: (id: string, updates: Partial<Chapter>) => Promise<void>;
  setActiveChapter: (id: string) => void;
  reorderChapters: (ids: string[]) => Promise<void>;
  undoReorder: () => Promise<void>;
  redoReorder: () => Promise<void>;
  canUndoReorder: boolean;
  canRedoReorder: boolean;
  updateNovelTitle: (title: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addScene: (chapterId: string, initialData?: Partial<Scene>) => string | undefined;
  updateScene: (chapterId: string, sceneId: string, updates: Partial<Scene>) => void;
  deleteScene: (chapterId: string, sceneId: string) => void;
  reorderScenes: (chapterId: string, sceneIds: string[]) => void;
}

const AppContext = createContext<AppContextType | null>(null);

// Provider component
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Undo/redo stack for chapter reordering
  const reorderUndoStack = useRef<string[][]>([]);
  const reorderRedoStack = useRef<string[][]>([]);

  const runWithSavingState = useCallback(async (operation: () => Promise<void>) => {
    dispatch({ type: 'SET_SAVING', payload: true });
    try {
      await operation();
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  }, []);

  const getChapterById = useCallback((chapterId: string) => {
    return state.chapters.find(chapter => chapter.id === chapterId);
  }, [state.chapters]);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const loadedSettings = loadSettingsFromStorage(localStorage.getItem(SETTINGS_STORAGE_KEY), defaultSettings);
      dispatch({ type: 'SET_SETTINGS', payload: loadedSettings });
    } catch (error) {
      console.error('Failed to load settings:', error);
      dispatch({ type: 'SET_SETTINGS', payload: defaultSettings });
    }
  }, []);


  useEffect(() => {
    const normalizedPanels = normalizeSidebarPanels(state.settings.sidebarPanels, state.projectType);
    const hasDifference =
      JSON.stringify(normalizedPanels.order) !== JSON.stringify(state.settings.sidebarPanels.order) ||
      JSON.stringify(normalizedPanels.collapsed) !== JSON.stringify(state.settings.sidebarPanels.collapsed) ||
      JSON.stringify(normalizedPanels.visible) !== JSON.stringify(state.settings.sidebarPanels.visible);

    if (hasDifference) {
      dispatch({ type: 'SET_SETTINGS', payload: { sidebarPanels: normalizedPanels } });
    }
  }, [state.projectType, state.settings.sidebarPanels]);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(createSettingsEnvelope(state.settings)));
    } catch (error) {
      console.error('Failed to persist settings:', error);
    }
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
      const firstChapter = storage.createChapter(novel.id, 0, undefined, novel.projectType || 'book');
      await storage.addChapter(firstChapter);
      chapters.push(firstChapter);
    }

    dispatch({ type: 'SET_NOVEL', payload: { novel, chapters } });
  }, []);

  // Load a specific novel by ID
  const loadNovelById = useCallback(async (id: string) => {
    const novel = await storage.getNovel(id);
    if (!novel) return;

    const chapters = await storage.getChapters(novel.id);

    if (chapters.length === 0) {
      const firstChapter = storage.createChapter(novel.id, 0, undefined, novel.projectType || 'book');
      await storage.addChapter(firstChapter);
      chapters.push(firstChapter);
    }

    dispatch({ type: 'SET_NOVEL', payload: { novel, chapters } });
  }, []);

  // Create a new novel/project
  const createNewNovel = useCallback(async (title: string, projectType: ProjectType): Promise<Novel> => {
    const novel = await storage.createNovel(title, projectType);
    const firstChapter = storage.createChapter(novel.id, 0, undefined, projectType);
    await storage.addChapter(firstChapter);

    dispatch({ type: 'SET_NOVEL', payload: { novel, chapters: [firstChapter] } });
    return novel;
  }, []);

  // Delete the current novel and switch to another
  const deleteCurrentNovel = useCallback(async () => {
    const currentId = state.novelId;
    await storage.deleteNovel(currentId);

    // Load next available novel or create a new one
    await loadNovel();
  }, [state.novelId, loadNovel]);

  // Debounced save for content updates
  const debouncedSave = useMemo(() => debounce(async (id: string, updates: Partial<Chapter>) => {
    await runWithSavingState(async () => {
      await storage.updateChapter(id, updates);
    });
  }, state.settings.autosaveMs), [state.settings.autosaveMs, runWithSavingState]);

  // Create chapter
  const createChapter = useCallback(async () => {
    const order = state.chapters.length;
    const chapter = storage.createChapter(
      state.novelId,
      order,
      undefined,
      state.projectType
    );
    await storage.addChapter(chapter);
    dispatch({ type: 'ADD_CHAPTER', payload: chapter });
  }, [state.novelId, state.chapters.length, state.projectType]);

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
    await runWithSavingState(async () => {
      await storage.updateChapter(id, updates);
    });
  }, [runWithSavingState]);

  // Set active chapter
  const setActiveChapter = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE_CHAPTER', payload: id });
  }, []);

  // Reorder chapters with undo support
  const reorderChapters = useCallback(async (ids: string[]) => {
    // Save current order to undo stack
    const currentOrder = state.chapters.map(ch => ch.id);
    reorderUndoStack.current.push(currentOrder);
    if (reorderUndoStack.current.length > MAX_UNDO_STACK) {
      reorderUndoStack.current.shift();
    }
    // Clear redo stack on new action
    reorderRedoStack.current = [];

    dispatch({ type: 'REORDER_CHAPTERS', payload: ids });
    await storage.reorderChapters(state.novelId, ids);
  }, [state.novelId, state.chapters]);

  // Undo chapter reorder
  const undoReorder = useCallback(async () => {
    const previousOrder = reorderUndoStack.current.pop();
    if (!previousOrder) return;

    // Save current order to redo stack
    const currentOrder = state.chapters.map(ch => ch.id);
    reorderRedoStack.current.push(currentOrder);

    dispatch({ type: 'REORDER_CHAPTERS', payload: previousOrder });
    await storage.reorderChapters(state.novelId, previousOrder);
  }, [state.novelId, state.chapters]);

  // Redo chapter reorder
  const redoReorder = useCallback(async () => {
    const nextOrder = reorderRedoStack.current.pop();
    if (!nextOrder) return;

    // Save current order to undo stack
    const currentOrder = state.chapters.map(ch => ch.id);
    reorderUndoStack.current.push(currentOrder);

    dispatch({ type: 'REORDER_CHAPTERS', payload: nextOrder });
    await storage.reorderChapters(state.novelId, nextOrder);
  }, [state.novelId, state.chapters]);

  // Update novel title
  const updateNovelTitle = useCallback((title: string) => {
    dispatch({ type: 'SET_NOVEL_TITLE', payload: title });
    storage.updateNovel(state.novelId, { title });
  }, [state.novelId]);

  // Update settings
  const updateSettings = useCallback((settings: Partial<AppSettings>) => {
    dispatch({ type: 'SET_SETTINGS', payload: settings });
  }, []);

  // Add scene to chapter (optionally with initial data for templates)
  const addScene = useCallback((chapterId: string, initialData?: Partial<Scene>): string | undefined => {
    const chapter = getChapterById(chapterId);
    if (!chapter) return undefined;

    const existingScenes = chapter.scenes || [];
    const baseScene: Scene = state.projectType === 'screenplay'
      ? {
        id: generateId(),
        title: `Scene ${existingScenes.length + 1}`,
        summary: '',
        pov: '',
        status: 'draft',
        tags: ['slugLine', 'action', 'characterCue', 'parenthetical', 'dialogue'],
        wordGoal: 0,
        slugLine: '',
        location: '',
        interiorExterior: 'INT',
        timeOfDay: 'DAY',
        pageEstimate: 1,
        productionTags: []
      }
      : {
        id: generateId(),
        title: `Scene ${existingScenes.length + 1}`,
        summary: '',
        pov: '',
        status: 'planned',
        tags: [],
        wordGoal: 0
      };

    const newScene: Scene = initialData ? { ...baseScene, ...initialData } : baseScene;

    const updates = { scenes: [...existingScenes, newScene] };
    dispatch({ type: 'UPDATE_CHAPTER', payload: { id: chapterId, updates } });
    storage.updateChapter(chapterId, updates);
    return newScene.id;
  }, [getChapterById, state.projectType]);

  // Update scene
  const updateScene = useCallback((chapterId: string, sceneId: string, updates: Partial<Scene>) => {
    const chapter = getChapterById(chapterId);
    if (!chapter) return;

    const scenes = (chapter.scenes || []).map(scene =>
      scene.id === sceneId ? { ...scene, ...updates } : scene
    );

    dispatch({ type: 'UPDATE_CHAPTER', payload: { id: chapterId, updates: { scenes } } });
    storage.updateChapter(chapterId, { scenes });
  }, [getChapterById]);

  // Delete scene
  const deleteScene = useCallback((chapterId: string, sceneId: string) => {
    const chapter = getChapterById(chapterId);
    if (!chapter) return;

    const scenes = (chapter.scenes || []).filter(scene => scene.id !== sceneId);
    dispatch({ type: 'UPDATE_CHAPTER', payload: { id: chapterId, updates: { scenes } } });
    storage.updateChapter(chapterId, { scenes });
  }, [getChapterById]);

  // Reorder scenes within a chapter
  const reorderScenes = useCallback((chapterId: string, sceneIds: string[]) => {
    const chapter = getChapterById(chapterId);
    if (!chapter) return;

    const scenes = sceneIds
      .map(id => (chapter.scenes || []).find(s => s.id === id))
      .filter((s): s is Scene => s !== null && s !== undefined);

    dispatch({ type: 'UPDATE_CHAPTER', payload: { id: chapterId, updates: { scenes } } });
    storage.updateChapter(chapterId, { scenes });
  }, [getChapterById]);

  // Get active chapter
  const activeChapter = state.chapters.find(ch => ch.id === state.activeChapterId) || null;

  const value: AppContextType = {
    state,
    dispatch,
    activeChapter,
    loadNovel,
    loadNovelById,
    createNewNovel,
    deleteCurrentNovel,
    createChapter,
    deleteChapter,
    updateChapter,
    updateChapterImmediate,
    setActiveChapter,
    reorderChapters,
    undoReorder,
    redoReorder,
    canUndoReorder: reorderUndoStack.current.length > 0,
    canRedoReorder: reorderRedoStack.current.length > 0,
    updateNovelTitle,
    updateSettings,
    addScene,
    updateScene,
    deleteScene,
    reorderScenes
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
