import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { buildChapterSearchIndex, findChapterContentMatches } from '@/lib/search';
import styles from './SidebarSearch.module.css';

const DEBOUNCE_MS = 200;

export function SidebarSearch() {
  const { state, setActiveChapter } = useApp();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query]);

  const searchIndex = useMemo(
    () => buildChapterSearchIndex(state.chapters),
    [state.chapters]
  );

  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return findChapterContentMatches(searchIndex, debouncedQuery, 20);
  }, [searchIndex, debouncedQuery]);

  const handleSelect = useCallback((chapterId: string) => {
    setActiveChapter(chapterId);
    setQuery('');
    setExpanded(false);
  }, [setActiveChapter]);

  const handleToggle = useCallback(() => {
    setExpanded(prev => {
      if (!prev) {
        setTimeout(() => inputRef.current?.focus(), 60);
      }
      return !prev;
    });
    setQuery('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setQuery('');
      setExpanded(false);
    }
  }, []);

  return (
    <div className={styles.searchContainer}>
      <button
        type="button"
        className={`${styles.searchToggle} ${expanded ? styles['searchToggle--active'] : ''}`}
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-label="Search all chapters"
      >
        <span className="material-symbols-rounded">search</span>
        <span className={styles.searchToggleLabel}>Search</span>
      </button>
      {expanded && (
        <div className={styles.searchPanel}>
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search all chapters..."
            autoComplete="off"
            spellCheck={false}
          />
          {debouncedQuery.trim() && (
            <div className={styles.searchResults} role="listbox">
              {results.length === 0 ? (
                <div className={styles.searchEmpty}>No matches found</div>
              ) : (
                <>
                  <div className={styles.searchCount}>{results.length} match{results.length !== 1 ? 'es' : ''}</div>
                  {results.map((result, idx) => (
                    <button
                      key={`${result.chapterId}-${result.match.start}-${idx}`}
                      type="button"
                      className={styles.searchResult}
                      onClick={() => handleSelect(result.chapterId)}
                      role="option"
                      aria-selected={false}
                    >
                      <span className={styles.searchResultTitle}>{result.chapterTitle}</span>
                      <span className={styles.searchResultSnippet}>{result.snippet}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
