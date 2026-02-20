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
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Editor } from '@/components/Editor';
import { Inspector } from '@/components/Inspector';
import { QuickSwitcher } from '@/components/QuickSwitcher';
import { FindReplace, useFindReplace } from '@/components/FindReplace';
import {
  ExportModal, SnapshotModal, AnalysisModal, WordCountModal, DashboardModal, OnboardingModal,
  AIWritingModal, CharacterBibleModal, CommentModal, AdvancedAnalyticsModal, IntegrationsModal,
  ProjectsModal, SceneTemplatesModal, ExportHistoryModal, TranslationModal
} from '@/components/Modals';
import { AISuggestionsPanel } from '@/components/Panels';
import { SettingsWindow, AboutWindow } from '@/components/Windows';
import { ToastProvider, useToast } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { buildCharacterVoiceProfiles, getDialogueSimilarityAlerts, DEFAULT_VOICE_SIMILARITY_CONFIG, type VoiceSimilarityAlert } from '@/lib/voiceFingerprint';
import type { CharacterEntity } from '@/types';
import { useModalState } from '@/hooks/useModalState';
import { useProjectFileActions } from '@/hooks/useProjectFileActions';
import { useCommentActions } from '@/hooks/useCommentActions';
import { useAppKeyboardShortcuts } from '@/hooks/useAppKeyboardShortcuts';
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

