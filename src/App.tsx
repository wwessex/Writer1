import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { EditorContext, useCodeMirrorEditor } from '@/lib/editor';
import type { EditorAdapter } from '@/lib/editor';
import { useApp, AppProvider } from '@/context/AppContext';
import { AppShell } from '@/components/AppShell/AppShell';
import { QuickSwitcher } from '@/components/QuickSwitcher';
import { FindReplace, useFindReplace } from '@/components/FindReplace';
import {
  ExportModal, OnboardingModal, ProjectsModal
} from '@/components/Modals';
import { SettingsWindow, AboutWindow } from '@/components/Windows';
import { ToastProvider, useToast } from '@/components/UI';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { buildCharacterVoiceProfiles } from '@/lib/voiceFingerprint';
import { buildContinuityMemory, saveContinuityMemory } from '@/lib/continuityMemory';
import type { CharacterEntity } from '@/types';
import { useModalState } from '@/hooks/useModalState';
import { useProjectFileActions } from '@/hooks/useProjectFileActions';
import { useCommentActions } from '@/hooks/useCommentActions';
import { useAppKeyboardShortcuts } from '@/hooks/useAppKeyboardShortcuts';
import { useLoadNovel } from '@/hooks/useLoadNovel';
import { useOnboardingTrigger } from '@/hooks/useOnboardingTrigger';
import { useFocusModeClass } from '@/hooks/useFocusModeClass';
import { useEditorSelectionTracking } from '@/hooks/useEditorSelectionTracking';
import { useVoiceAlerts } from '@/hooks/useVoiceAlerts';
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime';
import { useCrashRecovery } from '@/hooks/useCrashRecovery';
import { clearWindowLocks, getSessionState, getWorkspaceStore, heartbeatProjectLock, persistSessionState } from '@/context/services/workspaceService';
import './styles/index.css';
import styles from './App.module.css';

const AIWritingModal = lazy(() => import('@/components/Modals/AIWritingModal').then((module) => ({ default: module.AIWritingModal })));
const AdvancedAnalyticsModal = lazy(() => import('@/components/Modals/AdvancedAnalyticsModal').then((module) => ({ default: module.AdvancedAnalyticsModal })));
const IntegrationsModal = lazy(() => import('@/components/Modals/IntegrationsModal').then((module) => ({ default: module.IntegrationsModal })));
const ExportHistoryModal = lazy(() => import('@/components/Modals/ExportHistoryModal').then((module) => ({ default: module.ExportHistoryModal })));
const TranslationModal = lazy(() => import('@/components/Modals/TranslationModal').then((module) => ({ default: module.TranslationModal })));
const SnapshotModal = lazy(() => import('@/components/Modals/SnapshotModal').then((module) => ({ default: module.SnapshotModal })));
const AnalysisModal = lazy(() => import('@/components/Modals/AnalysisModal').then((module) => ({ default: module.AnalysisModal })));
const WordCountModal = lazy(() => import('@/components/Modals/WordCountModal').then((module) => ({ default: module.WordCountModal })));
const DashboardModal = lazy(() => import('@/components/Modals/DashboardModal').then((module) => ({ default: module.DashboardModal })));
const CharacterBibleModal = lazy(() => import('@/components/Modals/CharacterBibleModal').then((module) => ({ default: module.CharacterBibleModal })));
const CommentModal = lazy(() => import('@/components/Modals/CommentModal').then((module) => ({ default: module.CommentModal })));
const SceneTemplatesModal = lazy(() => import('@/components/Modals/SceneTemplatesModal').then((module) => ({ default: module.SceneTemplatesModal })));
const CorkboardModal = lazy(() => import('@/components/Modals/CorkboardModal').then((module) => ({ default: module.CorkboardModal })));
const StoryCardsModal = lazy(() => import('@/components/Modals/StoryCardsModal').then((module) => ({ default: module.StoryCardsModal })));
const PublishAssistantModal = lazy(() => import('@/components/Modals/PublishAssistantModal').then((module) => ({ default: module.PublishAssistantModal })));

