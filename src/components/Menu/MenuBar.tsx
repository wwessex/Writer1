import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import styles from './Menu.module.css';

interface MenuItem {
  label?: string;
  action?: string;
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
      { label: 'Projects...', action: 'projects' },
      { divider: true },
      { label: 'New Chapter', action: 'newChapter', shortcut: 'Ctrl+Shift+N' },
      { divider: true },
      { label: 'Export...', action: 'export', shortcut: 'Ctrl+Shift+E' },
      { label: 'Import Document...', action: 'importDocument' },
      { divider: true },
      { label: 'Export Backup', action: 'exportBackup' },
      { label: 'Import Backup', action: 'importBackup' },
      { label: 'Export History...', action: 'exportHistory' },
      { divider: true },
      { label: 'Settings', action: 'settings' }
    ]
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', action: 'undo', shortcut: 'Ctrl+Z' },
      { label: 'Redo', action: 'redo', shortcut: 'Ctrl+Y' },
      { divider: true },
      { label: 'Select All', action: 'selectAll', shortcut: 'Ctrl+A' }
    ]
  },
  {
    label: 'View',
    items: [
      { label: 'Toggle Sidebar', action: 'toggleSidebar', shortcut: 'Ctrl+Shift+B' },
      { label: 'Toggle Inspector', action: 'inspector', shortcut: 'Ctrl+Shift+I' },
      { label: 'Toggle Page View', action: 'togglePageView' },
      { label: 'Focus Mode', action: 'toggleFocusMode', shortcut: 'Ctrl+Shift+F' },
      { divider: true },
      { label: 'Quick Switcher', action: 'quickSwitcher', shortcut: 'Ctrl+K' },
      { divider: true },
      { label: 'Dark Theme', action: 'themeDark' },
      { label: 'Light Theme', action: 'themeLight' },
      { label: 'High Contrast', action: 'themeHighContrast' },
      { divider: true },
      { label: 'Project Dashboard', action: 'dashboard' }
    ]
  },
  {
    label: 'Insert',
    items: [
      { label: 'Horizontal Rule', action: 'insertHr' },
      { label: 'Blockquote', action: 'insertBlockquote' }
    ]
  },
  {
    label: 'Format',
    items: [
      { label: 'Bold', action: 'formatBold', shortcut: 'Ctrl+B' },
      { label: 'Italic', action: 'formatItalic', shortcut: 'Ctrl+I' },
      { label: 'Underline', action: 'formatUnderline', shortcut: 'Ctrl+U' },
      { divider: true },
      { label: 'Heading 1', action: 'formatH1' },
      { label: 'Heading 2', action: 'formatH2' },
      { label: 'Paragraph', action: 'formatP' }
    ]
  },
  {
    label: 'Tools',
    items: [
      { label: 'Snapshots...', action: 'snapshots' },
      { label: 'Writing Analysis...', action: 'analysis' },
      { label: 'Advanced Analytics...', action: 'advancedAnalytics' },
      { label: 'Word Count...', action: 'wordCount' },
      { divider: true },
      { label: 'Character & World Bible...', action: 'characterBible' },
      { label: 'Scene Templates...', action: 'sceneTemplates' },
      { divider: true },
      { label: 'AI Writing Tools...', action: 'aiWriting' },
      { label: 'AI Suggestions Panel', action: 'aiPanel' },
      { label: 'Comments...', action: 'comments' },
      { divider: true },
      { label: 'Integrations...', action: 'integrations' }
    ]
  },
  {
    label: 'Help',
    items: [
      { label: 'Getting Started', action: 'onboarding' },
      { label: 'About DraftHarbour Studio', action: 'about' }
    ]
  }
];

interface MenuBarProps {
  onAction?: (action: string) => void;
}

export function MenuBar({ onAction }: MenuBarProps) {
  const { state, dispatch } = useApp();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  const handleMenuClick = (menuLabel: string) => {
    setOpenMenu(prev => (prev === menuLabel ? null : menuLabel));
  };

  const handleItemClick = (action: string) => {
    setOpenMenu(null);

    switch (action) {
      case 'toggleSidebar':
        dispatch({ type: 'TOGGLE_SIDEBAR' });
        break;
      case 'togglePageView':
        dispatch({ type: 'TOGGLE_PAGE_VIEW' });
        break;
      case 'toggleFocusMode':
        dispatch({ type: 'TOGGLE_FOCUS_MODE' });
        break;
      case 'themeDark':
        dispatch({ type: 'SET_THEME', payload: 'dark' });
        break;
      case 'themeLight':
        dispatch({ type: 'SET_THEME', payload: 'light' });
        break;
      case 'themeHighContrast':
        dispatch({ type: 'SET_THEME', payload: 'high-contrast' });
        break;
      default:
        onAction?.(action);
    }
  };

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
      setOpenMenu(null);
    }
  }, []);

  useEffect(() => {
    if (openMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenu, handleClickOutside]);

  return (
    <nav className={styles.menuBar} ref={menuBarRef} role="menubar" aria-label="Main menu">
      {MENUS.map(menu => {
        const items = menu.label === 'File'
          ? menu.items.map(item => item.action === 'newChapter'
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
