import { useEffect, useState, useCallback, useRef, Component, type ReactNode } from 'react';
import { EditorContext, useCurrentEditor, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { useApp, AppProvider } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Editor } from '@/components/Editor';
import { ExportModal, SnapshotModal, AnalysisModal, WordCountModal, DashboardModal, OnboardingModal } from '@/components/Modals';
import { SettingsWindow, AboutWindow } from '@/components/Windows';
import { ToastProvider, useToast } from '@/components/UI';
import { exportBackup, importBackup, createChapter, addChapter } from '@/lib/storage';
import { importFile } from '@/lib/import';
import { downloadFile } from '@/lib/utils';
import './styles/index.css';
import styles from './App.module.css';

// Error Boundary to catch render errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '1rem',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          background: '#0b1020',
          color: '#e5e7eb'
        }}>
          <h1 style={{ color: '#ef4444', margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#9ca3af', maxWidth: '400px', textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              background: '#60a5fa',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const extensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2]
    }
  }),
  Underline,
  HorizontalRule
];

function AppContent() {
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
      const chapters = await importFile(file);

      for (let i = 0; i < chapters.length; i++) {
        const chapter = createChapter(state.novelId, state.chapters.length + i, chapters[i].title);
        chapter.content = chapters[i].content;
        await addChapter(chapter);
      }

      showToast(`Imported ${chapters.length} chapter${chapters.length > 1 ? 's' : ''}`, 'success', 'upload_file');
      loadNovel();
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
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner} />
        <p>Loading NovelWriter...</p>
      </div>
    );
  }

  const layoutClass = `${styles.layout} ${state.settings.sidebarHidden ? styles['layout--sidebarHidden'] : ''}`;

  return (
    <div className={styles.app} role="application" aria-label="NovelWriter">
      <Header onAction={handleMenuAction} />
      <main className={layoutClass} role="main">
        <Sidebar
          onExportBackup={handleExportBackup}
          onImportBackup={() => fileInputRef.current?.click()}
        />
        <Editor />
      </main>

      {/* Modals */}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
      <SnapshotModal open={snapshotOpen} onClose={() => setSnapshotOpen(false)} />
      <AnalysisModal open={analysisOpen} onClose={() => setAnalysisOpen(false)} />
      <WordCountModal open={wordCountOpen} onClose={() => setWordCountOpen(false)} />
      <DashboardModal open={dashboardOpen} onClose={() => setDashboardOpen(false)} />
      <OnboardingModal open={onboardingOpen} onClose={handleOnboardingClose} />

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
        accept=".docx,.rtf,.txt"
        onChange={handleImportDocument}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
    </div>
  );
}

function AppShell() {
  const { activeChapter, updateChapter } = useApp();

  const editor = useEditor({
    extensions,
    content: activeChapter?.content || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor: ed }) => {
      if (activeChapter) {
        updateChapter(activeChapter.id, { content: ed.getJSON() });
      }
    },
  });

  return (
    <EditorContext.Provider value={{ editor }}>
      <AppContent />
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
