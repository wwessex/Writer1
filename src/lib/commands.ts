import type { Editor } from '@tiptap/react';
import type { RefObject } from 'react';
import type { ModalKey } from '@/hooks/useModalState';
import type { ProjectType } from '@/types';
export const COMMAND_IDS = {
  NEW_CHAPTER: 'newChapter',
  EXPORT: 'export',
  IMPORT_DOCUMENT: 'importDocument',
  SAVE_PROJECT_FILE: 'saveProjectFile',
  OPEN_PROJECT_FILE: 'openProjectFile',
  OPEN_RECENT: 'openRecent',
  REOPEN_LAST_PROJECT: 'reopenLastProject',
  EXPORT_BACKUP: 'exportBackup',
  IMPORT_BACKUP: 'importBackup',
  SETTINGS: 'settings',
  SNAPSHOTS: 'snapshots',
  ANALYSIS: 'analysis',
  WORD_COUNT: 'wordCount',
  DASHBOARD: 'dashboard',
  ONBOARDING: 'onboarding',
  ABOUT: 'about',
  CHARACTER_BIBLE: 'characterBible',
  AI_WRITING: 'aiWriting',
  COMMENTS: 'comments',
  ADD_COMMENT: 'addComment',
  ADVANCED_ANALYTICS: 'advancedAnalytics',
  INTEGRATIONS: 'integrations',
  PROJECTS: 'projects',
  SCENE_TEMPLATES: 'sceneTemplates',
  EXPORT_HISTORY: 'exportHistory',
  AI_PANEL: 'aiPanel',
  TRANSLATION: 'translation',
  CORKBOARD: 'corkboard',
  INSPECTOR: 'inspector',
  QUICK_SWITCHER: 'quickSwitcher',
  TOGGLE_SIDEBAR: 'toggleSidebar',
  TOGGLE_PAGE_VIEW: 'togglePageView',
  TOGGLE_FOCUS_MODE: 'toggleFocusMode',
  THEME_DARK: 'themeDark',
  THEME_LIGHT: 'themeLight',
  THEME_HIGH_CONTRAST: 'themeHighContrast',
  UNDO: 'undo',
  REDO: 'redo',
  CUT: 'cut',
  COPY: 'copy',
  PASTE: 'paste',
  SELECT_ALL: 'selectAll',
  INSERT_HR: 'insertHr',
  INSERT_BLOCKQUOTE: 'insertBlockquote',
  FORMAT_BOLD: 'formatBold',
  FORMAT_ITALIC: 'formatItalic',
  FORMAT_UNDERLINE: 'formatUnderline',
  FORMAT_H1: 'formatH1',
  FORMAT_H2: 'formatH2',
  FORMAT_P: 'formatP',
  TOGGLE_TYPEWRITER_MODE: 'toggleTypewriterMode',
  STORY_CARDS: 'storyCards',
  WRITING_SPRINT: 'writingSprint',
  GUIDED_FLOW: 'guidedFlow',
  COVER_DESIGN: 'coverDesign',
  SHARE: 'share',
  FACT_CHECK: 'factCheck',
  RESEARCH: 'research',
} as const;

export type CommandId = typeof COMMAND_IDS[keyof typeof COMMAND_IDS];

export type CommandGroup = 'Actions' | 'Navigation' | 'Views' | 'AI' | 'Project';

export interface CommandMetadata {
  id: CommandId;
  label: string;
  icon: string;
  shortcut?: string;
  group: CommandGroup;
  projectTypes?: ProjectType[];
  includeInQuickSwitcher?: boolean;
}

