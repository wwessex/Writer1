import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useCurrentEditor } from '@/lib/editor';
import { useApp } from '@/context/AppContext';
import { Input, IconButton, useToast } from '@/components/UI';
import { countWords, editorToPlainText } from '@/lib/utils';
import { WritingProgress } from './WritingProgress';
import type { ScreenplayBlockType } from '@/types';
import styles from './Editor.module.css';

const FONT_MAP: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: '"Courier New", Courier, monospace',
  'courier-prime': '"Courier Prime", "Courier New", Courier, monospace',
  merriweather: 'Merriweather, Georgia, serif',
  lora: 'Lora, Georgia, serif',
};

const SCREENPLAY_CONTROLS: { label: string; type: ScreenplayBlockType }[] = [
  { label: 'Scene Heading', type: 'scene-heading' },
  { label: 'Action', type: 'action' },
  { label: 'Character', type: 'character' },
  { label: 'Parenthetical', type: 'parenthetical' },
  { label: 'Dialogue', type: 'dialogue' },
  { label: 'Transition', type: 'transition' },
];

interface EditorProps {
  screenplayMode: boolean;
  onToggleScreenplayMode: () => void;
}

export function Editor({ screenplayMode, onToggleScreenplayMode }: EditorProps) {
  const { state, activeChapter, updateChapterImmediate, deleteChapter, dispatch } = useApp();
  const { editor } = useCurrentEditor();
  const { showToast } = useToast();

  // Chapter crossfade: brief animation when switching chapters
  const [isTransitioning, setIsTransitioning] = useState(false);
  const prevChapterIdRef = useRef(activeChapter?.id);

  // Sync editor content when switching chapters
  useEffect(() => {
    if (!editor || !activeChapter) return;
    if (prevChapterIdRef.current && prevChapterIdRef.current !== activeChapter.id) {
      setIsTransitioning(true);
      requestAnimationFrame(() => {
        setTimeout(() => setIsTransitioning(false), 150);
      });
    }
    prevChapterIdRef.current = activeChapter.id;
    editor.setContent(activeChapter.content || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, activeChapter?.id]);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeChapter) {
      updateChapterImmediate(activeChapter.id, { title: e.target.value });
    }
  }, [activeChapter, updateChapterImmediate]);

  const handleDelete = useCallback(() => {
    if (activeChapter && confirm('Delete this chapter? This cannot be undone.')) {
      deleteChapter(activeChapter.id);
    }
  }, [activeChapter, deleteChapter]);

  const exitFocusMode = useCallback(() => {
    if (state.settings.focusMode) {
      dispatch({ type: 'TOGGLE_FOCUS_MODE' });
    }
  }, [state.settings.focusMode, dispatch]);

  const typographyStyles = useMemo(() => {
    const typo = state.settings.typography;
    return {
      '--editor-font-family': screenplayMode ? FONT_MAP.mono : FONT_MAP[typo.fontFamily] || FONT_MAP.system,
      '--editor-font-size': `${typo.fontSize}px`,
      '--editor-line-height': screenplayMode ? '1.5' : String(typo.lineHeight),
    } as React.CSSProperties;
  }, [screenplayMode, state.settings.typography]);

  const handleSetScreenplayBlock = useCallback((blockType: ScreenplayBlockType) => {
    editor?.focus();
    editor?.setScreenplayBlockType(blockType);
  }, [editor]);

  // Focus-mode session tracking
  const focusStartWordsRef = useRef<number | null>(null);
  const [focusSessionWords, setFocusSessionWords] = useState(0);
  const [focusElapsed, setFocusElapsed] = useState(0);
  const focusTimerRef = useRef<number | null>(null);

  const chapterWordCount = useMemo(() => {
    if (!activeChapter?.content) return 0;
    return countWords(editorToPlainText(activeChapter.content));
  }, [activeChapter?.content]);

  useEffect(() => {
    if (state.settings.focusMode) {
      focusStartWordsRef.current = chapterWordCount;
      setFocusSessionWords(0);
      setFocusElapsed(0);
      focusTimerRef.current = window.setInterval(() => {
        setFocusElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (focusTimerRef.current) {
        window.clearInterval(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      focusStartWordsRef.current = null;
    }
    return () => {
      if (focusTimerRef.current) window.clearInterval(focusTimerRef.current);
    };
  }, [state.settings.focusMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focusStartWordsRef.current !== null) {
      setFocusSessionWords(Math.max(0, chapterWordCount - focusStartWordsRef.current));
    }
  }, [chapterWordCount]);

  if (!activeChapter) {
    return (
      <div className={styles.editorPane}>
        <div className={styles.editorEmpty}>
          <span className="material-symbols-rounded">edit_note</span>
          <p>Select a chapter to start writing</p>
        </div>
      </div>
    );
  }

  const isFocusMode = state.settings.focusMode;
  const editorClass = [
    styles.editorPane,
    state.settings.pageView ? styles['editorPane--pageView'] : '',
    isFocusMode ? styles['editorPane--focusMode'] : '',
    screenplayMode ? styles['editorPane--screenplay'] : '',
    state.settings.typewriterMode ? styles['editorPane--typewriter'] : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={editorClass} style={typographyStyles}>
      {!isFocusMode && (
        <div className={styles.editorHeader}>
          <Input
            variant="title"
            value={activeChapter.title}
            onChange={handleTitleChange}
            placeholder="Chapter Title"
            className={styles.chapterTitle}
            aria-label="Chapter title"
          />
          <div className={styles.editorHeaderActions}>
            {state.projectType === 'screenplay' && (
              <button
                type="button"
                onClick={onToggleScreenplayMode}
                className={`${styles.modeToggle} ${screenplayMode ? styles['modeToggle--active'] : ''}`}
                aria-pressed={screenplayMode}
              >
                Screenplay Mode
              </button>
            )}
            <IconButton
              icon="delete"
              label="Delete chapter"
              variant="ghost"
              onClick={handleDelete}
            />
          </div>
        </div>
      )}
      {screenplayMode && (
        <div className={styles.screenplayToolbar}>
          {SCREENPLAY_CONTROLS.map(control => (
            <button
              key={control.type}
              type="button"
              className={styles.screenplayButton}
              onClick={() => handleSetScreenplayBlock(control.type)}
            >
              {control.label}
            </button>
          ))}
        </div>
      )}
      <div className={`${styles.editorContent} ${isTransitioning ? styles['editorContent--transitioning'] : ''}`}>
        {/* CodeMirror is mounted in App.tsx; the editor DOM is moved here */}
        {editor?.dom && (
          <div className={styles.editorWrapper} ref={(el) => {
            if (el && editor.dom && !el.contains(editor.dom)) {
              el.appendChild(editor.dom);
            }
          }} />
        )}
      </div>
      {!isFocusMode && <WritingProgress showToast={showToast} />}
      {isFocusMode && (
        <div className={styles.focusModeBar}>
          <div className={styles.focusModeStats} role="status" aria-live="off">
            <span>{chapterWordCount.toLocaleString()} words</span>
            <span className={styles.focusModeDivider} />
            {focusSessionWords > 0 && (
              <>
                <span className={styles.focusModeHighlight}>+{focusSessionWords.toLocaleString()}</span>
                <span className={styles.focusModeDivider} />
              </>
            )}
            <span>{Math.floor(focusElapsed / 60)}:{String(focusElapsed % 60).padStart(2, '0')}</span>
          </div>
          <button className={styles.focusModeExit} onClick={exitFocusMode} aria-label="Exit focus mode">
            <span className="material-symbols-rounded">fullscreen_exit</span>
            <span>Exit Focus Mode</span>
          </button>
        </div>
      )}
    </div>
  );
}
