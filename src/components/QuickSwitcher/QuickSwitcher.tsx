import { useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { useApp } from '@/context/AppContext';
import {
  COMMAND_METADATA,
  type CommandGroup,
  type CommandId,
} from '@/lib/commands';
import { getProjectMetrics } from '@/lib/projectMetrics';
import { buildChapterSearchIndex, findChapterContentMatches, normalizeSearchText } from '@/lib/search';
import styles from './QuickSwitcher.module.css';

interface QuickSwitcherProps {
  open: boolean;
  onClose: () => void;
  onAction?: (action: CommandId) => void;
}

type ItemType = 'chapter' | 'action' | 'search-result';
type SearchMode = ItemType | 'all';

const ACTION_FILTERS = ['All', 'Actions', 'Navigation', 'Views', 'AI', 'Project'] as const;
type ActionFilter = typeof ACTION_FILTERS[number];

interface SwitcherItem {
  id: string;
  type: ItemType;
  recentKey: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  lastOpenedAt?: number;
  icon: string;
  snippet?: string;
  group?: CommandGroup;
  action: () => void;
}

const RECENT_ITEMS_STORAGE_KEY = 'writer1.quickSwitcher.recent';
const SEARCH_DEBOUNCE_MS = 140;
const MAX_RESULTS = 40;

const MAX_RESULTS_PER_GROUP = 5;

const MODE_ORDER: SearchMode[] = ['all', 'action', 'chapter', 'search-result'];

const MODE_LABELS: Record<SearchMode, string> = {
  all: 'All',
  action: 'Actions',
  chapter: 'Chapters',
  'search-result': 'Content',
};

/** Check if query characters appear in order within text (fuzzy/acronym match). */
function fuzzyMatch(text: string, query: string): boolean {
  let qi = 0;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) qi++;
  }
  return qi === query.length;
}

/** Score a fuzzy match by how tightly the characters cluster. Lower spread = higher score. */
function fuzzyScore(text: string, query: string): number {
  let qi = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) {
      if (firstMatch === -1) firstMatch = ti;
      lastMatch = ti;
      qi++;
    }
  }
  if (qi < query.length) return 0;
  const spread = lastMatch - firstMatch + 1;
  // Tighter clustering yields a higher score, capped at 10
  return Math.max(1, Math.round(10 * (query.length / spread)));
}

