import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  type Dispatch
} from 'react';
import type { Chapter, Novel, Scene, ProjectType, AppSettings, AppState, StoryBlueprint } from '@/types';
import * as storage from '@/lib/storage';
import { debounce, generateId } from '@/lib/utils';
import { createDefaultSettings, normalizeSidebarPanels, type SettingsUpdate } from './appSettings';
import { reportAppError, storageErrorFrom } from '@/lib/errors';
import { useToast } from '@/components/UI';
import { appReducer, createInitialAppState, type AppAction } from './state/appReducer';
import {
  createNovelWithFirstChapter,
  loadDefaultNovelAndChapters,
  loadNovelAndChaptersById,
  persistSettingsToLocalStorage,
  readSettingsFromLocalStorage,
  withSavingDispatch
} from './services/appServices';
import { getWorkspaceStore, setLastOpenedChapter, trackProjectOpen } from './services/workspaceService';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

import { isMobileViewport } from '@/hooks/useIsMobile';

const MAX_UNDO_STACK = 20;
const isMobile = isMobileViewport();

interface AppContextType {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  activeChapter: Chapter | null;
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
  updateSettings: (settings: SettingsUpdate) => void;
  updateStoryBlueprint: (blueprint: StoryBlueprint) => void;
  addScene: (chapterId: string, initialData?: Partial<Scene>) => string | undefined;
  updateScene: (chapterId: string, sceneId: string, updates: Partial<Scene>) => void;
  deleteScene: (chapterId: string, sceneId: string) => void;
  reorderScenes: (chapterId: string, sceneIds: string[]) => void;
}

