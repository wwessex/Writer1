import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Input, IconButton } from '@/components/UI';
import { Pill, StatusDot } from '@/components/UI/Pill';
import { MenuBar } from '@/components/Menu/MenuBar';
import { Toolbar } from './Toolbar';
import { getProjectMetrics } from '@/lib/projectMetrics';
import { getMonthlyHistory } from '@/lib/progressTracker';
import { createProvider, loadAIConfig } from '@/lib/ai';
import { COMMAND_IDS, COMMAND_METADATA, type CommandId } from '@/lib/commands';
import { APP_MENUS } from '@/lib/menuConfig';
import styles from './Header.module.css';

interface HeaderProps {
  onAction?: (action: CommandId) => void;
  onToggleInspector?: () => void;
  inspectorOpen?: boolean;
  hasTextSelection?: boolean;
}

interface MobileMenuSection {
  section: 'Write' | 'Navigate' | 'Tools' | 'Project';
  items: CommandId[];
}

const MOBILE_SECTION_ORDER: MobileMenuSection['section'][] = ['Write', 'Navigate', 'Tools', 'Project'];

const MOBILE_SECTION_BY_MENU_LABEL: Record<string, MobileMenuSection['section']> = {
  File: 'Project',
  Edit: 'Navigate',
  View: 'Navigate',
  Insert: 'Write',
  Format: 'Write',
  Tools: 'Tools',
  Help: 'Tools',
};

