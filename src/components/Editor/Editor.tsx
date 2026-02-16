import { useEffect, useCallback, useMemo } from 'react';
import { useCurrentEditor, EditorContent } from '@tiptap/react';
import { useApp } from '@/context/AppContext';
import { Input, IconButton } from '@/components/UI';
import type { ScreenplayBlockType } from './screenplayExtension';
import styles from './Editor.module.css';

const FONT_MAP: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: '"Courier New", Courier, monospace',
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

  // Sync editor content when switching chapters. We intentionally depend on
  // activeChapter.id rather than the full object to avoid re-setting content
  // on every keystroke (which would create an update loop).
  useEffect(() => {
    if (!editor || !activeChapter) return;
    editor.commands.setContent(activeChapter.content || '');
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
    editor?.chain().focus().setScreenplayBlock(blockType).run();
  }, [editor]);

  // Typewriter mode: scroll cursor to vertical center on selection change
  useEffect(() => {
    if (!editor || !state.settings.typewriterMode) return;

    const handleSelectionUpdate = () => {
      const { view } = editor;
      const { from } = view.state.selection;
      const coords = view.coordsAtPos(from);
      const editorEl = view.dom.closest(`.${styles.editorContent}`);
      if (!editorEl || !coords) return;

      const editorRect = editorEl.getBoundingClientRect();
      const cursorY = coords.top - editorRect.top + editorEl.scrollTop;
      const targetScrollTop = cursorY - editorRect.height / 2;

      editorEl.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      });
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => { editor.off('selectionUpdate', handleSelectionUpdate); };
  }, [editor, state.settings.typewriterMode]);

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
      <div className={styles.editorContent}>
        <EditorContent editor={editor} className={styles.editorWrapper} />
      </div>
      {isFocusMode && (
        <div className={styles.focusModeBar}>
          <button className={styles.focusModeExit} onClick={exitFocusMode} aria-label="Exit focus mode">
            <span className="material-symbols-rounded">fullscreen_exit</span>
            <span>Exit Focus Mode</span>
          </button>
        </div>
      )}
    </div>
  );
}
