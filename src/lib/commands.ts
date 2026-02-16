import type { Editor } from '@tiptap/react';
import type { RefObject } from 'react';
import type { ModalKey } from '@/hooks/useModalState';
export const COMMAND_IDS = {
  NEW_CHAPTER: 'newChapter',
  EXPORT: 'export',
  IMPORT_DOCUMENT: 'importDocument',
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
  ADVANCED_ANALYTICS: 'advancedAnalytics',
  INTEGRATIONS: 'integrations',
  PROJECTS: 'projects',
  SCENE_TEMPLATES: 'sceneTemplates',
  EXPORT_HISTORY: 'exportHistory',
  AI_PANEL: 'aiPanel',
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
  SELECT_ALL: 'selectAll',
  INSERT_HR: 'insertHr',
  INSERT_BLOCKQUOTE: 'insertBlockquote',
  FORMAT_BOLD: 'formatBold',
  FORMAT_ITALIC: 'formatItalic',
  FORMAT_UNDERLINE: 'formatUnderline',
  FORMAT_H1: 'formatH1',
  FORMAT_H2: 'formatH2',
  FORMAT_P: 'formatP',
} as const;

export type CommandId = typeof COMMAND_IDS[keyof typeof COMMAND_IDS];

export interface CommandContext {
  editor: Editor | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  importInputRef: RefObject<HTMLInputElement | null>;
  createChapter: () => void;
  handleExportBackup: () => void;
  openModal: (id: ModalKey) => void;
  toggleModal: (id: ModalKey) => void;
  toggleInspector: () => void;
  openQuickSwitcher: () => void;
  toggleSidebar: () => void;
  togglePageView: () => void;
  toggleFocusMode: () => void;
  setTheme: (theme: 'dark' | 'light' | 'high-contrast') => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;
}

type CommandHandler = (context: CommandContext) => void;

export const COMMAND_HANDLERS: Record<CommandId, CommandHandler> = {
  [COMMAND_IDS.NEW_CHAPTER]: ({ createChapter, showToast }) => {
    createChapter();
    showToast('New chapter created', 'success', 'add');
  },
  [COMMAND_IDS.EXPORT]: ({ openModal }) => openModal('export'),
  [COMMAND_IDS.IMPORT_DOCUMENT]: ({ importInputRef }) => importInputRef.current?.click(),
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
  [COMMAND_IDS.ADVANCED_ANALYTICS]: ({ openModal }) => openModal('advancedAnalytics'),
  [COMMAND_IDS.INTEGRATIONS]: ({ openModal }) => openModal('integrations'),
  [COMMAND_IDS.PROJECTS]: ({ openModal }) => openModal('projects'),
  [COMMAND_IDS.SCENE_TEMPLATES]: ({ openModal }) => openModal('sceneTemplates'),
  [COMMAND_IDS.EXPORT_HISTORY]: ({ openModal }) => openModal('exportHistory'),
  [COMMAND_IDS.AI_PANEL]: ({ toggleModal }) => toggleModal('aiPanel'),
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
  [COMMAND_IDS.SELECT_ALL]: ({ editor }) => editor?.commands.selectAll(),
  [COMMAND_IDS.INSERT_HR]: ({ editor }) => editor?.chain().focus().setHorizontalRule().run(),
  [COMMAND_IDS.INSERT_BLOCKQUOTE]: ({ editor }) => editor?.chain().focus().toggleBlockquote().run(),
  [COMMAND_IDS.FORMAT_BOLD]: ({ editor }) => editor?.chain().focus().toggleBold().run(),
  [COMMAND_IDS.FORMAT_ITALIC]: ({ editor }) => editor?.chain().focus().toggleItalic().run(),
  [COMMAND_IDS.FORMAT_UNDERLINE]: ({ editor }) => editor?.chain().focus().toggleUnderline().run(),
  [COMMAND_IDS.FORMAT_H1]: ({ editor }) => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
  [COMMAND_IDS.FORMAT_H2]: ({ editor }) => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
  [COMMAND_IDS.FORMAT_P]: ({ editor }) => editor?.chain().focus().setParagraph().run(),
};

export const LOCAL_MENU_COMMANDS: ReadonlySet<CommandId> = new Set([
  COMMAND_IDS.TOGGLE_SIDEBAR,
  COMMAND_IDS.TOGGLE_PAGE_VIEW,
  COMMAND_IDS.TOGGLE_FOCUS_MODE,
  COMMAND_IDS.THEME_DARK,
  COMMAND_IDS.THEME_LIGHT,
  COMMAND_IDS.THEME_HIGH_CONTRAST,
]);

export const runCommand = (action: CommandId, context: CommandContext) => {
  COMMAND_HANDLERS[action](context);
};
