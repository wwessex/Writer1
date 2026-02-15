import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { EditorContext, useCurrentEditor, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { ScreenplayParagraph } from '@/components/Editor/screenplayExtension';
import { useApp, AppProvider } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Editor } from '@/components/Editor';
import {
  ExportModal, SnapshotModal, AnalysisModal, WordCountModal, DashboardModal, OnboardingModal,
  AIWritingModal, CharacterBibleModal, CommentModal, AdvancedAnalyticsModal, IntegrationsModal,
  ProjectsModal, SceneTemplatesModal, ExportHistoryModal
} from '@/components/Modals';
import { AISuggestionsPanel } from '@/components/Panels';
import { SettingsWindow, AboutWindow } from '@/components/Windows';
import { ToastProvider, useToast } from '@/components/UI';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { exportBackup, importBackup, createChapter, addChapter } from '@/lib/storage';
import { importFile, mapImportedContentToProjectType } from '@/lib/import';
import { downloadFile } from '@/lib/utils';
import './styles/index.css';
import styles from './App.module.css';

const createExtensions = (screenplayMode: boolean) => [
  StarterKit.configure({
    heading: {
      levels: [1, 2]
    },
    paragraph: false
  }),
  ScreenplayParagraph.configure({ screenplayMode }),
  Underline,
  HorizontalRule
];