function AppContent({ screenplayMode, onToggleScreenplayMode }: { screenplayMode: boolean; onToggleScreenplayMode: () => void }) {
  const { state, activeChapter, loadNovel, createChapter: createNewChapter, dispatch, updateSettings } = useApp();
  const { editor } = useCurrentEditor();
  const { showToast } = useToast();
  const { modals, openModal, closeModal, toggleModal } = useModalState();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false);
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [voiceAlerts, setVoiceAlerts] = useState<VoiceSimilarityAlert[]>([]);
  const voiceAlertSignatureRef = useRef<string>('');
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

  // Load novel on mount
  useEffect(() => {
    loadNovel()
      .then(() => setIsLoading(false))
      .catch((err) => {
        console.error('Failed to load novel:', err);
        setError(`Failed to load: ${err.message || 'Unknown error'}`);
        setIsLoading(false);
      });
  }, [loadNovel]);

  // Show onboarding on first visit
  useEffect(() => {
    if (!isLoading && !state.settings.onboardingComplete) {
      openModal('onboarding');
    }
  }, [isLoading, state.settings.onboardingComplete, openModal]);

  // Apply focus mode body class
  useEffect(() => {
    document.body.classList.toggle('focus-mode', state.settings.focusMode);
    return () => document.body.classList.remove('focus-mode');
  }, [state.settings.focusMode]);

  // Track whether the editor has a non-empty selection for contextual mobile actions
  useEffect(() => {
    if (!editor) {
      setHasTextSelection(false);
      return;
    }

    const updateSelectionState = () => {
      setHasTextSelection(!editor.state.selection.empty);
    };
    const handleEditorBlur = () => setHasTextSelection(false);

    updateSelectionState();
    editor.on('selectionUpdate', updateSelectionState);
    editor.on('blur', handleEditorBlur);

    return () => {
      editor.off('selectionUpdate', updateSelectionState);
      editor.off('blur', handleEditorBlur);
    };
  }, [editor]);

  useEffect(() => {
    if (!activeChapter) {
      setVoiceAlerts([]);
      return;
    }

    const alerts = getDialogueSimilarityAlerts(activeChapter.content, baselineProfiles, DEFAULT_VOICE_SIMILARITY_CONFIG);
    setVoiceAlerts(alerts);

    const nextSignature = alerts.slice(0, 3).map(alert => `${alert.activeSpeaker}:${alert.comparedSpeaker}:${alert.similarity.toFixed(3)}`).join('|');
    if (nextSignature && nextSignature !== voiceAlertSignatureRef.current) {
      const topAlert = alerts[0];
      showToast(`Voice overlap warning: ${topAlert.activeSpeaker} is ${(topAlert.similarity * 100).toFixed(0)}% similar to ${topAlert.comparedSpeaker}.`, 'warning');
      voiceAlertSignatureRef.current = nextSignature;
    }

    if (!nextSignature) {
      voiceAlertSignatureRef.current = '';
    }
  }, [activeChapter, baselineProfiles, showToast]);

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

  // Show error state
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

  // Show loading state
  if (isLoading) {
    const loadingProjectLabel = state.projectType === 'screenplay' ? 'screenplay project' : 'book project';
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <p>Loading DraftHarbour Studio {loadingProjectLabel}...</p>
      </div>
    );
  }

  const layoutClass = [
    styles.layout,
    state.settings.sidebarHidden ? styles['layout--sidebarHidden'] : '',
    inspectorOpen ? styles['layout--inspectorOpen'] : '',
  ].filter(Boolean).join(' ');

  const appLabel = `DraftHarbour Studio ${state.projectType === 'screenplay' ? 'Screenplay Project Workspace' : 'Book Project Workspace'}`;

  return (
    <div className={styles.app} role="application" aria-label={appLabel}>
      <Header
        onAction={handleMenuAction}
        onToggleInspector={() => setInspectorOpen(prev => !prev)}
        inspectorOpen={inspectorOpen}
        hasTextSelection={hasTextSelection}
      />
      <FindReplace controls={findReplace} />
      <main className={layoutClass} role="main">
        {state.settings.sidebarHidden && (
          <Tooltip content="Expand sidebar (Ctrl+Shift+B)" position="right">
            <button
              className={styles.expandTab}
              onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
              aria-label="Expand sidebar (Ctrl+Shift+B)"
              title="Expand sidebar"
            >
              <span className="material-symbols-rounded">chevron_right</span>
            </button>
          </Tooltip>
        )}
        <PanelErrorBoundary panel="sidebar">
          <Sidebar
            onExportBackup={handleExportBackup}
            onImportBackup={() => fileInputRef.current?.click()}
          />
        </PanelErrorBoundary>
        <PanelErrorBoundary panel="editor">
          <Editor screenplayMode={screenplayMode} onToggleScreenplayMode={onToggleScreenplayMode} />
        </PanelErrorBoundary>
        {!inspectorOpen && (
          <Tooltip content="Expand inspector (Ctrl+Shift+I)" position="left">
            <button
              className={`${styles.expandTab} ${styles['expandTab--right']}`}
              onClick={() => setInspectorOpen(true)}
              aria-label="Expand inspector (Ctrl+Shift+I)"
              title="Expand inspector"
            >
              <span className="material-symbols-rounded">chevron_left</span>
            </button>
          </Tooltip>
        )}
        <PanelErrorBoundary panel="inspector">
          <Inspector open={inspectorOpen} onClose={() => setInspectorOpen(false)} voiceAlerts={voiceAlerts} />
        </PanelErrorBoundary>
        <AISuggestionsPanel open={modals.aiPanel} onClose={() => closeModal('aiPanel')} />
      </main>

      {/* Quick Switcher */}
      <QuickSwitcher
        open={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
        onAction={handleMenuAction}
      />

      {/* Modals */}
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

      {/* Windows */}
      <SettingsWindow open={modals.settings} onClose={() => closeModal('settings')} />
      <AboutWindow open={modals.about} onClose={() => closeModal('about')} />

      {/* Mobile bottom navigation: Outline | Write | Inspector */}
      <nav className={styles.mobileNav} aria-label="Mobile navigation">
        <button
          className={`${styles.mobileNav__tab} ${!state.settings.sidebarHidden ? styles['mobileNav__tab--active'] : ''}`}
          onClick={() => {
            if (state.settings.sidebarHidden) dispatch({ type: 'TOGGLE_SIDEBAR' });
            setInspectorOpen(false);
          }}
        >
          <span className="material-symbols-rounded">list</span>
          <span>Outline</span>
        </button>
        <button
          className={`${styles.mobileNav__tab} ${state.settings.sidebarHidden && !inspectorOpen ? styles['mobileNav__tab--active'] : ''}`}
          onClick={() => {
            if (!state.settings.sidebarHidden) dispatch({ type: 'TOGGLE_SIDEBAR' });
            setInspectorOpen(false);
          }}
        >
          <span className="material-symbols-rounded">edit</span>
          <span>Write</span>
        </button>
        <button
          className={`${styles.mobileNav__tab} ${inspectorOpen ? styles['mobileNav__tab--active'] : ''}`}
          onClick={() => {
            if (!state.settings.sidebarHidden) dispatch({ type: 'TOGGLE_SIDEBAR' });
            setInspectorOpen(prev => !prev);
          }}
        >
          <span className="material-symbols-rounded">info</span>
          <span>Inspector</span>
        </button>
      </nav>

      {/* Hidden file inputs */}
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

function AppShell() {
  const { activeChapter, updateChapter, state } = useApp();
  const [screenplayMode, setScreenplayMode] = useState(state.projectType === 'screenplay');

  // Use refs to avoid stale closures in editor onUpdate callback
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

  // Keep the ScreenplayParagraph extension's screenplayMode option in sync
  // with the React state. useEditor does not recreate the editor when the
  // extensions array reference changes, so we patch the live option directly.
  useEffect(() => {
    if (!editor) return;
    const ext = editor.extensionManager.extensions.find(e => e.name === 'paragraph');
    if (ext) {
      ext.options.screenplayMode = screenplayMode;
    }
  }, [editor, screenplayMode]);

  return (
    <EditorContext.Provider value={{ editor }}>
      <AppContent
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
          <AppShell />
        </AppProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