function AppScene({ screenplayMode, onToggleScreenplayMode, hasUnsavedEdits, editor }: { screenplayMode: boolean; onToggleScreenplayMode: () => void; hasUnsavedEdits: boolean; editor: EditorAdapter | null }) {
  const { state, activeChapter, loadNovel, loadNovelById, createChapter: createNewChapter, dispatch, updateSettings, setActiveChapter } = useApp();
  const { showToast } = useToast();
  const { modals, openModal, closeModal, toggleModal } = useModalState();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const hasTextSelection = useEditorSelectionTracking(editor);
  const [editorFocused, setEditorFocused] = useState(false);
  const findReplace = useFindReplace(editor);

  useEffect(() => {
    if (!editor) {
      setEditorFocused(false);
      return;
    }

    const updateFocus = () => setEditorFocused(editor.isFocused());
    updateFocus();
    editor.on('focus', updateFocus);
    editor.on('blur', updateFocus);

    return () => {
      editor.off('focus', updateFocus);
      editor.off('blur', updateFocus);
    };
  }, [editor]);

  const characters = useMemo<CharacterEntity[]>(() => {
    try {
      const raw = localStorage.getItem('draftharbour_characters');
      const parsed = raw ? (JSON.parse(raw) as CharacterEntity[]) : [];
      return parsed.filter(character => character.novelId === '' || character.novelId === state.novelId);
    } catch {
      return [];
    }
  }, [state.novelId]);

  const baselineProfiles = useMemo(() => {
    const baselineChapters = state.chapters.filter(chapter => chapter.id !== activeChapter?.id);
    return buildCharacterVoiceProfiles(baselineChapters, characters);
  }, [state.chapters, characters, activeChapter?.id]);

  const voiceAlerts = useVoiceAlerts({ activeChapter, baselineProfiles, showToast });

  const {
    fileInputRef,
    importInputRef,
    projectFileInputRef,
    handleExportBackup,
    handleSaveProjectFile,
    handleOpenProjectFile,
    handleImportBackup,
    handleImportDocument,
  } = useProjectFileActions({ state, loadNovel, showToast });

  useLoadNovel({
    loadNovel,
    onLoaded: () => setIsLoading(false),
    onError: (err) => {
      console.error('Failed to load novel:', err);
      setError(`Failed to load: ${err.message || 'Unknown error'}`);
      setIsLoading(false);
    },
  });

  useOnboardingTrigger({
    isLoading,
    onboardingComplete: state.settings.onboardingComplete,
    openOnboarding: () => openModal('onboarding'),
  });

  useFocusModeClass(state.settings.focusMode);

  useEffect(() => {
    const projectFromUrl = new URLSearchParams(window.location.search).get('project');
    if (projectFromUrl) {
      void loadNovelById(projectFromUrl);
    }
  }, [loadNovelById]);

  useEffect(() => {
    const restored = getSessionState();
    if (!restored) return;
    if (restored.geometry) {
      window.resizeTo(restored.geometry.width, restored.geometry.height);
      window.moveTo(restored.geometry.x, restored.geometry.y);
    }
    if (typeof restored.panelLayout === 'object' && restored.panelLayout) {
      updateSettings({ sidebarPanels: restored.panelLayout as typeof state.settings.sidebarPanels });
    }
    if (restored.projectId && restored.projectId !== state.novelId) {
      void loadNovelById(restored.projectId);
    }
    if (restored.chapterId) {
      setActiveChapter(restored.chapterId);
    }
    setInspectorOpen(Boolean((restored as { inspectorOpen?: boolean }).inspectorOpen));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    persistSessionState({
      projectId: state.novelId,
      chapterId: state.activeChapterId,
      panelLayout: state.settings.sidebarPanels,
      geometry: { width: window.outerWidth, height: window.outerHeight, x: window.screenX, y: window.screenY },
      inspectorOpen,
    });
  }, [state.novelId, state.activeChapterId, state.settings.sidebarPanels, inspectorOpen]);

  useEffect(() => {
    heartbeatProjectLock(state.novelId);
    const interval = window.setInterval(() => heartbeatProjectLock(state.novelId), 5000);
    return () => window.clearInterval(interval);
  }, [state.novelId]);

  useEffect(() => {
    const handleUnload = () => clearWindowLocks();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const handleOnboardingClose = useCallback(() => {
    closeModal('onboarding');
    updateSettings({ onboardingComplete: true });
  }, [closeModal, updateSettings]);

  const { createCommentFromSelection } = useCommentActions({
    editor,
    activeChapter,
    openModal: (id) => openModal(id),
    showToast,
  });

  const { handleMenuAction } = useAppKeyboardShortcuts({
    editor,
    findReplace,
    fileInputRef,
    importInputRef,
    projectFileInputRef,
    createChapter: createNewChapter,
    handleExportBackup,
    handleSaveProjectFile,
    openModal,
    toggleModal,
    dispatch,
    updateSettings,
    settings: state.settings,
    showToast,
    createCommentFromSelection,
    setInspectorOpen,
    setQuickSwitcherOpen,
    openRecentProjects: () => openModal('projects'),
    reopenLastProject: () => {
      const lastProjectId = getWorkspaceStore().lastProjectId;
      if (lastProjectId) {
        void loadNovelById(lastProjectId);
      }
    },
  });


  useDesktopRuntime({
    hasUnsavedEdits,
    onDeepLink: (url) => {
      showToast(`Opened deep link: ${url}`, 'info');
    },
    onMenuAction: handleMenuAction,
    menuState: { editorFocused, hasSelection: hasTextSelection },
    showToast,
  });

  useEffect(() => {
    if (!state.novelId) return;
    const snapshot = buildContinuityMemory(state.novelId, state.chapters);
    saveContinuityMemory(snapshot);
  }, [state.novelId, state.chapters, state.isSaving]);

  useCrashRecovery({
    hasUnsavedEdits,
    novelId: state.novelId,
    activeChapterId: state.activeChapterId,
    onRecoveryDetected: useCallback(() => {
      showToast('Your previous session may not have saved cleanly. Check your latest edits.', 'warning', 'history');
    }, [showToast]),
  });

  if (error) {
    return (
      <div className={styles.loading}>
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    const loadingProjectLabel = state.projectType === 'screenplay' ? 'screenplay project' : 'book project';
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <p>Loading DraftHarbour Studio {loadingProjectLabel}...</p>
      </div>
    );
  }

  const appLabel = `DraftHarbour Studio ${state.projectType === 'screenplay' ? 'Screenplay Project Workspace' : 'Book Project Workspace'}`;

  return (
    <div className={styles.app} role="application" aria-label={appLabel}>
      <FindReplace controls={findReplace} />
      <AppShell
        appLabel={appLabel}
        state={state}
        screenplayMode={screenplayMode}
        onToggleScreenplayMode={onToggleScreenplayMode}
        onAction={handleMenuAction}
        hasTextSelection={hasTextSelection}
        editorFocused={editorFocused}
        inspectorOpen={inspectorOpen}
        setInspectorOpen={setInspectorOpen}
        voiceAlerts={voiceAlerts}
        sidebarImportBackup={() => fileInputRef.current?.click()}
        onExportBackup={handleExportBackup}
        onToggleSidebar={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        aiPanelOpen={modals.aiPanel}
        closeAiPanel={() => closeModal('aiPanel')}
        editor={editor}
      />

      <QuickSwitcher
        open={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
        onAction={handleMenuAction}
      />

      <ExportModal open={modals.export} onClose={() => closeModal('export')} />
      <OnboardingModal open={modals.onboarding} onClose={handleOnboardingClose} />
      <ProjectsModal open={modals.projects} onClose={() => closeModal('projects')} />
      <Suspense fallback={null}>
        <SnapshotModal open={modals.snapshot} onClose={() => closeModal('snapshot')} />
        <AnalysisModal open={modals.analysis} onClose={() => closeModal('analysis')} />
        <WordCountModal open={modals.wordCount} onClose={() => closeModal('wordCount')} />
        <DashboardModal open={modals.dashboard} onClose={() => closeModal('dashboard')} onAction={handleMenuAction} />
        <CharacterBibleModal open={modals.characterBible} onClose={() => closeModal('characterBible')} />
        <AIWritingModal open={modals.aiWriting} onClose={() => closeModal('aiWriting')} />
        <CommentModal open={modals.comments} onClose={() => closeModal('comments')} />
        <AdvancedAnalyticsModal open={modals.advancedAnalytics} onClose={() => closeModal('advancedAnalytics')} />
        <IntegrationsModal open={modals.integrations} onClose={() => closeModal('integrations')} />
        <SceneTemplatesModal open={modals.sceneTemplates} onClose={() => closeModal('sceneTemplates')} />
        <ExportHistoryModal open={modals.exportHistory} onClose={() => closeModal('exportHistory')} />
        <TranslationModal open={modals.translation} onClose={() => closeModal('translation')} />
        <CorkboardModal open={modals.corkboard} onClose={() => closeModal('corkboard')} />
        <StoryCardsModal open={modals.storyCards} onClose={() => closeModal('storyCards')} />
        <PublishAssistantModal open={modals.publishAssistant} onClose={() => closeModal('publishAssistant')} />
      </Suspense>

      <SettingsWindow open={modals.settings} onClose={() => closeModal('settings')} />
      <AboutWindow open={modals.about} onClose={() => closeModal('about')} />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportBackup}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <input
        ref={importInputRef}
        type="file"
        accept=".docx,.rtf,.txt,.fountain,.spmd"
        onChange={handleImportDocument}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <input
        ref={projectFileInputRef}
        type="file"
        accept=".dhproj"
        onChange={handleOpenProjectFile}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
}

function AppEditorProvider() {
  const { activeChapter, updateChapter, state } = useApp();
  const [screenplayMode, setScreenplayMode] = useState(state.projectType === 'screenplay');
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);
  const unsavedTimerRef = useRef<number | null>(null);

  const activeChapterRef = useRef(activeChapter);
  activeChapterRef.current = activeChapter;
  const updateChapterRef = useRef(updateChapter);
  updateChapterRef.current = updateChapter;

  useEffect(() => {
    setScreenplayMode(state.projectType === 'screenplay');
  }, [state.projectType]);

  const handleChange = useCallback((content: string) => {
    const chapter = activeChapterRef.current;
    if (chapter) {
      updateChapterRef.current(chapter.id, { content });
      setHasUnsavedEdits(true);
    }
  }, []);

  const { containerRef, adapter } = useCodeMirrorEditor({
    initialContent: activeChapter?.content || '',
    onChange: handleChange,
    screenplayMode,
    typewriterMode: state.settings.typewriterMode,
  });

  // Sync content when switching chapters
  const prevChapterIdRef = useRef(activeChapter?.id);
  useEffect(() => {
    if (!adapter) return;
    if (prevChapterIdRef.current !== activeChapter?.id) {
      adapter.setContent(activeChapter?.content || '');
      prevChapterIdRef.current = activeChapter?.id;
    }
  }, [adapter, activeChapter?.id, activeChapter?.content]);

  useEffect(() => {
    if (state.isSaving) return;
    if (unsavedTimerRef.current) {
      window.clearTimeout(unsavedTimerRef.current);
    }
    unsavedTimerRef.current = window.setTimeout(() => {
      setHasUnsavedEdits(false);
    }, 1200);

    return () => {
      if (unsavedTimerRef.current) {
        window.clearTimeout(unsavedTimerRef.current);
      }
    };
  }, [state.isSaving]);

  return (
    <EditorContext.Provider value={{ editor: adapter }}>
      {/* Hidden container for CodeMirror to mount into */}
      <div ref={containerRef} style={{ display: 'none' }} />
      <AppScene
        screenplayMode={screenplayMode}
        onToggleScreenplayMode={() => setScreenplayMode(mode => !mode)}
        hasUnsavedEdits={hasUnsavedEdits || state.isSaving}
        editor={adapter}
      />
    </EditorContext.Provider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppProvider>
          <AppEditorProvider />
        </AppProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
