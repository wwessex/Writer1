import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { Input, IconButton } from '@/components/UI';
import { Pill, StatusDot } from '@/components/UI/Pill';
import { MenuBar } from '@/components/Menu/MenuBar';
import { Toolbar } from './Toolbar';
import { countWords, editorToPlainText } from '@/lib/utils';
import styles from './Header.module.css';

interface HeaderProps {
  onAction?: (action: string) => void;
  onToggleInspector?: () => void;
  inspectorOpen?: boolean;
}

const MOBILE_MENU_ITEMS = [
  { label: 'Projects...', action: 'projects', icon: 'folder_open' },
  { label: 'Export...', action: 'export', icon: 'download' },
  { label: 'Import Document...', action: 'importDocument', icon: 'upload' },
  { label: 'Settings', action: 'settings', icon: 'settings' },
  { label: 'Focus Mode', action: 'toggleFocusMode', icon: 'fullscreen' },
  { label: 'Page View', action: 'togglePageView', icon: 'article' },
  { label: 'Snapshots...', action: 'snapshots', icon: 'history' },
  { label: 'Writing Analysis...', action: 'analysis', icon: 'analytics' },
  { label: 'Quick Switcher', action: 'quickSwitcher', icon: 'search' },
];

export function Header({ onAction, onToggleInspector, inspectorOpen }: HeaderProps) {
  const { state, dispatch, updateNovelTitle } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Calculate word counts
  const totalWords = state.chapters.reduce((sum, ch) => {
    const text = editorToPlainText(ch.content);
    return sum + countWords(text);
  }, 0);

  const activeChapter = state.chapters.find(ch => ch.id === state.activeChapterId);
  const chapterWords = activeChapter
    ? countWords(editorToPlainText(activeChapter.content))
    : 0;

  const toggleSidebar = () => dispatch({ type: 'TOGGLE_SIDEBAR' });

  const handleMobileMenuAction = (action: string) => {
    setMobileMenuOpen(false);
    switch (action) {
      case 'toggleFocusMode':
        dispatch({ type: 'TOGGLE_FOCUS_MODE' });
        break;
      case 'togglePageView':
        dispatch({ type: 'TOGGLE_PAGE_VIEW' });
        break;
      default:
        onAction?.(action);
    }
  };

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
      setMobileMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [mobileMenuOpen, handleClickOutside]);

  return (
    <header className={styles.header}>
      <div className={styles.topbar}>
        <div className={styles.topbar__brand}>
          <IconButton
            icon="menu"
            label="Toggle sidebar"
            onClick={toggleSidebar}
            className={styles.menuBtn}
          />
          <img src={`${import.meta.env.BASE_URL}assets/${state.settings.theme === 'light' ? 'icon-black' : 'icon-blue'}-64.png`} alt="DraftHarbour" className={styles.logo} />
          <Input
            variant="title"
            value={state.novelTitle}
            onChange={e => updateNovelTitle(e.target.value)}
            placeholder="Novel Title"
            className={styles.novelTitle}
          />
        </div>
        <div className={styles.topbar__status}>
          <StatusDot online={state.isOnline} />
          <Pill label="Ch" value={chapterWords.toLocaleString()} />
          <Pill label="Total" value={totalWords.toLocaleString()} />
          {state.settings.dailyWordGoal > 0 && (
            <Pill
              label="Goal"
              value={`${Math.min(100, Math.round((totalWords / state.settings.dailyWordGoal) * 100))}%`}
              variant="accent"
            />
          )}
          {state.isSaving && (
            <span className={styles.savingStatus}>Saving...</span>
          )}
          <IconButton
            icon="info"
            label="Toggle inspector (Ctrl+Shift+I)"
            variant="ghost"
            active={inspectorOpen}
            onClick={onToggleInspector}
            className={styles.inspectorBtn}
          />

          {/* Mobile overflow menu */}
          <div className={styles.mobileOverflow} ref={mobileMenuRef}>
            <IconButton
              icon="more_vert"
              label="More options"
              variant="ghost"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className={styles.mobileOverflowBtn}
            />
            {mobileMenuOpen && (
              <div className={styles.mobileMenu}>
                {MOBILE_MENU_ITEMS.map(item => (
                  <button
                    key={item.action}
                    className={styles.mobileMenuItem}
                    onClick={() => handleMobileMenuAction(item.action)}
                  >
                    <span className="material-symbols-rounded">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <MenuBar onAction={onAction} />
      <Toolbar />
    </header>
  );
}
