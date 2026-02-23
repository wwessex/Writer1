import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { EditorContext, useCurrentEditor, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Image from '@tiptap/extension-image';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import { ScreenplayParagraph, CommentAnchorMark } from '@/components/Editor/screenplayExtension';
import { FindReplaceExtension } from '@/lib/findReplaceExtension';
import { useApp, AppProvider } from '@/context/AppContext';
import { AppShell } from '@/components/AppShell/AppShell';
import { QuickSwitcher } from '@/components/QuickSwitcher';
import { FindReplace, useFindReplace } from '@/components/FindReplace';
import {
  ExportModal, SnapshotModal, AnalysisModal, WordCountModal, DashboardModal, OnboardingModal,
  AIWritingModal, CharacterBibleModal, CommentModal, AdvancedAnalyticsModal, IntegrationsModal,
  ProjectsModal, SceneTemplatesModal, ExportHistoryModal, TranslationModal
} from '@/components/Modals';
import { SettingsWindow, AboutWindow } from '@/components/Windows';
import { ToastProvider, useToast } from '@/components/UI';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { buildCharacterVoiceProfiles } from '@/lib/voiceFingerprint';
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
import './styles/index.css';
import styles from './App.module.css';

const createExtensions = (screenplayMode: boolean) => [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3, 4]
    },
    paragraph: false
  }),
  ScreenplayParagraph.configure({ screenplayMode }),
  Underline,
  HorizontalRule,
  Image.configure({
    inline: false,
    allowBase64: true,
  }),
  TextStyle,
  FontFamily,
  CommentAnchorMark,
  FindReplaceExtension,
];

function AppScene({ screenplayMode, onToggleScreenplayMode }: { screenplayMode: boolean; onToggleScreenplayMode: () => void }) {
  const { state, activeChapter, loadNovel, createChapter: createNewChapter, dispatch, updateSettings } = useApp();
  const { editor } = useCurrentEditor();
  const { showToast } = useToast();
  const { modals, openModal, closeModal, toggleModal } = useModalState();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const hasTextSelection = useEditorSelectionTracking(editor);
  const findReplace = useFindReplace(editor);

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
        inspectorOpen={inspectorOpen}
        setInspectorOpen={setInspectorOpen}
        voiceAlerts={voiceAlerts}
        sidebarImportBackup={() => fileInputRef.current?.click()}
        onExportBackup={handleExportBackup}
        onToggleSidebar={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        aiPanelOpen={modals.aiPanel}
        closeAiPanel={() => closeModal('aiPanel')}
      />

      <QuickSwitcher
        open={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
        onAction={handleMenuAction}
      />

      <ExportModal open={modals.export} onClose={() => closeModal('export')} />
      <SnapshotModal open={modals.snapshot} onClose={() => closeModal('snapshot')} />
      <AnalysisModal open={modals.analysis} onClose={() => closeModal('analysis')} />
      <WordCountModal open={modals.wordCount} onClose={() => closeModal('wordCount')} />
      <DashboardModal open={modals.dashboard} onClose={() => closeModal('dashboard')} onAction={handleMenuAction} />
      <OnboardingModal open={modals.onboarding} onClose={handleOnboardingClose} />
      <CharacterBibleModal open={modals.characterBible} onClose={() => closeModal('characterBible')} />
      <AIWritingModal open={modals.aiWriting} onClose={() => closeModal('aiWriting')} />
      <CommentModal open={modals.comments} onClose={() => closeModal('comments')} />
      <AdvancedAnalyticsModal open={modals.advancedAnalytics} onClose={() => closeModal('advancedAnalytics')} />
      <IntegrationsModal open={modals.integrations} onClose={() => closeModal('integrations')} />
      <ProjectsModal open={modals.projects} onClose={() => closeModal('projects')} />
      <SceneTemplatesModal open={modals.sceneTemplates} onClose={() => closeModal('sceneTemplates')} />
      <ExportHistoryModal open={modals.exportHistory} onClose={() => closeModal('exportHistory')} />
      <TranslationModal open={modals.translation} onClose={() => closeModal('translation')} />

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

  const activeChapterRef = useRef(activeChapter);
  activeChapterRef.current = activeChapter;
  const updateChapterRef = useRef(updateChapter);
  updateChapterRef.current = updateChapter;

  useEffect(() => {
    setScreenplayMode(state.projectType === 'screenplay');
  }, [state.projectType]);

  const extensions = useMemo(() => createExtensions(screenplayMode), [screenplayMode]);

  const editor = useEditor({
    extensions,
    content: activeChapter?.content || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: ed }) => {
      const chapter = activeChapterRef.current;
      if (chapter) {
        updateChapterRef.current(chapter.id, { content: ed.getJSON() });
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find(e => e.name === 'paragraph');
    if (ext) {
      ext.options.screenplayMode = screenplayMode;
    }
  }, [editor, screenplayMode]);

  return (
    <EditorContext.Provider value={{ editor }}>
      <AppScene
        screenplayMode={screenplayMode}
        onToggleScreenplayMode={() => setScreenplayMode(mode => !mode)}
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