function scoreItem(item: SwitcherItem, normalizedQuery: string): number {
  if (!normalizedQuery) return 0;

  const title = normalizeSearchText(item.title);
  const subtitle = normalizeSearchText(item.subtitle ?? '');
  const group = normalizeSearchText(item.group ?? '');
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
  if (group.includes(normalizedQuery)) score += 14;

  // Fuzzy matching: if no exact/substring match was found, try ordered-character matching
  if (score === 0 && normalizedQuery.length >= 2) {
    if (fuzzyMatch(title, normalizedQuery)) {
      score += fuzzyScore(title, normalizedQuery);
    } else if (fuzzyMatch(subtitle, normalizedQuery)) {
      score += Math.max(1, fuzzyScore(subtitle, normalizedQuery) - 2);
    }
  }

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
  const [actionFilter, setActionFilter] = useState<ActionFilter>('All');
  const [isClosing, setIsClosing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
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

  const projectMetrics = useMemo(() => getProjectMetrics(state.chapters), [state.chapters]);

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
    return projectMetrics.chapters.map((ch, idx) => {
      const itemId = `chapter:${ch.id}`;
      return {
        id: ch.id,
        type: 'chapter',
        recentKey: `chapter:${ch.id}`,
        title: ch.title || `${chapterLabel} ${idx + 1}`,
        subtitle: `${ch.words} words`,
        lastOpenedAt: recentOpenedMap[itemId],
        icon: isScreenplay ? 'movie' : 'description',
        action: () => {
          setActiveChapter(ch.id);
          onClose();
        },
      };
    });
  }, [projectMetrics.chapters, chapterLabel, isScreenplay, recentOpenedMap, setActiveChapter, onClose]);

  const actionItems = useMemo((): SwitcherItem[] => {
    return Object.values(COMMAND_METADATA)
      .filter(metadata => metadata.includeInQuickSwitcher)
      .filter(metadata => !metadata.projectTypes || metadata.projectTypes.includes(state.projectType))
      .filter(metadata => actionFilter === 'All' || metadata.group === actionFilter)
      .map(metadata => ({
        id: metadata.id,
        type: 'action' as const,
        recentKey: `action:${metadata.id}`,
        title: metadata.id === 'newChapter' ? (isScreenplay ? 'New Scene' : metadata.label) : metadata.label,
        subtitle: metadata.group,
        icon: metadata.icon,
        shortcut: metadata.shortcut,
        group: metadata.group,
        lastOpenedAt: recentOpenedMap[`action:${metadata.id}`],
        action: () => {
          onAction?.(metadata.id);
          onClose();
        },
      }));
  }, [actionFilter, isScreenplay, onAction, onClose, recentOpenedMap, state.projectType]);

  const searchResultItems = useMemo((): SwitcherItem[] => {
    const index = buildChapterSearchIndex(state.chapters);
    const matches = findChapterContentMatches(index, query, MAX_RESULTS);

    return matches.map((match, idx) => ({
      id: `search:${match.chapterId}:${match.match.start}:${idx}`,
      type: 'search-result',
      recentKey: `search-result:${match.chapterId}:${match.match.start}`,
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

  /** Rank and filter a single type's items by query. */
  const rankItems = useCallback((items: SwitcherItem[], normalizedQuery: string, mode: ItemType, limit: number): SwitcherItem[] => {
    if (!normalizedQuery) {
      return [...items]
        .sort((a, b) => {
          const recentDiff = (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0);
          if (recentDiff !== 0) return recentDiff;
          return a.title.localeCompare(b.title);
        })
        .slice(0, limit);
    }

    if (mode === 'search-result') {
      return items.slice(0, limit);
    }

    return items
      .map(item => ({ item, score: scoreItem(item, normalizedQuery) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.item.lastOpenedAt ?? 0) - (a.item.lastOpenedAt ?? 0);
      })
      .map(({ item }) => item)
      .slice(0, limit);
  }, []);

  /** Section headers inserted into the flat list for 'all' mode. */
  interface SectionHeader {
    kind: 'header';
    label: string;
    key: string;
  }

  type ListEntry = SwitcherItem | SectionHeader;

  const isSectionHeader = (entry: ListEntry): entry is SectionHeader =>
    'kind' in entry && entry.kind === 'header';

  const { flatEntries, selectableItems } = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    const allItemsByType: Record<ItemType, SwitcherItem[]> = {
      action: actionItems,
      chapter: chapterItems,
      'search-result': searchResultItems,
    };

    if (searchMode === 'all') {
      const groups: { type: ItemType; label: string }[] = [
        { type: 'action', label: 'Actions' },
        { type: 'chapter', label: 'Chapters' },
        { type: 'search-result', label: 'Content' },
      ];

      const entries: ListEntry[] = [];
      const selectable: SwitcherItem[] = [];

      for (const { type, label } of groups) {
        const ranked = rankItems(allItemsByType[type], normalizedQuery, type, MAX_RESULTS_PER_GROUP);
        if (ranked.length > 0) {
          entries.push({ kind: 'header', label, key: `header:${type}` });
          for (const item of ranked) {
            entries.push(item);
            selectable.push(item);
          }
        }
      }

      return { flatEntries: entries, selectableItems: selectable };
    }

    const ranked = rankItems(allItemsByType[searchMode], normalizedQuery, searchMode, MAX_RESULTS);
    return { flatEntries: ranked as ListEntry[], selectableItems: ranked };
  }, [actionItems, chapterItems, query, rankItems, searchMode, searchResultItems]);

  const runItemAction = useCallback((item: SwitcherItem) => {
    setRecentOpenedMap(prev => ({
      ...prev,
      [item.recentKey]: Date.now(),
    }));
    item.action();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, searchMode, actionFilter]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    const overlay = overlayRef.current;
    const done = () => {
      setIsClosing(false);
      onClose();
    };
    if (overlay) {
      overlay.addEventListener('animationend', done, { once: true });
      setTimeout(done, 200); // fallback
    } else {
      done();
    }
  }, [isClosing, onClose]);

  useEffect(() => {
    if (open) {
      setIsClosing(false);
      setRawQuery('');
      setQuery('');
      setSelectedIndex(0);
      setActionFilter('All');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!listRef.current) return;
    // In 'all' mode, the DOM list contains section headers interspersed with items.
    // Map from selectable index to the DOM child index by finding the matching data-selectable-index.
    const el = listRef.current.querySelector(`[data-selectable-index="${selectedIndex}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const cycleSearchMode = useCallback(() => {
    const currentIdx = MODE_ORDER.indexOf(searchMode);
    const nextMode = MODE_ORDER[(currentIdx + 1) % MODE_ORDER.length];
    updateSettings({ quickSwitcherMode: nextMode });
  }, [searchMode, updateSettings]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey && !e.shiftKey && !e.altKey) {
      const modeMap: Record<string, SearchMode> = { '1': 'all', '2': 'action', '3': 'chapter', '4': 'search-result' };
      const modeFromShortcut = modeMap[e.key] ?? null;
      if (modeFromShortcut) {
        e.preventDefault();
        updateSettings({ quickSwitcherMode: modeFromShortcut });
        return;
      }
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, selectableItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectableItems[selectedIndex]) {
          runItemAction(selectableItems[selectedIndex]);
        }
        break;
      case 'Tab':
        e.preventDefault();
        cycleSearchMode();
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        break;
    }
  }, [selectableItems, selectedIndex, handleClose, runItemAction, cycleSearchMode, updateSettings]);

  if (!open && !isClosing) return null;

  // Build a mapping from selectable index to the item, for mouse hover in the list
  let selectableCounter = 0;

  return (
    <div ref={overlayRef} className={`${styles.overlay} ${isClosing ? styles['overlay--closing'] : ''}`} onClick={handleClose}>
      <div className={`${styles.switcher} ${isClosing ? styles['switcher--closing'] : ''}`} onClick={e => e.stopPropagation()} role="dialog" aria-label="Command Palette">
        <div className={styles.inputWrapper}>
          <span className="material-symbols-rounded">search</span>
          <input
            ref={inputRef}
            className={styles.input}
            value={rawQuery}
            onChange={e => setRawQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Search commands, ${chapterLabel.toLowerCase()}s, content...`}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={styles.kbd}>Esc</kbd>
        </div>
        <div className={styles.modeBar} role="tablist" aria-label="Search mode">
            {MODE_ORDER.map((mode, idx) => (
              <button
                key={mode}
                className={`${styles.modeChip} ${searchMode === mode ? styles['modeChip--active'] : ''}`}
                type="button"
                role="tab"
                aria-selected={searchMode === mode}
                onClick={() => updateSettings({ quickSwitcherMode: mode })}
              >
                {MODE_LABELS[mode]} <kbd className={styles.modeShortcut}>Ctrl+{idx + 1}</kbd>
              </button>
            ))}
        </div>
        {searchMode === 'action' && (
          <div className={styles.filterBar}>
            {ACTION_FILTERS.map(filter => (
              <button
                key={filter}
                className={`${styles.filterChip} ${actionFilter === filter ? styles['filterChip--active'] : ''}`}
                onClick={() => setActionFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
        )}
        <div className={styles.list} ref={listRef}>
          {selectableItems.length === 0 ? (
            <div className={styles.empty}>No results found</div>
          ) : (
            (() => {
              selectableCounter = 0;
              return flatEntries.map((entry) => {
                if (isSectionHeader(entry)) {
                  return (
                    <div key={entry.key} className={styles.sectionHeader}>
                      {entry.label}
                    </div>
                  );
                }
                const item = entry;
                const thisIndex = selectableCounter++;
                return (
                  <button
                    key={item.id}
                    data-selectable-index={thisIndex}
                    className={`${styles.item} ${styles[`item--${item.type}`]} ${thisIndex === selectedIndex ? styles['item--selected'] : ''}`}
                    onClick={() => runItemAction(item)}
                    onMouseEnter={() => setSelectedIndex(thisIndex)}
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
                      <span className={styles.itemType}>{item.type === 'chapter' ? chapterLabel : item.type === 'search-result' ? 'Content' : item.group ?? 'Action'}</span>
                    </div>
                  </button>
                );
              });
            })()
          )}
        </div>
        <div className={styles.footer}>
          <span className={styles.footerHint}><kbd className={styles.footerKbd}>↑↓</kbd> Navigate</span>
          <span className={styles.footerHint}><kbd className={styles.footerKbd}>Enter</kbd> Select</span>
          <span className={styles.footerHint}><kbd className={styles.footerKbd}>Tab</kbd> Switch Mode</span>
          <span className={styles.footerHint}><kbd className={styles.footerKbd}>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