export const COMMAND_METADATA: Record<CommandId, CommandMetadata> = {
  [COMMAND_IDS.NEW_CHAPTER]: { id: COMMAND_IDS.NEW_CHAPTER, label: 'New Chapter', icon: 'add', shortcut: 'Ctrl+Shift+N', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.EXPORT]: { id: COMMAND_IDS.EXPORT, label: 'Export…', icon: 'download', shortcut: 'Ctrl+Shift+E', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.IMPORT_DOCUMENT]: { id: COMMAND_IDS.IMPORT_DOCUMENT, label: 'Import Document…', icon: 'upload', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.SAVE_PROJECT_FILE]: { id: COMMAND_IDS.SAVE_PROJECT_FILE, label: 'Save Project File (.dhproj)', icon: 'save', shortcut: 'Ctrl+S', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.OPEN_PROJECT_FILE]: { id: COMMAND_IDS.OPEN_PROJECT_FILE, label: 'Open Project File (.dhproj)', icon: 'folder_open', shortcut: 'Ctrl+O', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.OPEN_RECENT]: { id: COMMAND_IDS.OPEN_RECENT, label: 'Open Recent…', icon: 'history', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.REOPEN_LAST_PROJECT]: { id: COMMAND_IDS.REOPEN_LAST_PROJECT, label: 'Reopen Last Project', icon: 'restore', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.EXPORT_BACKUP]: { id: COMMAND_IDS.EXPORT_BACKUP, label: 'Export Backup', icon: 'archive', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.IMPORT_BACKUP]: { id: COMMAND_IDS.IMPORT_BACKUP, label: 'Import Backup', icon: 'unarchive', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.SETTINGS]: { id: COMMAND_IDS.SETTINGS, label: 'Settings', icon: 'settings', group: 'Navigation', includeInQuickSwitcher: true },
  [COMMAND_IDS.SNAPSHOTS]: { id: COMMAND_IDS.SNAPSHOTS, label: 'Snapshots', icon: 'history', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.ANALYSIS]: { id: COMMAND_IDS.ANALYSIS, label: 'Writing Analysis', icon: 'analytics', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.WORD_COUNT]: { id: COMMAND_IDS.WORD_COUNT, label: 'Word Count', icon: 'pin', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.DASHBOARD]: { id: COMMAND_IDS.DASHBOARD, label: 'Project Dashboard', icon: 'dashboard', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.ONBOARDING]: { id: COMMAND_IDS.ONBOARDING, label: 'Getting Started', icon: 'school', group: 'Navigation', includeInQuickSwitcher: true },
  [COMMAND_IDS.ABOUT]: { id: COMMAND_IDS.ABOUT, label: 'About DraftHarbour Studio', icon: 'info', group: 'Navigation', includeInQuickSwitcher: true },
  [COMMAND_IDS.CHARACTER_BIBLE]: { id: COMMAND_IDS.CHARACTER_BIBLE, label: 'Character & World Bible', icon: 'person', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.AI_WRITING]: { id: COMMAND_IDS.AI_WRITING, label: 'AI Writing Tools', icon: 'auto_awesome', group: 'AI', includeInQuickSwitcher: true },
  [COMMAND_IDS.COMMENTS]: { id: COMMAND_IDS.COMMENTS, label: 'Comments', icon: 'comment', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.ADD_COMMENT]: { id: COMMAND_IDS.ADD_COMMENT, label: 'Add Comment', icon: 'add_comment', shortcut: 'Ctrl+Shift+M', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.ADVANCED_ANALYTICS]: { id: COMMAND_IDS.ADVANCED_ANALYTICS, label: 'Advanced Analytics', icon: 'query_stats', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.INTEGRATIONS]: { id: COMMAND_IDS.INTEGRATIONS, label: 'Integrations', icon: 'hub', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.PROJECTS]: { id: COMMAND_IDS.PROJECTS, label: 'Projects…', icon: 'folder_open', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.SCENE_TEMPLATES]: { id: COMMAND_IDS.SCENE_TEMPLATES, label: 'Scene Templates', icon: 'description', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.EXPORT_HISTORY]: { id: COMMAND_IDS.EXPORT_HISTORY, label: 'Export History', icon: 'schedule', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.AI_PANEL]: { id: COMMAND_IDS.AI_PANEL, label: 'AI Suggestions Panel', icon: 'assistant', group: 'AI', includeInQuickSwitcher: true },
  [COMMAND_IDS.TRANSLATION]: { id: COMMAND_IDS.TRANSLATION, label: 'Translate...', icon: 'translate', group: 'AI', includeInQuickSwitcher: true },
  [COMMAND_IDS.CORKBOARD]: { id: COMMAND_IDS.CORKBOARD, label: 'Corkboard View', icon: 'view_module', group: 'Views', includeInQuickSwitcher: true },
  [COMMAND_IDS.INSPECTOR]: { id: COMMAND_IDS.INSPECTOR, label: 'Toggle Inspector', icon: 'info', shortcut: 'Ctrl+Shift+I', group: 'Views', includeInQuickSwitcher: true },
  [COMMAND_IDS.QUICK_SWITCHER]: { id: COMMAND_IDS.QUICK_SWITCHER, label: 'Quick Switcher', icon: 'search', shortcut: 'Ctrl+K', group: 'Navigation' },
  [COMMAND_IDS.TOGGLE_SIDEBAR]: { id: COMMAND_IDS.TOGGLE_SIDEBAR, label: 'Toggle Sidebar', icon: 'side_navigation', shortcut: 'Ctrl+Shift+B', group: 'Views', includeInQuickSwitcher: true },
  [COMMAND_IDS.TOGGLE_PAGE_VIEW]: { id: COMMAND_IDS.TOGGLE_PAGE_VIEW, label: 'Toggle Page View', icon: 'article', group: 'Views', includeInQuickSwitcher: true },
  [COMMAND_IDS.TOGGLE_FOCUS_MODE]: { id: COMMAND_IDS.TOGGLE_FOCUS_MODE, label: 'Toggle Focus Mode', icon: 'center_focus_strong', shortcut: 'Ctrl+Shift+F', group: 'Views', includeInQuickSwitcher: true },
  [COMMAND_IDS.THEME_DARK]: { id: COMMAND_IDS.THEME_DARK, label: 'True Dark', icon: 'dark_mode', group: 'Views', includeInQuickSwitcher: true },
  [COMMAND_IDS.THEME_LIGHT]: { id: COMMAND_IDS.THEME_LIGHT, label: 'Warm Light', icon: 'light_mode', group: 'Views', includeInQuickSwitcher: true },
  [COMMAND_IDS.THEME_HIGH_CONTRAST]: { id: COMMAND_IDS.THEME_HIGH_CONTRAST, label: 'High Contrast', icon: 'contrast', group: 'Views', includeInQuickSwitcher: true },
  [COMMAND_IDS.UNDO]: { id: COMMAND_IDS.UNDO, label: 'Undo', icon: 'undo', shortcut: 'Ctrl+Z', group: 'Actions' },
  [COMMAND_IDS.REDO]: { id: COMMAND_IDS.REDO, label: 'Redo', icon: 'redo', shortcut: 'Ctrl+Y', group: 'Actions' },
  [COMMAND_IDS.CUT]: { id: COMMAND_IDS.CUT, label: 'Cut', icon: 'content_cut', shortcut: 'Ctrl+X', group: 'Actions' },
  [COMMAND_IDS.COPY]: { id: COMMAND_IDS.COPY, label: 'Copy', icon: 'content_copy', shortcut: 'Ctrl+C', group: 'Actions' },
  [COMMAND_IDS.PASTE]: { id: COMMAND_IDS.PASTE, label: 'Paste', icon: 'content_paste', shortcut: 'Ctrl+V', group: 'Actions' },
  [COMMAND_IDS.SELECT_ALL]: { id: COMMAND_IDS.SELECT_ALL, label: 'Select All', icon: 'select_all', shortcut: 'Ctrl+A', group: 'Actions' },
  [COMMAND_IDS.INSERT_HR]: { id: COMMAND_IDS.INSERT_HR, label: 'Insert Horizontal Rule', icon: 'horizontal_rule', group: 'Actions' },
  [COMMAND_IDS.INSERT_BLOCKQUOTE]: { id: COMMAND_IDS.INSERT_BLOCKQUOTE, label: 'Insert Blockquote', icon: 'format_quote', group: 'Actions' },
  [COMMAND_IDS.FORMAT_BOLD]: { id: COMMAND_IDS.FORMAT_BOLD, label: 'Bold', icon: 'format_bold', shortcut: 'Ctrl+B', group: 'Actions' },
  [COMMAND_IDS.FORMAT_ITALIC]: { id: COMMAND_IDS.FORMAT_ITALIC, label: 'Italic', icon: 'format_italic', shortcut: 'Ctrl+I', group: 'Actions' },
  [COMMAND_IDS.FORMAT_UNDERLINE]: { id: COMMAND_IDS.FORMAT_UNDERLINE, label: 'Underline', icon: 'format_underlined', shortcut: 'Ctrl+U', group: 'Actions' },
  [COMMAND_IDS.FORMAT_H1]: { id: COMMAND_IDS.FORMAT_H1, label: 'Heading 1', icon: 'looks_one', group: 'Actions' },
  [COMMAND_IDS.FORMAT_H2]: { id: COMMAND_IDS.FORMAT_H2, label: 'Heading 2', icon: 'looks_two', group: 'Actions' },
  [COMMAND_IDS.FORMAT_P]: { id: COMMAND_IDS.FORMAT_P, label: 'Paragraph', icon: 'subject', group: 'Actions' },
  [COMMAND_IDS.TOGGLE_TYPEWRITER_MODE]: { id: COMMAND_IDS.TOGGLE_TYPEWRITER_MODE, label: 'Toggle Typewriter Mode', icon: 'keyboard', shortcut: 'Ctrl+Shift+T', group: 'Views', includeInQuickSwitcher: true },
  [COMMAND_IDS.STORY_CARDS]: { id: COMMAND_IDS.STORY_CARDS, label: 'Story Cards', icon: 'contact_page', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.WRITING_SPRINT]: { id: COMMAND_IDS.WRITING_SPRINT, label: 'Writing Sprint', icon: 'timer', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.GUIDED_FLOW]: { id: COMMAND_IDS.GUIDED_FLOW, label: 'Guided Book Flow', icon: 'route', group: 'AI', includeInQuickSwitcher: true },
  [COMMAND_IDS.COVER_DESIGN]: { id: COMMAND_IDS.COVER_DESIGN, label: 'Cover Design Studio', icon: 'palette', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.SHARE]: { id: COMMAND_IDS.SHARE, label: 'Share & Collaborate', icon: 'group', group: 'Project', includeInQuickSwitcher: true },
  [COMMAND_IDS.FACT_CHECK]: { id: COMMAND_IDS.FACT_CHECK, label: 'Fact Check', icon: 'fact_check', group: 'AI', includeInQuickSwitcher: true },
  [COMMAND_IDS.RESEARCH]: { id: COMMAND_IDS.RESEARCH, label: 'Research Library', icon: 'science', group: 'Project', includeInQuickSwitcher: true },
};

