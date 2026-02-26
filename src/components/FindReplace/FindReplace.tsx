import { useRef, useEffect, useState, useCallback } from 'react';
import { IconButton } from '@/components/UI';
import type { FindReplaceControls } from './useFindReplace';
import styles from './FindReplace.module.css';

interface FindReplaceProps {
  controls: FindReplaceControls;
}

export function FindReplace({ controls }: FindReplaceProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (controls.isOpen) {
      setIsClosing(false);
      // Small delay to ensure DOM is ready after animation
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    }
  }, [controls.isOpen]);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    const bar = barRef.current;
    const done = () => {
      setIsClosing(false);
      controls.close();
    };
    if (bar) {
      bar.addEventListener('animationend', done, { once: true });
      setTimeout(done, 200); // fallback
    } else {
      done();
    }
  }, [isClosing, controls]);

  if (!controls.isOpen && !isClosing) return null;

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        controls.findPrev();
      } else {
        controls.findNext();
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  const handleReplaceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      controls.replaceCurrent();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  const matchDisplay = controls.totalMatches > 0
    ? `${controls.currentIndex + 1} of ${controls.totalMatches}`
    : controls.searchTerm ? 'No matches' : '';

  return (
    <div ref={barRef} className={`${styles.findBar} ${isClosing ? styles['findBar--closing'] : ''}`} role="search" aria-label="Find and replace">
      <div className={styles.findRow}>
        <input
          ref={searchInputRef}
          className={styles.searchInput}
          type="text"
          value={controls.searchTerm}
          onChange={e => controls.setSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Find..."
          aria-label="Search text"
        />
        <span className={styles.matchCount} aria-live="polite">
          {matchDisplay}
        </span>
        <IconButton
          icon="match_case"
          label="Match case"
          variant="ghost"
          active={controls.caseSensitive}
          onClick={controls.toggleCaseSensitive}
          className={styles.toggleBtn}
        />
        <button
          className={`${styles.textToggle} ${controls.wholeWord ? styles['textToggle--active'] : ''}`}
          onClick={controls.toggleWholeWord}
          aria-label="Whole word"
          aria-pressed={controls.wholeWord}
          title="Whole word"
        >
          W
        </button>
        <IconButton
          icon="expand_less"
          label="Previous match (Shift+Enter)"
          variant="ghost"
          onClick={controls.findPrev}
          disabled={controls.totalMatches === 0}
          className={styles.navBtn}
        />
        <IconButton
          icon="expand_more"
          label="Next match (Enter)"
          variant="ghost"
          onClick={controls.findNext}
          disabled={controls.totalMatches === 0}
          className={styles.navBtn}
        />
        <IconButton
          icon="close"
          label="Close (Escape)"
          variant="ghost"
          onClick={handleClose}
          className={styles.navBtn}
        />
      </div>
      {controls.showReplace && (
        <div className={styles.replaceRow}>
          <input
            className={styles.searchInput}
            type="text"
            value={controls.replaceTerm}
            onChange={e => controls.setReplaceTerm(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            placeholder="Replace with..."
            aria-label="Replace text"
          />
          <IconButton
            icon="find_replace"
            label="Replace"
            variant="ghost"
            onClick={controls.replaceCurrent}
            disabled={controls.totalMatches === 0}
            className={styles.navBtn}
          />
          <button
            className={styles.replaceAllBtn}
            onClick={controls.replaceAll}
            disabled={controls.totalMatches === 0}
            title="Replace all"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}
