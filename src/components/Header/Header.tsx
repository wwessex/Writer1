import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { Input, IconButton } from '@/components/UI';
import { Pill, StatusDot } from '@/components/UI/Pill';
import { MenuBar } from '@/components/Menu/MenuBar';
import { Toolbar } from './Toolbar';
import { countWords, editorToPlainText } from '@/lib/utils';
import { COMMAND_IDS, type CommandId } from '@/lib/commands';
import styles from './Header.module.css';

interface HeaderProps {
  onAction?: (action: CommandId) => void;
  onToggleInspector?: () => void;
  inspectorOpen?: boolean;
}

interface MobileMenuItem {
  label: string;
  action: CommandId;
  icon: string;
}

interface MobileMenuSection {
  section: 'Write' | 'Navigate' | 'Tools' | 'Project';
  items: MobileMenuItem[];
}

const MOBILE_MENU_SECTIONS: MobileMenuSection[] = [
  {
    section: 'Write',
    items: [
      { label: 'New Chapter', action: COMMAND_IDS.NEW_CHAPTER, icon: 'note_add' },
      { label: 'Quick Switcher', action: COMMAND_IDS.QUICK_SWITCHER, icon: 'search' },
    ]
  },
  {
    section: 'Navigate',
    items: [
      { label: 'Focus Mode', action: COMMAND_IDS.TOGGLE_FOCUS_MODE, icon: 'fullscreen' },
      { label: 'Toggle Page View', action: COMMAND_IDS.TOGGLE_PAGE_VIEW, icon: 'article' },
    ]
  },
  {
    section: 'Tools',
    items: [
      { label: 'Snapshots...', action: COMMAND_IDS.SNAPSHOTS, icon: 'history' },
      { label: 'Writing Analysis...', action: COMMAND_IDS.ANALYSIS, icon: 'analytics' },
      { label: 'Settings', action: COMMAND_IDS.SETTINGS, icon: 'settings' },
    ]
  },
  {
    section: 'Project',
    items: [
      { label: 'Projects...', action: COMMAND_IDS.PROJECTS, icon: 'folder_open' },
      { label: 'Export...', action: COMMAND_IDS.EXPORT, icon: 'download' },
      { label: 'Import Document...', action: COMMAND_IDS.IMPORT_DOCUMENT, icon: 'upload' },
    ]
  },
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
  const newDraftLabel = state.projectType === 'screenplay' ? 'New Scene' : 'New Chapter';

  const handleMobileMenuAction = (action: CommandId) => {
    setMobileMenuOpen(false);
    onAction?.(action);
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

          <div className={styles.mobileQuickActions}>
            <IconButton
              icon="note_add"
              label={newDraftLabel}
              variant="ghost"
              onClick={() => onAction?.(COMMAND_IDS.NEW_CHAPTER)}
              className={styles.mobileQuickActionBtn}
            />
            <IconButton
              icon="search"
              label="Quick Switcher"
              variant="ghost"
              onClick={() => onAction?.(COMMAND_IDS.QUICK_SWITCHER)}
              className={styles.mobileQuickActionBtn}
            />
            <IconButton
              icon="download"
              label="Export..."
              variant="ghost"
              onClick={() => onAction?.(COMMAND_IDS.EXPORT)}
              className={styles.mobileQuickActionBtn}
            />
            <IconButton
              icon="undo"
              label="Undo"
              variant="ghost"
              onClick={() => onAction?.(COMMAND_IDS.UNDO)}
              className={styles.mobileQuickActionBtn}
            />
            <IconButton
              icon="redo"
              label="Redo"
              variant="ghost"
              onClick={() => onAction?.(COMMAND_IDS.REDO)}
              className={styles.mobileQuickActionBtn}
            />
          </div>

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
                {MOBILE_MENU_SECTIONS.map(({ section, items }) => (
                  <div key={section} className={styles.mobileMenuSection}>
                    <div className={styles.mobileMenuSectionTitle}>{section}</div>
                    {items.map(item => (
                      <button
                        key={item.action}
                        className={styles.mobileMenuItem}
                        onClick={() => handleMobileMenuAction(item.action)}
                      >
                        <span className="material-symbols-rounded">{item.icon}</span>
                        <span>{item.action === COMMAND_IDS.NEW_CHAPTER ? newDraftLabel : item.label}</span>
                      </button>
                    ))}
                  </div>
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
