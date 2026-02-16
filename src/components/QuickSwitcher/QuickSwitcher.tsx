import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { countWords, editorToPlainText } from '@/lib/utils';
import { COMMAND_IDS, type CommandId } from '@/lib/commands';
import styles from './QuickSwitcher.module.css';

interface QuickSwitcherProps {
  open: boolean;
  onClose: () => void;
  onAction?: (action: CommandId) => void;
}

interface SwitcherItem {
  id: string;
  type: 'chapter' | 'action';
  title: string;
  subtitle?: string;
  shortcut?: string;
  lastOpenedAt?: number;
  icon: string;
  action: () => void;
}

type TypeFilter = 'all' | 'chapter' | 'action';

const RECENT_ITEMS_STORAGE_KEY = 'writer1.quickSwitcher.recent';

function parseQuery(rawQuery: string): { text: string; typeFilter: TypeFilter } {
  const parts = rawQuery.trim().split(/\s+/).filter(Boolean);
  const tokens = new Set(parts.filter(part => part.startsWith('@')).map(token => token.toLowerCase()));
  const text = parts.filter(part => !part.startsWith('@')).join(' ').toLowerCase();

  if (tokens.has('@chapter') && !tokens.has('@action')) {
    return { text, typeFilter: 'chapter' };
  }

  if (tokens.has('@action') && !tokens.has('@chapter')) {
    return { text, typeFilter: 'action' };
  }

  return { text, typeFilter: 'all' };
}

function scoreItem(item: SwitcherItem, normalizedQuery: string): number {
  if (!normalizedQuery) return 0;

  const title = item.title.toLowerCase();
  const subtitle = item.subtitle?.toLowerCase() ?? '';
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

  let score = 0;

  if (title === normalizedQuery) score += 120;
  if (title.startsWith(normalizedQuery)) score += 95;
  if (queryWords.length > 0 && queryWords.every(word => title.split(/\s+/).some(part => part.startsWith(word)))) {
    score += 70;
  }
  if (title.includes(normalizedQuery)) score += 36;
  if (subtitle.startsWith(normalizedQuery)) score += 24;
  if (subtitle.includes(normalizedQuery)) score += 16;

  return score;
}

export function QuickSwitcher({ open, onClose, onAction }: QuickSwitcherProps) {
  const { state, setActiveChapter } = useApp();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentOpenedMap, setRecentOpenedMap] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(RECENT_ITEMS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isScreenplay = state.projectType === 'screenplay';
  const chapterLabel = isScreenplay ? 'Scene' : 'Chapter';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_ITEMS_STORAGE_KEY, JSON.stringify(recentOpenedMap));
  }, [recentOpenedMap]);

  // Build the list of items
  const items = useMemo((): SwitcherItem[] => {
    const chapterItems: SwitcherItem[] = state.chapters.map((ch, idx) => {
      const words = countWords(editorToPlainText(ch.content));
      const itemId = `chapter:${ch.id}`;
      return {
        id: ch.id,
        type: 'chapter',
        title: ch.title || `${chapterLabel} ${idx + 1}`,
        subtitle: `${words} words`,
        lastOpenedAt: recentOpenedMap[itemId],
        icon: isScreenplay ? 'movie' : 'description',
        action: () => {
          setActiveChapter(ch.id);
          onClose();
        },
      };
    });

    const actionItem = (id: string, title: string, icon: string, command: CommandId, shortcut?: string): SwitcherItem => ({
      id,
      type: 'action',
      title,
      icon,
      shortcut,
      lastOpenedAt: recentOpenedMap[`action:${id}`],
      action: () => {
        onAction?.(command);
        onClose();
      },
    });

    const actionItems: SwitcherItem[] = [
      actionItem('act-focus', 'Toggle Focus Mode', 'center_focus_strong', COMMAND_IDS.TOGGLE_FOCUS_MODE, 'Ctrl+Shift+F'),
      actionItem('act-sidebar', 'Toggle Sidebar', 'side_navigation', COMMAND_IDS.TOGGLE_SIDEBAR, 'Ctrl+Shift+B'),
      actionItem('act-export', 'Export...', 'download', COMMAND_IDS.EXPORT, 'Ctrl+Shift+E'),
      actionItem('act-settings', 'Settings', 'settings', COMMAND_IDS.SETTINGS),
      actionItem('act-dashboard', 'Dashboard', 'dashboard', COMMAND_IDS.DASHBOARD),
      actionItem('act-analysis', 'Writing Analysis', 'analytics', COMMAND_IDS.ANALYSIS),
      actionItem('act-snapshots', 'Snapshots', 'history', COMMAND_IDS.SNAPSHOTS),
      actionItem('act-characters', 'Character & World Bible', 'person', COMMAND_IDS.CHARACTER_BIBLE),
      actionItem('act-dark', 'True Dark', 'dark_mode', COMMAND_IDS.THEME_DARK),
      actionItem('act-light', 'Warm Light', 'light_mode', COMMAND_IDS.THEME_LIGHT),
    ];

    return [...chapterItems, ...actionItems];
  }, [state.chapters, chapterLabel, isScreenplay, setActiveChapter, onAction, onClose, recentOpenedMap]);

  // Filter + score items by query
  const filteredItems = useMemo(() => {
    const parsedQuery = parseQuery(query);
    const typeFilteredItems = items.filter(item => parsedQuery.typeFilter === 'all' || item.type === parsedQuery.typeFilter);

    if (!parsedQuery.text) {
      return [...typeFilteredItems].sort((a, b) => {
        const recentDiff = (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0);
        if (recentDiff !== 0) return recentDiff;
        if (a.type !== b.type) return a.type === 'chapter' ? -1 : 1;
        return a.title.localeCompare(b.title);
      });
    }

    return typeFilteredItems
      .map(item => ({ item, score: scoreItem(item, parsedQuery.text) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.item.lastOpenedAt ?? 0) - (a.item.lastOpenedAt ?? 0);
      })
      .map(({ item }) => item);
  }, [items, query]);

  const runItemAction = useCallback((item: SwitcherItem) => {
    setRecentOpenedMap(prev => ({
      ...prev,
      [`${item.type}:${item.id}`]: Date.now(),
    }));
    item.action();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          runItemAction(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredItems, selectedIndex, onClose, runItemAction]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.switcher} onClick={e => e.stopPropagation()} role="dialog" aria-label="Quick Switcher">
        <div className={styles.inputWrapper}>
          <span className="material-symbols-rounded">search</span>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Jump to ${chapterLabel.toLowerCase()}, action... (@chapter @action)`}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>
        <div className={styles.list} ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className={styles.empty}>No results found</div>
          ) : (
            filteredItems.map((item, idx) => (
              <button
                key={item.id}
                className={`${styles.item} ${styles[`item--${item.type}`]} ${idx === selectedIndex ? styles['item--selected'] : ''}`}
                onClick={() => runItemAction(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className={`material-symbols-rounded ${styles.itemIcon}`}>{item.icon}</span>
                <div className={styles.itemContent}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  {item.subtitle && <span className={styles.itemSubtitle}>{item.subtitle}</span>}
                </div>
                <div className={styles.itemMeta}>
                  {item.lastOpenedAt && <span className={styles.itemRecent}>Recent</span>}
                  {item.shortcut && <kbd className={styles.itemShortcut}>{item.shortcut}</kbd>}
                  <span className={styles.itemType}>{item.type === 'chapter' ? chapterLabel : 'Action'}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