export function Header({ onAction, onToggleInspector, inspectorOpen, hasTextSelection = false }: HeaderProps) {
  const { state, updateNovelTitle } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRootRef = useRef<HTMLDivElement>(null);
  const mobileMenuListRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLDivElement>(null);
  const [mobileMenuHasMore, setMobileMenuHasMore] = useState(false);

  const projectMetrics = useMemo(() => getProjectMetrics(state.chapters), [state.chapters]);
  const totalWords = projectMetrics.totalWords;
  const today = new Date().toISOString().slice(0, 10);
  const todayWords = getMonthlyHistory().find(d => d.date === today)?.wordsWritten ?? 0;

  // Session word count: track how many words were added since page load
  const sessionStartWords = useRef<number | null>(null);
  const previousNovelId = useRef(state.novelId);

  // Reset baseline on project switch
  if (previousNovelId.current !== state.novelId) {
    sessionStartWords.current = totalWords;
    previousNovelId.current = state.novelId;
  }

  // Capture initial word count on first meaningful render
  if (sessionStartWords.current === null) {
    sessionStartWords.current = totalWords;
  }

  const sessionWords = Math.max(0, totalWords - (sessionStartWords.current ?? 0));

  const activeChapter = projectMetrics.chapters.find(ch => ch.id === state.activeChapterId);
  const chapterWords = activeChapter?.words ?? 0;

  const handleMenuButtonClick = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);
  const hasNoChapterContent = totalWords === 0;
  const aiConfigured = useMemo(() => {
    const provider = createProvider(loadAIConfig());
    try {
      return provider.isAvailable();
    } finally {
      provider.destroy();
    }
  }, []);

  const getCommandPresentation = useCallback((commandId: CommandId) => {
    const metadata = COMMAND_METADATA[commandId];
    if (commandId !== COMMAND_IDS.NEW_CHAPTER) {
      return metadata;
    }

    if (state.projectType === 'screenplay') {
      return {
        ...metadata,
        label: 'New Scene',
        icon: 'movie_edit',
      };
    }

    return {
      ...metadata,
      label: 'New Chapter',
      icon: 'note_add',
    };
  }, [state.projectType]);

  const dispatchCommand = useCallback((action: CommandId) => {
    setMobileMenuOpen(false);
    onAction?.(action);
  }, [onAction]);

  const mobileMenuSections = useMemo(() => {
    const sectionMap = new Map<MobileMenuSection['section'], CommandId[]>(
      MOBILE_SECTION_ORDER.map(section => [section, []])
    );

    APP_MENUS.forEach(menu => {
      const section = MOBILE_SECTION_BY_MENU_LABEL[menu.label];
      if (!section) {
        return;
      }

      const target = sectionMap.get(section);
      if (!target) {
        return;
      }

      menu.items.forEach(item => {
        if (!item.action || target.includes(item.action)) {
          return;
        }
        target.push(item.action);
      });
    });

    return MOBILE_SECTION_ORDER
      .map(section => ({ section, items: sectionMap.get(section) ?? [] }))
      .filter(({ items }) => items.length > 0);
  }, []);

  const quickActionCommands = useMemo(() => {
    const selected: CommandId[] = [];
    const addUnique = (command: CommandId) => {
      if (!selected.includes(command)) {
        selected.push(command);
      }
    };

    if (hasTextSelection) {
      [COMMAND_IDS.ADD_COMMENT, COMMAND_IDS.AI_PANEL, COMMAND_IDS.FORMAT_BOLD, COMMAND_IDS.FORMAT_ITALIC].forEach(addUnique);
    }

    if (hasNoChapterContent) {
      [COMMAND_IDS.NEW_CHAPTER, COMMAND_IDS.IMPORT_DOCUMENT].forEach(addUnique);
    }

    if (aiConfigured) {
      selected.unshift(COMMAND_IDS.AI_PANEL);
    }

    const defaults: CommandId[] = [
      COMMAND_IDS.NEW_CHAPTER,
      COMMAND_IDS.QUICK_SWITCHER,
      COMMAND_IDS.EXPORT,
      COMMAND_IDS.UNDO,
      COMMAND_IDS.REDO,
    ];

    defaults.forEach(addUnique);

    return selected.slice(0, 5);
  }, [aiConfigured, hasNoChapterContent, hasTextSelection]);

  const handlePointerDownOutside = useCallback((event: PointerEvent) => {
    const target = event.target as Node;
    if (
      mobileMenuRootRef.current && !mobileMenuRootRef.current.contains(target) &&
      !(burgerRef.current && burgerRef.current.contains(target))
    ) {
      setMobileMenuOpen(false);
    }
  }, []);

  const updateMobileMenuMoreState = useCallback(() => {
    const node = mobileMenuListRef.current;
    if (!node) {
      setMobileMenuHasMore(false);
      return;
    }

    const remaining = node.scrollHeight - node.scrollTop - node.clientHeight;
    setMobileMenuHasMore(remaining > 12);
  }, []);

  const handleMobileMenuMoreClick = useCallback(() => {
    const node = mobileMenuListRef.current;
    if (!node) {
      return;
    }

    node.scrollBy({ top: Math.max(120, Math.round(node.clientHeight * 0.75)), behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    updateMobileMenuMoreState();
    const frameId = window.requestAnimationFrame(updateMobileMenuMoreState);
    const mobileMenuNode = mobileMenuListRef.current;

    document.addEventListener('pointerdown', handlePointerDownOutside, true);
    if (mobileMenuNode) {
      mobileMenuNode.addEventListener('scroll', updateMobileMenuMoreState, { passive: true });
    }

    const handleViewportChange = () => {
      setMobileMenuOpen(false);
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside, true);
      if (mobileMenuNode) {
        mobileMenuNode.removeEventListener('scroll', updateMobileMenuMoreState);
      }
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, [mobileMenuOpen, handlePointerDownOutside, updateMobileMenuMoreState]);

  return (
    <header className={styles.header}>
      <div className={styles.topbar}>
        <div className={styles.topbar__brand}>
          <div className={styles.burgerMenu} ref={burgerRef}>
            <IconButton
              icon="menu"
              label="Open menu"
              onClick={handleMenuButtonClick}
              className={styles.menuBtn}
            />
          </div>
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
          {sessionWords > 0 && (
            <Pill label="Session" value={`+${sessionWords.toLocaleString()}`} variant="success" />
          )}
          <span className={styles.desktopOnlyStats}>
            <Pill label="Para" value={(activeChapter?.paragraphs ?? 0).toLocaleString()} />
            <Pill label="Sent" value={(activeChapter?.sentences ?? 0).toLocaleString()} />
            <Pill label="Char" value={(activeChapter?.characters ?? 0).toLocaleString()} />
          </span>
          {state.settings.dailyWordGoal > 0 && (
            <Pill
              label="Goal"
              value={`${Math.min(100, Math.round((todayWords / state.settings.dailyWordGoal) * 100))}%`}
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
            {quickActionCommands.map(commandId => {
              const command = getCommandPresentation(commandId);
              return (
                <IconButton
                  key={commandId}
                  icon={command.icon}
                  label={command.label}
                  variant="ghost"
                  onClick={() => dispatchCommand(commandId)}
                  className={styles.mobileQuickActionBtn}
                />
              );
            })}
          </div>

        </div>
      </div>
      {mobileMenuOpen && (
        <div className={styles.mobileMenuLayer} ref={mobileMenuRootRef}>
          <div className={styles.mobileMenu}>
            <div className={styles.mobileMenuScrollable} ref={mobileMenuListRef}>
              {mobileMenuSections.map(({ section, items }) => (
                <div key={section} className={styles.mobileMenuSection}>
                  <div className={styles.mobileMenuSectionTitle}>{section}</div>
                  {items.map(commandId => {
                    const command = getCommandPresentation(commandId);
                    return (
                      <button
                        key={commandId}
                        className={styles.mobileMenuItem}
                        onClick={() => dispatchCommand(commandId)}
                      >
                        <span className="material-symbols-rounded">{command.icon}</span>
                        <span>{command.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <button
              className={`${styles.mobileMenuMoreBtn} ${!mobileMenuHasMore ? styles['mobileMenuMoreBtn--end'] : ''}`}
              onClick={handleMobileMenuMoreClick}
              disabled={!mobileMenuHasMore}
            >
              <span>{mobileMenuHasMore ? 'More' : 'End'}</span>
              <span className="material-symbols-rounded">{mobileMenuHasMore ? 'expand_more' : 'check'}</span>
            </button>
          </div>
        </div>
      )}
      <MenuBar onAction={onAction} />
      <Toolbar />
    </header>
  );
}