export interface CommandContext {
  editor: Editor | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  importInputRef: RefObject<HTMLInputElement | null>;
  projectFileInputRef: RefObject<HTMLInputElement | null>;
  createChapter: () => void;
  handleExportBackup: () => void;
  handleSaveProjectFile: () => void;
  openRecentProjects: () => void;
  reopenLastProject: () => void;
  openModal: (id: ModalKey) => void;
  toggleModal: (id: ModalKey) => void;
  toggleInspector: () => void;
  openQuickSwitcher: () => void;
  toggleSidebar: () => void;
  togglePageView: () => void;
  toggleFocusMode: () => void;
  toggleTypewriterMode: () => void;
  setTheme: (theme: 'dark' | 'light' | 'high-contrast') => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;
  createCommentFromSelection: () => void;
}

type CommandHandler = (context: CommandContext) => void;

export const COMMAND_HANDLERS: Record<CommandId, CommandHandler> = {
  [COMMAND_IDS.NEW_CHAPTER]: ({ createChapter, showToast }) => {
    createChapter();
    showToast('New chapter created', 'success', 'add');
  },
  [COMMAND_IDS.EXPORT]: ({ openModal }) => openModal('export'),
  [COMMAND_IDS.IMPORT_DOCUMENT]: ({ importInputRef }) => importInputRef.current?.click(),
  [COMMAND_IDS.SAVE_PROJECT_FILE]: ({ handleSaveProjectFile }) => handleSaveProjectFile(),
  [COMMAND_IDS.OPEN_PROJECT_FILE]: ({ projectFileInputRef }) => projectFileInputRef.current?.click(),
  [COMMAND_IDS.OPEN_RECENT]: ({ openRecentProjects }) => openRecentProjects(),
  [COMMAND_IDS.REOPEN_LAST_PROJECT]: ({ reopenLastProject }) => reopenLastProject(),
  [COMMAND_IDS.EXPORT_BACKUP]: ({ handleExportBackup }) => handleExportBackup(),
  [COMMAND_IDS.IMPORT_BACKUP]: ({ fileInputRef }) => fileInputRef.current?.click(),
  [COMMAND_IDS.SETTINGS]: ({ openModal }) => openModal('settings'),
  [COMMAND_IDS.SNAPSHOTS]: ({ openModal }) => openModal('snapshot'),
  [COMMAND_IDS.ANALYSIS]: ({ openModal }) => openModal('analysis'),
  [COMMAND_IDS.WORD_COUNT]: ({ openModal }) => openModal('wordCount'),
  [COMMAND_IDS.DASHBOARD]: ({ openModal }) => openModal('dashboard'),
  [COMMAND_IDS.ONBOARDING]: ({ openModal }) => openModal('onboarding'),
  [COMMAND_IDS.ABOUT]: ({ openModal }) => openModal('about'),
  [COMMAND_IDS.CHARACTER_BIBLE]: ({ openModal }) => openModal('characterBible'),
  [COMMAND_IDS.AI_WRITING]: ({ openModal }) => openModal('aiWriting'),
  [COMMAND_IDS.COMMENTS]: ({ openModal }) => openModal('comments'),
  [COMMAND_IDS.ADD_COMMENT]: ({ createCommentFromSelection }) => createCommentFromSelection(),
  [COMMAND_IDS.ADVANCED_ANALYTICS]: ({ openModal }) => openModal('advancedAnalytics'),
  [COMMAND_IDS.INTEGRATIONS]: ({ openModal }) => openModal('integrations'),
  [COMMAND_IDS.PROJECTS]: ({ openModal }) => openModal('projects'),
  [COMMAND_IDS.SCENE_TEMPLATES]: ({ openModal }) => openModal('sceneTemplates'),
  [COMMAND_IDS.EXPORT_HISTORY]: ({ openModal }) => openModal('exportHistory'),
  [COMMAND_IDS.AI_PANEL]: ({ toggleModal }) => toggleModal('aiPanel'),
  [COMMAND_IDS.TRANSLATION]: ({ openModal }) => openModal('translation'),
  [COMMAND_IDS.CORKBOARD]: ({ openModal }) => openModal('corkboard'),
  [COMMAND_IDS.INSPECTOR]: ({ toggleInspector }) => toggleInspector(),
  [COMMAND_IDS.QUICK_SWITCHER]: ({ openQuickSwitcher }) => openQuickSwitcher(),
  [COMMAND_IDS.TOGGLE_SIDEBAR]: ({ toggleSidebar }) => toggleSidebar(),
  [COMMAND_IDS.TOGGLE_PAGE_VIEW]: ({ togglePageView }) => togglePageView(),
  [COMMAND_IDS.TOGGLE_FOCUS_MODE]: ({ toggleFocusMode }) => toggleFocusMode(),
  [COMMAND_IDS.THEME_DARK]: ({ setTheme }) => setTheme('dark'),
  [COMMAND_IDS.THEME_LIGHT]: ({ setTheme }) => setTheme('light'),
  [COMMAND_IDS.THEME_HIGH_CONTRAST]: ({ setTheme }) => setTheme('high-contrast'),
  [COMMAND_IDS.UNDO]: ({ editor }) => editor?.chain().focus().undo().run(),
  [COMMAND_IDS.REDO]: ({ editor }) => editor?.chain().focus().redo().run(),
  [COMMAND_IDS.CUT]: ({ editor }) => {
    if (editor?.isFocused) {
      editor.commands.deleteSelection();
      return;
    }
    document.execCommand('cut');
  },
  [COMMAND_IDS.COPY]: ({ editor }) => {
    if (editor?.isFocused) {
      document.execCommand('copy');
      return;
    }
    document.execCommand('copy');
  },
  [COMMAND_IDS.PASTE]: () => {
    document.execCommand('paste');
  },
  [COMMAND_IDS.SELECT_ALL]: ({ editor }) => editor?.commands.selectAll(),
  [COMMAND_IDS.INSERT_HR]: ({ editor }) => editor?.chain().focus().setHorizontalRule().run(),
  [COMMAND_IDS.INSERT_BLOCKQUOTE]: ({ editor }) => editor?.chain().focus().toggleBlockquote().run(),
  [COMMAND_IDS.FORMAT_BOLD]: ({ editor }) => editor?.chain().focus().toggleBold().run(),
  [COMMAND_IDS.FORMAT_ITALIC]: ({ editor }) => editor?.chain().focus().toggleItalic().run(),
  [COMMAND_IDS.FORMAT_UNDERLINE]: ({ editor }) => editor?.chain().focus().toggleUnderline().run(),
  [COMMAND_IDS.FORMAT_H1]: ({ editor }) => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
  [COMMAND_IDS.FORMAT_H2]: ({ editor }) => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
  [COMMAND_IDS.FORMAT_P]: ({ editor }) => editor?.chain().focus().setParagraph().run(),
  [COMMAND_IDS.TOGGLE_TYPEWRITER_MODE]: ({ toggleTypewriterMode }) => toggleTypewriterMode(),
  [COMMAND_IDS.STORY_CARDS]: ({ openModal }) => openModal('storyCards'),
  [COMMAND_IDS.WRITING_SPRINT]: ({ openModal }) => openModal('writingSprint'),
  [COMMAND_IDS.GUIDED_FLOW]: ({ openModal }) => openModal('guidedFlow'),
  [COMMAND_IDS.COVER_DESIGN]: ({ openModal }) => openModal('coverDesign'),
  [COMMAND_IDS.SHARE]: ({ openModal }) => openModal('share'),
  [COMMAND_IDS.FACT_CHECK]: ({ showToast }) => showToast('Select text and use /factcheck inline command', 'info', 'fact_check'),
  [COMMAND_IDS.RESEARCH]: ({ showToast }) => showToast('Research panel — toggle from the sidebar', 'info', 'science'),
};