const AppContext = createContext<AppContextType | null>(null);
const ActiveChapterContext = createContext<Chapter | null>(null);
const SettingsContext = createContext<AppSettings | null>(null);
const SavingStateContext = createContext<boolean | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, createInitialAppState({ isMobile, isOnline: navigator.onLine }));
  const resolvedTheme = useResolvedTheme(state.settings.theme);
  const stateRef = useRef(state);
  const { showErrorToast } = useToast();

  const reorderUndoStack = useRef<string[][]>([]);
  const reorderRedoStack = useRef<string[][]>([]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const reportStorageError = useCallback((context: string, cause: unknown) => {
    console.error(`[storage] ${context}:`, cause);
    const error = storageErrorFrom(cause);
    showErrorToast(error);
    void reportAppError(error, { category: 'storage_failure', context });
  }, [showErrorToast]);

  const runWithSavingState = useCallback(async (operation: () => Promise<void>) => {
    await withSavingDispatch(dispatch, operation);
  }, []);

  useEffect(() => {
    try {
      const fallback = createDefaultSettings(isMobile);
      const loadedSettings = readSettingsFromLocalStorage(fallback);
      dispatch({ type: 'SET_SETTINGS', payload: loadedSettings });
    } catch (error) {
      console.error('Failed to load settings:', error);
      dispatch({ type: 'SET_SETTINGS', payload: createDefaultSettings(isMobile) });
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

  useEffect(() => {
    try {
      persistSettingsToLocalStorage(state.settings);
    } catch (error) {
      console.error('Failed to persist settings:', error);
    }
  }, [state.settings]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

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

  const debouncedSave = useMemo(
    () => debounce(async (id: string, updates: Partial<Chapter>) => {
      try {
        await runWithSavingState(async () => {
          await storage.updateChapter(id, updates);
        });
      } catch (cause) {
        reportStorageError(`autosave chapter(${id})`, cause);
      }
    }, state.settings.autosaveMs),
    [state.settings.autosaveMs, runWithSavingState, reportStorageError]
  );

  const loadNovel = useCallback(async () => {
    const workspace = getWorkspaceStore();
    const recentTargetId = workspace.lastProjectId;
    const result = recentTargetId
      ? await loadNovelAndChaptersById(recentTargetId) ?? await loadDefaultNovelAndChapters()
      : await loadDefaultNovelAndChapters();
    trackProjectOpen(result.novel.id);
    dispatch({ type: 'SET_NOVEL', payload: result });
    dispatch({ type: 'SET_STORY_BLUEPRINT', payload: storage.getStoryBlueprint(result.novel.id) });
    const lastChapterId = workspace.lastOpenedChapterByProject[result.novel.id];
    if (lastChapterId) {
      dispatch({ type: 'SET_ACTIVE_CHAPTER', payload: lastChapterId });
    }
  }, []);

  const loadNovelById = useCallback(async (id: string) => {
    const result = await loadNovelAndChaptersById(id);
    if (!result) return;
    trackProjectOpen(id);
    dispatch({ type: 'SET_NOVEL', payload: result });
    dispatch({ type: 'SET_STORY_BLUEPRINT', payload: storage.getStoryBlueprint(id) });
    const workspace = getWorkspaceStore();
    const lastChapterId = workspace.lastOpenedChapterByProject[id];
    if (lastChapterId) {
      dispatch({ type: 'SET_ACTIVE_CHAPTER', payload: lastChapterId });
    }
  }, []);

  const actions = useMemo(() => ({
    createNewNovel: async (title: string, projectType: ProjectType): Promise<Novel> => {
      const result = await createNovelWithFirstChapter(title, projectType);
      trackProjectOpen(result.novel.id);
      dispatch({ type: 'SET_NOVEL', payload: result });
      dispatch({ type: 'SET_STORY_BLUEPRINT', payload: null });
      return result.novel;
    },

    deleteCurrentNovel: async () => {
      const currentId = stateRef.current.novelId;
      try {
        await storage.deleteNovel(currentId);
      } catch (cause) {
        reportStorageError(`deleteNovel(${currentId})`, cause);
        return;
      }

      const result = await loadDefaultNovelAndChapters();
      dispatch({ type: 'SET_NOVEL', payload: result });
      dispatch({ type: 'SET_STORY_BLUEPRINT', payload: storage.getStoryBlueprint(result.novel.id) });
    },

    createChapter: async () => {
      const currentState = stateRef.current;
      const order = currentState.chapters.length;
      const chapter = storage.createChapter(currentState.novelId, order, undefined, currentState.projectType);
      try {
        await storage.addChapter(chapter);
        dispatch({ type: 'ADD_CHAPTER', payload: chapter });
      } catch (cause) {
        reportStorageError('createChapter', cause);
      }
    },

    deleteChapter: async (id: string) => {
      try {
        await storage.deleteChapter(id);
        dispatch({ type: 'DELETE_CHAPTER', payload: id });
      } catch (cause) {
        reportStorageError(`deleteChapter(${id})`, cause);
      }
    },

    updateChapter: (id: string, updates: Partial<Chapter>) => {
      dispatch({ type: 'UPDATE_CHAPTER', payload: { id, updates } });
      debouncedSave(id, updates);
    },

    updateChapterImmediate: async (id: string, updates: Partial<Chapter>) => {
      dispatch({ type: 'UPDATE_CHAPTER', payload: { id, updates } });
      try {
        await runWithSavingState(async () => {
          await storage.updateChapter(id, updates);
        });
      } catch (cause) {
        reportStorageError(`updateChapterImmediate(${id})`, cause);
      }
    },

    setActiveChapter: (id: string) => {
      // Auto-snapshot the chapter we're leaving (if it has content)
      const currentState = stateRef.current;
      const leavingChapter = currentState.chapters.find(ch => ch.id === currentState.activeChapterId);
      if (leavingChapter?.content && leavingChapter.id !== id) {
        storage.createSnapshot(leavingChapter.id, leavingChapter.content, 'Auto').catch(() => {
          // Non-critical: silently ignore snapshot failures
        });
      }
      setLastOpenedChapter(currentState.novelId, id);
      dispatch({ type: 'SET_ACTIVE_CHAPTER', payload: id });
    },

    reorderChapters: async (ids: string[]) => {
      const currentOrder = stateRef.current.chapters.map(ch => ch.id);
      reorderUndoStack.current.push(currentOrder);
      if (reorderUndoStack.current.length > MAX_UNDO_STACK) {
        reorderUndoStack.current.shift();
      }
      reorderRedoStack.current = [];

      dispatch({ type: 'REORDER_CHAPTERS', payload: ids });
      try {
        await storage.reorderChapters(stateRef.current.novelId, ids);
      } catch (cause) {
        reportStorageError('reorderChapters', cause);
      }
    },

    undoReorder: async () => {
      const previousOrder = reorderUndoStack.current.pop();
      if (!previousOrder) return;

      const currentOrder = stateRef.current.chapters.map(ch => ch.id);
      reorderRedoStack.current.push(currentOrder);

      dispatch({ type: 'REORDER_CHAPTERS', payload: previousOrder });
      try {
        await storage.reorderChapters(stateRef.current.novelId, previousOrder);
      } catch (cause) {
        reportStorageError('undoReorder', cause);
      }
    },

    redoReorder: async () => {
      const nextOrder = reorderRedoStack.current.pop();
      if (!nextOrder) return;

      const currentOrder = stateRef.current.chapters.map(ch => ch.id);
      reorderUndoStack.current.push(currentOrder);

      dispatch({ type: 'REORDER_CHAPTERS', payload: nextOrder });
      try {
        await storage.reorderChapters(stateRef.current.novelId, nextOrder);
      } catch (cause) {
        reportStorageError('redoReorder', cause);
      }
    },

    updateNovelTitle: (title: string) => {
      dispatch({ type: 'SET_NOVEL_TITLE', payload: title });
      storage.updateNovel(stateRef.current.novelId, { title }).catch((cause) => {
        reportStorageError('updateNovelTitle', cause);
      });
    },

    updateSettings: (settings: SettingsUpdate) => {
      dispatch({ type: 'SET_SETTINGS', payload: settings });
    },

    updateStoryBlueprint: (blueprint: StoryBlueprint) => {
      const currentNovelId = stateRef.current.novelId;
      storage.upsertStoryBlueprint(currentNovelId, blueprint);
      dispatch({ type: 'SET_STORY_BLUEPRINT', payload: blueprint });
    },

    addScene: (chapterId: string, initialData?: Partial<Scene>): string | undefined => {
      const chapter = stateRef.current.chapters.find(currentChapter => currentChapter.id === chapterId);
      if (!chapter) return undefined;

      const existingScenes = chapter.scenes || [];
      const baseScene: Scene = stateRef.current.projectType === 'screenplay'
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
      storage.updateChapter(chapterId, updates).catch((cause) => {
        reportStorageError('addScene', cause);
      });

      return newScene.id;
    },

    updateScene: (chapterId: string, sceneId: string, updates: Partial<Scene>) => {
      const chapter = stateRef.current.chapters.find(currentChapter => currentChapter.id === chapterId);
      if (!chapter) return;

      const scenes = (chapter.scenes || []).map(scene => (
        scene.id === sceneId ? { ...scene, ...updates } : scene
      ));

      dispatch({ type: 'UPDATE_CHAPTER', payload: { id: chapterId, updates: { scenes } } });
      storage.updateChapter(chapterId, { scenes }).catch((cause) => {
        reportStorageError('updateScene', cause);
      });
    },

    deleteScene: (chapterId: string, sceneId: string) => {
      const chapter = stateRef.current.chapters.find(currentChapter => currentChapter.id === chapterId);
      if (!chapter) return;

      const scenes = (chapter.scenes || []).filter(scene => scene.id !== sceneId);
      dispatch({ type: 'UPDATE_CHAPTER', payload: { id: chapterId, updates: { scenes } } });
      storage.updateChapter(chapterId, { scenes }).catch((cause) => {
        reportStorageError('deleteScene', cause);
      });
    },

    reorderScenes: (chapterId: string, sceneIds: string[]) => {
      const chapter = stateRef.current.chapters.find(currentChapter => currentChapter.id === chapterId);
      if (!chapter) return;

      const scenes = sceneIds
        .map(id => (chapter.scenes || []).find(scene => scene.id === id))
        .filter((scene): scene is Scene => scene !== null && scene !== undefined);

      dispatch({ type: 'UPDATE_CHAPTER', payload: { id: chapterId, updates: { scenes } } });
      storage.updateChapter(chapterId, { scenes }).catch((cause) => {
        reportStorageError('reorderScenes', cause);
      });
    }
  }), [debouncedSave, reportStorageError, runWithSavingState]);

  const activeChapter = useMemo(
    () => state.chapters.find(chapter => chapter.id === state.activeChapterId) || null,
    [state.chapters, state.activeChapterId]
  );

  const value: AppContextType = useMemo(() => ({
    state,
    dispatch,
    activeChapter,
    loadNovel,
    loadNovelById,
    ...actions,
    canUndoReorder: reorderUndoStack.current.length > 0,
    canRedoReorder: reorderRedoStack.current.length > 0
  }), [state, activeChapter, loadNovel, loadNovelById, actions]);

  return (
    <AppContext.Provider value={value}>
      <ActiveChapterContext.Provider value={activeChapter}>
        <SettingsContext.Provider value={state.settings}>
          <SavingStateContext.Provider value={state.isSaving}>
            {children}
          </SavingStateContext.Provider>
        </SettingsContext.Provider>
      </ActiveChapterContext.Provider>
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useActiveChapter() {
  const appContext = useContext(AppContext);
  const activeChapter = useContext(ActiveChapterContext);
  if (!appContext) {
    throw new Error('useActiveChapter must be used within an AppProvider');
  }
  return activeChapter;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const appContext = useContext(AppContext);
  const settings = useContext(SettingsContext);
  if (!appContext || settings === null) {
    throw new Error('useSettings must be used within an AppProvider');
  }
  return settings;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSavingState() {
  const appContext = useContext(AppContext);
  const savingState = useContext(SavingStateContext);
  if (!appContext || savingState === null) {
    throw new Error('useSavingState must be used within an AppProvider');
  }
  return savingState;
}
