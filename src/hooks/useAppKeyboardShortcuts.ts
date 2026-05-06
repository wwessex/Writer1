import { useCallback, useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { EditorAdapter } from '@/lib/editor';
import { COMMAND_IDS, type CommandId, runCommand } from '@/lib/commands';
import type { ModalKey } from '@/hooks/useModalState';
import type { AppSettings } from '@/types';
import type { FindReplaceControls } from '@/components/FindReplace/useFindReplace';

type ToastFn = (message: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;

type AppDispatch = Dispatch<
  { type: 'TOGGLE_SIDEBAR' | 'TOGGLE_PAGE_VIEW' | 'TOGGLE_FOCUS_MODE' }
  | { type: 'SET_THEME'; payload: AppSettings['theme'] }
>;

interface UseAppKeyboardShortcutsParams {
  editor: EditorAdapter | null;
  findReplace: FindReplaceControls;
  fileInputRef: RefObject<HTMLInputElement | null>;
  importInputRef: RefObject<HTMLInputElement | null>;
  projectFileInputRef: RefObject<HTMLInputElement | null>;
  createChapter: () => void;
  handleExportBackup: () => void;
  handleSaveProjectFile: () => void;
  openModal: (id: ModalKey) => void;
  toggleModal: (id: ModalKey) => void;
  dispatch: AppDispatch;
  updateSettings: (settings: Partial<AppSettings>) => void;
  settings: AppSettings;
  showToast: ToastFn;
  createCommentFromSelection: () => void;
  setInspectorOpen: Dispatch<SetStateAction<boolean>>;
  setQuickSwitcherOpen: Dispatch<SetStateAction<boolean>>;
  openRecentProjects: () => void;
  reopenLastProject: () => void;
}

interface KeyboardShortcutContext {
  event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'key' | 'preventDefault'>;
  findReplace: Pick<FindReplaceControls, 'open'>;
  handleMenuAction: (action: CommandId) => void;
  toggleQuickSwitcher: () => void;
  focusMode: boolean;
}

export function handleKeyboardShortcut({ event, findReplace, handleMenuAction, toggleQuickSwitcher, focusMode }: KeyboardShortcutContext) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !event.shiftKey) {
    event.preventDefault();
    findReplace.open(false);
    return true;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h' && !event.shiftKey) {
    event.preventDefault();
    findReplace.open(true);
    return true;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !event.shiftKey) {
    event.preventDefault();
    handleMenuAction(COMMAND_IDS.SAVE_PROJECT_FILE);
    return true;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o' && !event.shiftKey) {
    event.preventDefault();
    handleMenuAction(COMMAND_IDS.OPEN_PROJECT_FILE);
    return true;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.shiftKey) {
    event.preventDefault();
    toggleQuickSwitcher();
    return true;
  }

  if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
    switch (event.key.toLowerCase()) {
      case 'n':
        event.preventDefault();
        handleMenuAction(COMMAND_IDS.NEW_CHAPTER);
        return true;
      case 'e':
        event.preventDefault();
        handleMenuAction(COMMAND_IDS.EXPORT);
        return true;
      case 'b':
        event.preventDefault();
        handleMenuAction(COMMAND_IDS.TOGGLE_SIDEBAR);
        return true;
      case 'f':
        event.preventDefault();
        handleMenuAction(COMMAND_IDS.TOGGLE_FOCUS_MODE);
        return true;
      case 'i':
        event.preventDefault();
        handleMenuAction(COMMAND_IDS.INSPECTOR);
        return true;
      case 'm':
        event.preventDefault();
        handleMenuAction(COMMAND_IDS.ADD_COMMENT);
        return true;
      case 't':
        event.preventDefault();
        handleMenuAction(COMMAND_IDS.TOGGLE_TYPEWRITER_MODE);
        return true;
    }
  }

  if (event.key === 'Escape' && focusMode) {
    handleMenuAction(COMMAND_IDS.TOGGLE_FOCUS_MODE);
    return true;
  }

  return false;
}

export function useAppKeyboardShortcuts({
  editor,
  findReplace,
  fileInputRef,
  importInputRef,
  projectFileInputRef,
  createChapter,
  handleExportBackup,
  handleSaveProjectFile,
  openModal,
  toggleModal,
  dispatch,
  updateSettings,
  settings,
  showToast,
  createCommentFromSelection,
  setInspectorOpen,
  setQuickSwitcherOpen,
  openRecentProjects,
  reopenLastProject,
}: UseAppKeyboardShortcutsParams) {
  const handleMenuAction = useCallback((action: CommandId) => {
    runCommand(action, {
      editor,
      fileInputRef,
      importInputRef,
      projectFileInputRef,
      createChapter,
      handleExportBackup,
      handleSaveProjectFile,
      openRecentProjects,
      reopenLastProject,
      openModal,
      toggleModal,
      toggleInspector: () => setInspectorOpen(prev => !prev),
      openQuickSwitcher: () => setQuickSwitcherOpen(true),
      toggleSidebar: () => dispatch({ type: 'TOGGLE_SIDEBAR' }),
      togglePageView: () => dispatch({ type: 'TOGGLE_PAGE_VIEW' }),
      toggleFocusMode: () => dispatch({ type: 'TOGGLE_FOCUS_MODE' }),
      toggleTypewriterMode: () => updateSettings({ typewriterMode: !settings.typewriterMode }),
      setTheme: (theme) => dispatch({ type: 'SET_THEME', payload: theme }),
      showToast,
      createCommentFromSelection,
    });
  }, [createCommentFromSelection, createChapter, dispatch, editor, fileInputRef, handleExportBackup, handleSaveProjectFile, importInputRef, openModal, openRecentProjects, projectFileInputRef, reopenLastProject, settings.typewriterMode, setInspectorOpen, setQuickSwitcherOpen, showToast, toggleModal, updateSettings]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleKeyboardShortcut({
        event,
        findReplace,
        handleMenuAction,
        toggleQuickSwitcher: () => setQuickSwitcherOpen(prev => !prev),
        focusMode: settings.focusMode,
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [findReplace, handleMenuAction, setQuickSwitcherOpen, settings.focusMode]);

  useEffect(() => {
    const handleAddComment = () => handleMenuAction(COMMAND_IDS.ADD_COMMENT);
    window.addEventListener('writer1:add-comment', handleAddComment as EventListener);
    return () => window.removeEventListener('writer1:add-comment', handleAddComment as EventListener);
  }, [handleMenuAction]);

  return { handleMenuAction };
}