function AppContent({ screenplayMode, onToggleScreenplayMode }: { screenplayMode: boolean; onToggleScreenplayMode: () => void }) {
  const { state, loadNovel, createChapter: createNewChapter, dispatch, updateSettings } = useApp();
  const { editor } = useCurrentEditor();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [exportOpen, setExportOpen] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [characterBibleOpen, setCharacterBibleOpen] = useState(false);
  const [aiWritingOpen, setAiWritingOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [advancedAnalyticsOpen, setAdvancedAnalyticsOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [sceneTemplatesOpen, setSceneTemplatesOpen] = useState(false);
  const [exportHistoryOpen, setExportHistoryOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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
      setOnboardingOpen(true);
    }
  }, [isLoading, state.settings.onboardingComplete]);

  // Apply focus mode body class
  useEffect(() => {
    document.body.classList.toggle('focus-mode', state.settings.focusMode);
    return () => document.body.classList.remove('focus-mode');
  }, [state.settings.focusMode]);

  // Export backup
  const handleExportBackup = useCallback(async () => {
    try {
      const backup = await exportBackup(state.novelId, true);
      const json = JSON.stringify(backup, null, 2);
      downloadFile(json, `${state.novelTitle}-backup.json`);
      showToast('Backup exported successfully', 'success', 'download_done');
    } catch (err) {
      console.error('Backup export failed:', err);
      showToast('Failed to export backup', 'error');
    }
  }, [state.novelId, state.novelTitle, showToast]);

  // Import backup
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await importBackup(backup);
      showToast('Backup imported successfully. Reloading...', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error('Backup import failed:', err);
      showToast('Failed to import backup. Check the file format.', 'error');
    }

    e.target.value = '';
  };

  // Import document
  const handleImportDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importFile(file);

      for (let i = 0; i < result.sections.length; i++) {
        const importedSection = result.sections[i];
        const chapter = createChapter(
          state.novelId,
          state.chapters.length + i,
          importedSection.title,
          state.projectType
        );
        chapter.content = mapImportedContentToProjectType(importedSection.content, state.projectType);
        await addChapter(chapter);
      }

      const sectionLabel = state.projectType === 'screenplay' ? 'scene' : 'chapter';
      showToast(
        `Imported ${result.sections.length} ${sectionLabel}${result.sections.length !== 1 ? 's' : ''}`,
        'success',
        'upload_file'
      );

      if (result.notices.length > 0) {
        const firstNotice = result.notices[0];
        showToast(
          `Imported with ${result.notices.length} note${result.notices.length !== 1 ? 's' : ''}: ${firstNotice.message}`,
          'info'
        );
      }

      await loadNovel();
    } catch (err) {
      console.error('Document import failed:', err);
      showToast('Failed to import document. Check the file format.', 'error');
    }

    e.target.value = '';
  };

  const handleOnboardingClose = useCallback(() => {
    setOnboardingOpen(false);
    updateSettings({ onboardingComplete: true });
  }, [updateSettings]);

  // Handle menu actions
  const handleMenuAction = useCallback((action: string) => {
    switch (action) {
      case 'newChapter':
        createNewChapter();
        showToast('New chapter created', 'success', 'add');
        break;
      case 'export':
        setExportOpen(true);
        break;
      case 'importDocument':
        importInputRef.current?.click();
        break;
      case 'exportBackup':
        handleExportBackup();
        break;
      case 'importBackup':
        fileInputRef.current?.click();
        break;
      case 'settings':
        setSettingsOpen(true);
        break;
      case 'snapshots':
        setSnapshotOpen(true);
        break;
      case 'analysis':
        setAnalysisOpen(true);
        break;
      case 'wordCount':
        setWordCountOpen(true);
        break;
      case 'dashboard':
        setDashboardOpen(true);
        break;
      case 'onboarding':
        setOnboardingOpen(true);
        break;
      case 'about':
        setAboutOpen(true);
        break;
      case 'characterBible':
        setCharacterBibleOpen(true);
        break;
      case 'aiWriting':
        setAiWritingOpen(true);
        break;
      case 'comments':
        setCommentsOpen(true);
        break;
      case 'advancedAnalytics':
        setAdvancedAnalyticsOpen(true);
        break;
      case 'integrations':
        setIntegrationsOpen(true);
        break;
      case 'projects':
        setProjectsOpen(true);
        break;
      case 'sceneTemplates':
        setSceneTemplatesOpen(true);
        break;
      case 'exportHistory':
        setExportHistoryOpen(true);
        break;
      case 'aiPanel':
        setAiPanelOpen(prev => !prev);
        break;
      case 'undo':
        editor?.chain().focus().undo().run();
        break;
      case 'redo':
        editor?.chain().focus().redo().run();
        break;
      case 'selectAll':
        editor?.commands.selectAll();
        break;
      case 'insertHr':
        editor?.chain().focus().setHorizontalRule().run();
        break;
      case 'insertBlockquote':
        editor?.chain().focus().toggleBlockquote().run();
        break;
      case 'formatBold':
        editor?.chain().focus().toggleBold().run();
        break;
      case 'formatItalic':
        editor?.chain().focus().toggleItalic().run();
        break;
      case 'formatUnderline':
        editor?.chain().focus().toggleUnderline().run();
        break;
      case 'formatH1':
        editor?.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'formatH2':
        editor?.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'formatP':
        editor?.chain().focus().setParagraph().run();
        break;
    }
  }, [createNewChapter, editor, handleExportBackup, showToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            createNewChapter();
            break;
          case 'e':
            e.preventDefault();
            setExportOpen(true);
            break;
          case 'b':
            e.preventDefault();
            dispatch({ type: 'TOGGLE_SIDEBAR' });
            break;
          case 'f':
            e.preventDefault();
            dispatch({ type: 'TOGGLE_FOCUS_MODE' });
            break;
        }
      }
      // Escape to exit focus mode
      if (e.key === 'Escape' && state.settings.focusMode) {
        dispatch({ type: 'TOGGLE_FOCUS_MODE' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createNewChapter, dispatch, state.settings.focusMode]);

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
        <p>Loading NovelWriter {loadingProjectLabel}...</p>
      </div>
    );
  }

  const layoutClass = `${styles.layout} ${state.settings.sidebarHidden ? styles['layout--sidebarHidden'] : ''}`;

  const appLabel = `NovelWriter ${state.projectType === 'screenplay' ? 'Screenplay Project Workspace' : 'Book Project Workspace'}`;

  return (
    <div className={styles.app} role="application" aria-label={appLabel}>
      <Header onAction={handleMenuAction} />
      <main className={layoutClass} role="main">
        <Sidebar
          onExportBackup={handleExportBackup}
          onImportBackup={() => fileInputRef.current?.click()}
        />
        <Editor screenplayMode={screenplayMode} onToggleScreenplayMode={onToggleScreenplayMode} />
        <AISuggestionsPanel open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
      </main>

      {/* Modals */}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <SnapshotModal open={snapshotOpen} onClose={() => setSnapshotOpen(false)} />
      <AnalysisModal open={analysisOpen} onClose={() => setAnalysisOpen(false)} />
      <WordCountModal open={wordCountOpen} onClose={() => setWordCountOpen(false)} />
      <DashboardModal open={dashboardOpen} onClose={() => setDashboardOpen(false)} />
      <OnboardingModal open={onboardingOpen} onClose={handleOnboardingClose} />
      <CharacterBibleModal open={characterBibleOpen} onClose={() => setCharacterBibleOpen(false)} />
      <AIWritingModal open={aiWritingOpen} onClose={() => setAiWritingOpen(false)} />
      <CommentModal open={commentsOpen} onClose={() => setCommentsOpen(false)} />
      <AdvancedAnalyticsModal open={advancedAnalyticsOpen} onClose={() => setAdvancedAnalyticsOpen(false)} />
      <IntegrationsModal open={integrationsOpen} onClose={() => setIntegrationsOpen(false)} />
      <ProjectsModal open={projectsOpen} onClose={() => setProjectsOpen(false)} />
      <SceneTemplatesModal open={sceneTemplatesOpen} onClose={() => setSceneTemplatesOpen(false)} />
      <ExportHistoryModal open={exportHistoryOpen} onClose={() => setExportHistoryOpen(false)} />

      {/* Windows */}
      <SettingsWindow open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AboutWindow open={aboutOpen} onClose={() => setAboutOpen(false)} />

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
      <AppProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
