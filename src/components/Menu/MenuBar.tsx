import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { COMMAND_IDS, LOCAL_MENU_COMMANDS, type CommandId } from '@/lib/commands';
import styles from './Menu.module.css';

interface MenuItem {
  label?: string;
  action?: CommandId;
  shortcut?: string;
  divider?: boolean;
  disabled?: boolean;
}

interface MenuConfig {
  label: string;
  items: MenuItem[];
}

const MENUS: MenuConfig[] = [
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

interface MenuBarProps {
  onAction?: (action: CommandId) => void;
}

export function MenuBar({ onAction }: MenuBarProps) {
  const { state } = useApp();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  const handleMenuClick = (menuLabel: string) => {
    setOpenMenu(prev => (prev === menuLabel ? null : menuLabel));
  };

  const handleItemClick = (action: CommandId) => {
    setOpenMenu(null);

    if (LOCAL_MENU_COMMANDS.has(action)) {
      onAction?.(action);
      return;
    }

    onAction?.(action);
  };

  // Track whether a touch moved (scrolled) so we don't close the menu on scroll
  const touchMovedRef = useRef(false);

  const handleTouchStart = useCallback(() => {
    touchMovedRef.current = false;
  }, []);

  const handleTouchMove = useCallback(() => {
    touchMovedRef.current = true;
  }, []);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    // Ignore if this was a scroll gesture, not a tap
    if (touchMovedRef.current) return;
    if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
      setOpenMenu(null);
    }
  }, []);

  useEffect(() => {
    if (openMenu) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [openMenu, handleClickOutside, handleTouchStart, handleTouchMove]);

  return (
    <nav className={styles.menuBar} ref={menuBarRef} role="menubar" aria-label="Main menu">
      {MENUS.map(menu => {
        const items = menu.label === 'File'
          ? menu.items.map(item => item.action === COMMAND_IDS.NEW_CHAPTER
            ? { ...item, label: state.projectType === 'screenplay' ? 'New Scene' : 'New Chapter' }
            : item)
          : menu.items;

        return (
        <div key={menu.label} className={styles.menuWrapper}>
          <button
            className={`${styles.menuBtn} ${openMenu === menu.label ? styles['menuBtn--active'] : ''}`}
            onClick={() => handleMenuClick(menu.label)}
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={openMenu === menu.label}
          >
            {menu.label}
          </button>
          {openMenu === menu.label && (
            <div className={styles.menu} role="menu">
              {items.map((item, idx) =>
                item.divider ? (
                  <div key={idx} className={styles.menuDivider} role="separator" />
                ) : (
                  <button
                    key={idx}
                    className={styles.menuItem}
                    onClick={() => item.action && handleItemClick(item.action)}
                    disabled={item.disabled}
                    role="menuitem"
                  >
                    <span className={styles.menuItem__label}>{item.label}</span>
                    {item.shortcut && (
                      <span className={styles.menuItem__shortcut}>{item.shortcut}</span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
        );
      })}
    </nav>
  );
}
