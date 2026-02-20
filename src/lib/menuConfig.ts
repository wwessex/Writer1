import { COMMAND_IDS, type CommandId } from '@/lib/commands';

export interface AppMenuItem {
  label?: string;
  action?: CommandId;
  shortcut?: string;
  divider?: boolean;
  disabled?: boolean;
}

export interface AppMenuConfig {
  label: string;
  items: AppMenuItem[];
}

export const APP_MENUS: AppMenuConfig[] = [
  {
    label: 'File',
    items: [
      { label: 'Projects...', action: COMMAND_IDS.PROJECTS },
      { divider: true },
      { label: 'New Chapter', action: COMMAND_IDS.NEW_CHAPTER, shortcut: 'Ctrl+Shift+N' },
      { divider: true },
      { label: 'Save Project File (.dhproj)', action: COMMAND_IDS.SAVE_PROJECT_FILE, shortcut: 'Ctrl+S' },
      { label: 'Open Project File (.dhproj)', action: COMMAND_IDS.OPEN_PROJECT_FILE, shortcut: 'Ctrl+O' },
      { divider: true },
      { label: 'Export...', action: COMMAND_IDS.EXPORT, shortcut: 'Ctrl+Shift+E' },
      { label: 'Import Document...', action: COMMAND_IDS.IMPORT_DOCUMENT },
      { divider: true },
      { label: 'Export Backup', action: COMMAND_IDS.EXPORT_BACKUP },
      { label: 'Import Backup', action: COMMAND_IDS.IMPORT_BACKUP },
      { label: 'Export History...', action: COMMAND_IDS.EXPORT_HISTORY },
      { divider: true },
      { label: 'Settings', action: COMMAND_IDS.SETTINGS }
    ]
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', action: COMMAND_IDS.UNDO, shortcut: 'Ctrl+Z' },
      { label: 'Redo', action: COMMAND_IDS.REDO, shortcut: 'Ctrl+Y' },
      { divider: true },
      { label: 'Select All', action: COMMAND_IDS.SELECT_ALL, shortcut: 'Ctrl+A' }
    ]
  },
  {
    label: 'View',
    items: [
      { label: 'Toggle Sidebar', action: COMMAND_IDS.TOGGLE_SIDEBAR, shortcut: 'Ctrl+Shift+B' },
      { label: 'Toggle Inspector', action: COMMAND_IDS.INSPECTOR, shortcut: 'Ctrl+Shift+I' },
      { label: 'Toggle Page View', action: COMMAND_IDS.TOGGLE_PAGE_VIEW },
      { label: 'Focus Mode', action: COMMAND_IDS.TOGGLE_FOCUS_MODE, shortcut: 'Ctrl+Shift+F' },
      { divider: true },
      { label: 'Quick Switcher', action: COMMAND_IDS.QUICK_SWITCHER, shortcut: 'Ctrl+K' },
      { divider: true },
      { label: 'True Dark', action: COMMAND_IDS.THEME_DARK },
      { label: 'Warm Light (Default)', action: COMMAND_IDS.THEME_LIGHT },
      { label: 'High Contrast (Optional)', action: COMMAND_IDS.THEME_HIGH_CONTRAST },
      { divider: true },
      { label: 'Project Dashboard', action: COMMAND_IDS.DASHBOARD }
    ]
  },
  {
    label: 'Insert',
    items: [
      { label: 'Horizontal Rule', action: COMMAND_IDS.INSERT_HR },
      { label: 'Blockquote', action: COMMAND_IDS.INSERT_BLOCKQUOTE }
    ]
  },
  {
    label: 'Format',
    items: [
      { label: 'Bold', action: COMMAND_IDS.FORMAT_BOLD, shortcut: 'Ctrl+B' },
      { label: 'Italic', action: COMMAND_IDS.FORMAT_ITALIC, shortcut: 'Ctrl+I' },
      { label: 'Underline', action: COMMAND_IDS.FORMAT_UNDERLINE, shortcut: 'Ctrl+U' },
      { divider: true },
      { label: 'Heading 1', action: COMMAND_IDS.FORMAT_H1 },
      { label: 'Heading 2', action: COMMAND_IDS.FORMAT_H2 },
      { label: 'Paragraph', action: COMMAND_IDS.FORMAT_P }
    ]
  },
  {
    label: 'Tools',
    items: [
      { label: 'Snapshots...', action: COMMAND_IDS.SNAPSHOTS },
      { label: 'Writing Analysis...', action: COMMAND_IDS.ANALYSIS },
      { label: 'Advanced Analytics...', action: COMMAND_IDS.ADVANCED_ANALYTICS },
      { label: 'Word Count...', action: COMMAND_IDS.WORD_COUNT },
      { divider: true },
      { label: 'Character & World Bible...', action: COMMAND_IDS.CHARACTER_BIBLE },
      { label: 'Scene Templates...', action: COMMAND_IDS.SCENE_TEMPLATES },
      { divider: true },
      { label: 'AI Writing Tools...', action: COMMAND_IDS.AI_WRITING },
      { label: 'AI Suggestions Panel', action: COMMAND_IDS.AI_PANEL },
      { label: 'Translate...', action: COMMAND_IDS.TRANSLATION },
      { label: 'Add Comment', action: COMMAND_IDS.ADD_COMMENT, shortcut: 'Ctrl+Shift+M' },
      { label: 'Comments...', action: COMMAND_IDS.COMMENTS },
      { divider: true },
      { label: 'Integrations...', action: COMMAND_IDS.INTEGRATIONS }
    ]
  },
  {
    label: 'Help',
    items: [
      { label: 'Getting Started', action: COMMAND_IDS.ONBOARDING },
      { label: 'About DraftHarbour Studio', action: COMMAND_IDS.ABOUT }
    ]
  }
];