export const LOCAL_MENU_COMMANDS: ReadonlySet<CommandId> = new Set([
  COMMAND_IDS.TOGGLE_SIDEBAR,
  COMMAND_IDS.TOGGLE_PAGE_VIEW,
  COMMAND_IDS.TOGGLE_FOCUS_MODE,
  COMMAND_IDS.THEME_DARK,
  COMMAND_IDS.THEME_LIGHT,
  COMMAND_IDS.THEME_HIGH_CONTRAST,
]);

interface CommandStateContext {
  editorFocused: boolean;
  hasSelection: boolean;
}

const REQUIRES_EDITOR_FOCUS = new Set<CommandId>([
  COMMAND_IDS.UNDO,
  COMMAND_IDS.REDO,
  COMMAND_IDS.CUT,
  COMMAND_IDS.COPY,
  COMMAND_IDS.PASTE,
  COMMAND_IDS.SELECT_ALL,
  COMMAND_IDS.INSERT_HR,
  COMMAND_IDS.INSERT_BLOCKQUOTE,
  COMMAND_IDS.FORMAT_BOLD,
  COMMAND_IDS.FORMAT_ITALIC,
  COMMAND_IDS.FORMAT_UNDERLINE,
  COMMAND_IDS.FORMAT_H1,
  COMMAND_IDS.FORMAT_H2,
  COMMAND_IDS.FORMAT_P,
]);

const REQUIRES_SELECTION = new Set<CommandId>([
  COMMAND_IDS.CUT,
  COMMAND_IDS.COPY,
  COMMAND_IDS.ADD_COMMENT,
]);

export const isCommandEnabled = (commandId: CommandId, context: CommandStateContext) => {
  if (REQUIRES_EDITOR_FOCUS.has(commandId) && !context.editorFocused) {
    return false;
  }

  if (REQUIRES_SELECTION.has(commandId) && !context.hasSelection) {
    return false;
  }

  return true;
};

export const runCommand = (action: CommandId, context: CommandContext) => {
  COMMAND_HANDLERS[action](context);
};
