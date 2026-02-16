import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { useApp } from '@/context/AppContext';
import { countWords, editorToPlainText } from '@/lib/utils';
import { COMMAND_IDS, type CommandId } from '@/lib/commands';
import { buildChapterSearchIndex, findChapterContentMatches, normalizeSearchText } from '@/lib/search';
import styles from './QuickSwitcher.module.css';

interface QuickSwitcherProps {
  open: boolean;
  onClose: () => void;
  onAction?: (action: CommandId) => void;
}

type ItemType = 'chapter' | 'action' | 'search-result';
type SearchMode = ItemType;

interface SwitcherItem {
  id: string;
  type: ItemType;
  title: string;
  subtitle?: string;
  shortcut?: string;
  lastOpenedAt?: number;
  icon: string;
  snippet?: string;
  action: () => void;
}

const RECENT_ITEMS_STORAGE_KEY = 'writer1.quickSwitcher.recent';
const SEARCH_DEBOUNCE_MS = 140;
const MAX_RESULTS = 40;

const MODE_ORDER: SearchMode[] = ['action', 'chapter', 'search-result'];

function scoreItem(item: SwitcherItem, normalizedQuery: string): number {
  if (!normalizedQuery) return 0;

  const title = normalizeSearchText(item.title);
  const subtitle = normalizeSearchText(item.subtitle ?? '');
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

function highlightMatch(text: string, query: string): ReactNode {
  if (!query.trim() || !text) return text;
  const normalizedQuery = normalizeSearchText(query);
  const normalizedText = normalizeSearchText(text);
  const idx = normalizedText.indexOf(normalizedQuery);
  if (idx === -1) return text;

  const end = idx + normalizedQuery.length;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={styles.match}>{text.slice(idx, end)}</mark>
      {text.slice(end)}
    </>
  );
}

export function QuickSwitcher({ open, onClose, onAction }: QuickSwitcherProps) {
  const { state, setActiveChapter, updateSettings } = useApp();
  const [rawQuery, setRawQuery] = useState('');
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

  const searchMode = state.settings.quickSwitcherMode;
  const isScreenplay = state.projectType === 'screenplay';
  const chapterLabel = isScreenplay ? 'Scene' : 'Chapter';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_ITEMS_STORAGE_KEY, JSON.stringify(recentOpenedMap));
  }, [recentOpenedMap]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setQuery(rawQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [rawQuery]);

  const chapterItems = useMemo((): SwitcherItem[] => {
    return state.chapters.map((ch, idx) => {
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
  }, [state.chapters, chapterLabel, isScreenplay, recentOpenedMap, setActiveChapter, onClose]);

  const actionItems = useMemo((): SwitcherItem[] => {
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

    return [
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
  }, [onAction, onClose, recentOpenedMap]);

  const searchResultItems = useMemo((): SwitcherItem[] => {
    const index = buildChapterSearchIndex(state.chapters);
    const matches = findChapterContentMatches(index, query, MAX_RESULTS);

    return matches.map((match, idx) => ({
      id: `search:${match.chapterId}:${match.match.start}:${idx}`,
      type: 'search-result',
      title: match.chapterTitle,
      subtitle: `Match in ${chapterLabel.toLowerCase()} content`,
      snippet: match.snippet,
      icon: 'find_in_page',
      lastOpenedAt: recentOpenedMap[`search-result:${match.chapterId}:${match.match.start}`],
      action: () => {
        setActiveChapter(match.chapterId);
        onClose();
      },
    }));
  }, [state.chapters, query, chapterLabel, recentOpenedMap, setActiveChapter, onClose]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    const allItems = {
      chapter: chapterItems,
      action: actionItems,
      'search-result': searchResultItems,
    };

    const typeFilteredItems = allItems[searchMode];

    if (!normalizedQuery) {
      return [...typeFilteredItems]
        .sort((a, b) => {
          const recentDiff = (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0);
          if (recentDiff !== 0) return recentDiff;
          return a.title.localeCompare(b.title);
        })
        .slice(0, MAX_RESULTS);
    }

    if (searchMode === 'search-result') {
      return typeFilteredItems.slice(0, MAX_RESULTS);
    }

    return typeFilteredItems
      .map(item => ({ item, score: scoreItem(item, normalizedQuery) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.item.lastOpenedAt ?? 0) - (a.item.lastOpenedAt ?? 0);
      })
      .map(({ item }) => item)
      .slice(0, MAX_RESULTS);
  }, [actionItems, chapterItems, query, searchMode, searchResultItems]);

  const runItemAction = useCallback((item: SwitcherItem) => {
    const recentId = item.type === 'search-result' ? `search-result:${item.id}` : `${item.type}:${item.id}`;
    setRecentOpenedMap(prev => ({
      ...prev,
      [recentId]: Date.now(),
    }));
    item.action();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, searchMode]);

  useEffect(() => {
    if (open) {
      setRawQuery('');
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

  const cycleSearchMode = useCallback(() => {
    const currentIdx = MODE_ORDER.indexOf(searchMode);
    const nextMode = MODE_ORDER[(currentIdx + 1) % MODE_ORDER.length];
    updateSettings({ quickSwitcherMode: nextMode });
  }, [searchMode, updateSettings]);

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
      case 'Tab':
        e.preventDefault();
        cycleSearchMode();
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredItems, selectedIndex, onClose, runItemAction, cycleSearchMode]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.switcher} onClick={e => e.stopPropagation()} role="dialog" aria-label="Quick Switcher">
        <div className={styles.inputWrapper}>
          <span className="material-symbols-rounded">search</span>
          <input
            ref={inputRef}
            className={styles.input}
            value={rawQuery}
            onChange={e => setRawQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Quick switch (${chapterLabel.toLowerCase()}, actions, content)`}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={styles.kbd}>Tab: {searchMode === 'action' ? 'Commands' : searchMode === 'chapter' ? chapterLabel + 's' : 'Content'}</kbd>
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
                  <span className={styles.itemTitle}>{highlightMatch(item.title, query)}</span>
                  {item.snippet ? (
                    <span className={styles.itemSnippet}>{highlightMatch(item.snippet, query)}</span>
                  ) : item.subtitle ? (
                    <span className={styles.itemSubtitle}>{item.subtitle}</span>
                  ) : null}
                </div>
                <div className={styles.itemMeta}>
                  {item.lastOpenedAt && <span className={styles.itemRecent}>Recent</span>}
                  {item.shortcut && <kbd className={styles.itemShortcut}>{item.shortcut}</kbd>}
                  <span className={styles.itemType}>{item.type === 'chapter' ? chapterLabel : item.type === 'search-result' ? 'Content' : 'Action'}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
