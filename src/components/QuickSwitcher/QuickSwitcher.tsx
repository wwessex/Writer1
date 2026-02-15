import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { countWords, editorToPlainText } from '@/lib/utils';
import styles from './QuickSwitcher.module.css';

interface QuickSwitcherProps {
  open: boolean;
  onClose: () => void;
  onAction?: (action: string) => void;
}

interface SwitcherItem {
  id: string;
  type: 'chapter' | 'action';
  title: string;
  subtitle?: string;
  icon: string;
  action: () => void;
}

export function QuickSwitcher({ open, onClose, onAction }: QuickSwitcherProps) {
  const { state, setActiveChapter, dispatch } = useApp();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isScreenplay = state.projectType === 'screenplay';
  const chapterLabel = isScreenplay ? 'Scene' : 'Chapter';

  // Build the list of items
  const items = useMemo((): SwitcherItem[] => {
    const chapterItems: SwitcherItem[] = state.chapters.map((ch, idx) => {
      const words = countWords(editorToPlainText(ch.content));
      return {
        id: ch.id,
        type: 'chapter',
        title: ch.title || `${chapterLabel} ${idx + 1}`,
        subtitle: `${words} words`,
        icon: isScreenplay ? 'movie' : 'description',
        action: () => {
          setActiveChapter(ch.id);
          if (state.settings.sidebarHidden) {
            // Don't toggle sidebar
          }
          onClose();
        },
      };
    });

    const actionItems: SwitcherItem[] = [
      { id: 'act-focus', type: 'action', title: 'Toggle Focus Mode', icon: 'center_focus_strong', action: () => { dispatch({ type: 'TOGGLE_FOCUS_MODE' }); onClose(); } },
      { id: 'act-sidebar', type: 'action', title: 'Toggle Sidebar', icon: 'side_navigation', action: () => { dispatch({ type: 'TOGGLE_SIDEBAR' }); onClose(); } },
      { id: 'act-export', type: 'action', title: 'Export...', icon: 'download', action: () => { onAction?.('export'); onClose(); } },
      { id: 'act-settings', type: 'action', title: 'Settings', icon: 'settings', action: () => { onAction?.('settings'); onClose(); } },
      { id: 'act-dashboard', type: 'action', title: 'Dashboard', icon: 'dashboard', action: () => { onAction?.('dashboard'); onClose(); } },
      { id: 'act-analysis', type: 'action', title: 'Writing Analysis', icon: 'analytics', action: () => { onAction?.('analysis'); onClose(); } },
      { id: 'act-snapshots', type: 'action', title: 'Snapshots', icon: 'history', action: () => { onAction?.('snapshots'); onClose(); } },
      { id: 'act-characters', type: 'action', title: 'Character & World Bible', icon: 'person', action: () => { onAction?.('characterBible'); onClose(); } },
      { id: 'act-dark', type: 'action', title: 'True Dark', icon: 'dark_mode', action: () => { dispatch({ type: 'SET_THEME', payload: 'dark' }); onClose(); } },
      { id: 'act-light', type: 'action', title: 'Warm Light', icon: 'light_mode', action: () => { dispatch({ type: 'SET_THEME', payload: 'light' }); onClose(); } },
    ];

    return [...chapterItems, ...actionItems];
  }, [state.chapters, state.projectType, state.settings.sidebarHidden, chapterLabel, isScreenplay, setActiveChapter, dispatch, onAction, onClose]);

  // Filter items by query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.subtitle?.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll selected item into view
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
          filteredItems[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredItems, selectedIndex, onClose]);

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
            placeholder={`Jump to ${chapterLabel.toLowerCase()}, action...`}
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
                className={`${styles.item} ${idx === selectedIndex ? styles['item--selected'] : ''}`}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className={`material-symbols-rounded ${styles.itemIcon}`}>{item.icon}</span>
                <div className={styles.itemContent}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  {item.subtitle && <span className={styles.itemSubtitle}>{item.subtitle}</span>}
                </div>
                <span className={styles.itemType}>{item.type === 'chapter' ? chapterLabel : 'Action'}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
