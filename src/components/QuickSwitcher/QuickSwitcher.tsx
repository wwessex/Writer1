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
  icon: string;
  action: () => void;
}

export function QuickSwitcher({ open, onClose, onAction }: QuickSwitcherProps) {
  const { state, setActiveChapter } = useApp();
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
          onClose();
        },
      };
    });

    const actionItem = (id: string, title: string, icon: string, command: CommandId): SwitcherItem => ({
      id,
      type: 'action',
      title,
      icon,
      action: () => {
        onAction?.(command);
        onClose();
      },
    });

    const actionItems: SwitcherItem[] = [
      actionItem('act-focus', 'Toggle Focus Mode', 'center_focus_strong', COMMAND_IDS.TOGGLE_FOCUS_MODE),
      actionItem('act-sidebar', 'Toggle Sidebar', 'side_navigation', COMMAND_IDS.TOGGLE_SIDEBAR),
      actionItem('act-export', 'Export...', 'download', COMMAND_IDS.EXPORT),
      actionItem('act-settings', 'Settings', 'settings', COMMAND_IDS.SETTINGS),
      actionItem('act-dashboard', 'Dashboard', 'dashboard', COMMAND_IDS.DASHBOARD),
      actionItem('act-analysis', 'Writing Analysis', 'analytics', COMMAND_IDS.ANALYSIS),
      actionItem('act-snapshots', 'Snapshots', 'history', COMMAND_IDS.SNAPSHOTS),
      actionItem('act-characters', 'Character & World Bible', 'person', COMMAND_IDS.CHARACTER_BIBLE),
      actionItem('act-dark', 'True Dark', 'dark_mode', COMMAND_IDS.THEME_DARK),
      actionItem('act-light', 'Warm Light', 'light_mode', COMMAND_IDS.THEME_LIGHT),
    ];

    return [...chapterItems, ...actionItems];
  }, [state.chapters, chapterLabel, isScreenplay, setActiveChapter, onAction, onClose]);

  // Filter items by query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.subtitle?.toLowerCase().includes(q)
    );
  }, [items, query]);

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
