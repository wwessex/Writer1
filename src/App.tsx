import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { EditorContext, useCurrentEditor, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
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
  ProjectsModal, SceneTemplatesModal, ExportHistoryModal
} from '@/components/Modals';
import { AISuggestionsPanel } from '@/components/Panels';
import { SettingsWindow, AboutWindow } from '@/components/Windows';
import { ToastProvider, useToast } from '@/components/UI';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useModalState } from '@/hooks/useModalState';
import { exportBackup, importBackup, createChapter, addChapter, upsertCommentThread } from '@/lib/storage';
import { importFile, mapImportedContentToProjectType } from '@/lib/import';
import { downloadFile, generateId } from '@/lib/utils';
import { COMMAND_IDS, type CommandId, runCommand } from '@/lib/commands';
import type { CommentThread } from '@/types';
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
  HorizontalRule,
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
  const findReplace = useFindReplace(editor);

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
    closeModal('onboarding');
    updateSettings({ onboardingComplete: true });
  }, [closeModal, updateSettings]);

  const createCommentFromSelection = useCallback(() => {
    if (!editor || !activeChapter) {
      showToast('Select a chapter and text to add a comment', 'warning');
      return;
    }

    const { from, to, empty } = editor.state.selection;
    if (empty) {
      showToast('Select text to anchor a comment', 'warning');
      return;
    }

    const selectedText = editor.state.doc.textBetween(from, to, ' ').trim();
    const text = window.prompt('Comment for selected text:');
    if (!text || !text.trim()) return;

    const threadId = generateId();
    const now = Date.now();
    const thread: CommentThread = {
      id: threadId,
      chapterId: activeChapter.id,
      anchor: {
        from,
        to,
        length: Math.max(to - from, 0),
        selectedText: selectedText || undefined,
      },
      resolved: false,
      createdAt: now,
      updatedAt: now,
      comments: [
        {
          id: generateId(),
          text: text.trim(),
          author: 'Author',
          createdAt: now,
        }
      ],
    };

    const marked = editor.chain().focus().setCommentAnchor({ threadId, state: 'open' }).run();
    if (!marked) {
      showToast('Unable to create comment on current selection', 'error');
      return;
    }

    upsertCommentThread(thread);
    openModal('comments');
    showToast('Comment added', 'success', 'add_comment');
  }, [activeChapter, editor, openModal, showToast]);


  // Handle menu actions
  const handleMenuAction = useCallback((action: CommandId) => {
    runCommand(action, {
      editor,
      fileInputRef,
      importInputRef,
      createChapter: createNewChapter,
      handleExportBackup,
      openModal,
      toggleModal,
      toggleInspector: () => setInspectorOpen(prev => !prev),
      openQuickSwitcher: () => setQuickSwitcherOpen(true),
      toggleSidebar: () => dispatch({ type: 'TOGGLE_SIDEBAR' }),
      togglePageView: () => dispatch({ type: 'TOGGLE_PAGE_VIEW' }),
      toggleFocusMode: () => dispatch({ type: 'TOGGLE_FOCUS_MODE' }),
      toggleTypewriterMode: () => updateSettings({ typewriterMode: !state.settings.typewriterMode }),
      setTheme: (theme) => dispatch({ type: 'SET_THEME', payload: theme }),
      showToast,
      createCommentFromSelection,
    });
  }, [createCommentFromSelection, createNewChapter, dispatch, editor, handleExportBackup, openModal, toggleModal, showToast, updateSettings, state.settings.typewriterMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Find: Ctrl/Cmd+F (no shift)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault();
        findReplace.open(false);
        return;
      }

      // Find & Replace: Ctrl/Cmd+H
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h' && !e.shiftKey) {
        e.preventDefault();
        findReplace.open(true);
        return;
      }

      // Quick Switcher: Ctrl/Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault();
        setQuickSwitcherOpen(prev => !prev);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            handleMenuAction(COMMAND_IDS.NEW_CHAPTER);
            break;
          case 'e':
            e.preventDefault();
            handleMenuAction(COMMAND_IDS.EXPORT);
            break;
          case 'b':
            e.preventDefault();
            handleMenuAction(COMMAND_IDS.TOGGLE_SIDEBAR);
            break;
          case 'f':
            e.preventDefault();
            handleMenuAction(COMMAND_IDS.TOGGLE_FOCUS_MODE);
            break;
          case 'i':
            e.preventDefault();
            handleMenuAction(COMMAND_IDS.INSPECTOR);
            break;
          case 'm':
            e.preventDefault();
            handleMenuAction(COMMAND_IDS.ADD_COMMENT);
            break;
          case 't':
            e.preventDefault();
            handleMenuAction(COMMAND_IDS.TOGGLE_TYPEWRITER_MODE);
            break;
        }
      }
      // Escape to exit focus mode
      if (e.key === 'Escape' && state.settings.focusMode) {
        handleMenuAction(COMMAND_IDS.TOGGLE_FOCUS_MODE);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMenuAction, state.settings.focusMode, findReplace]);

  useEffect(() => {
    const handleAddComment = () => handleMenuAction(COMMAND_IDS.ADD_COMMENT);
    window.addEventListener('writer1:add-comment', handleAddComment as EventListener);
    return () => window.removeEventListener('writer1:add-comment', handleAddComment as EventListener);
  }, [handleMenuAction]);

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
          <button
            className={styles.expandTab}
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            aria-label="Expand sidebar (Ctrl+Shift+B)"
            title="Expand sidebar"
          >
            <span className="material-symbols-rounded">chevron_right</span>
          </button>
        )}
        <Sidebar
          onExportBackup={handleExportBackup}
          onImportBackup={() => fileInputRef.current?.click()}
        />
        <Editor screenplayMode={screenplayMode} onToggleScreenplayMode={onToggleScreenplayMode} />
        {!inspectorOpen && (
          <button
            className={`${styles.expandTab} ${styles['expandTab--right']}`}
            onClick={() => setInspectorOpen(true)}
            aria-label="Expand inspector (Ctrl+Shift+I)"
            title="Expand inspector"
          >
            <span className="material-symbols-rounded">chevron_left</span>
          </button>
        )}
        <Inspector open={inspectorOpen} onClose={() => setInspectorOpen(false)} />
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
      <AppProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}
