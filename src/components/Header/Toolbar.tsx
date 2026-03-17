import { useCallback, useState, useEffect, useRef } from 'react';
import { useCurrentEditor } from '@/lib/editor';
import { useApp } from '@/context/AppContext';
import { IconButton } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import styles from './Toolbar.module.css';

const STYLE_OPTIONS = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' }
];

const LINE_SPACING_OPTIONS = [
  { value: '1', label: 'Single' },
  { value: '1.5', label: '1.5' },
  { value: '2', label: 'Double' }
];

const FORMAT_COMMANDS = [
  { icon: 'format_bold', cmd: 'bold', label: 'Bold', shortcut: 'Ctrl+B' },
  { icon: 'format_italic', cmd: 'italic', label: 'Italic', shortcut: 'Ctrl+I' },
  { icon: 'format_underlined', cmd: 'underline', label: 'Underline', shortcut: 'Ctrl+U' },
  { icon: 'strikethrough_s', cmd: 'strike', label: 'Strikethrough', shortcut: '' }
];

const LIST_COMMANDS = [
  { icon: 'format_list_bulleted', cmd: 'bulletList', label: 'Bullet List', shortcut: '' },
  { icon: 'format_list_numbered', cmd: 'orderedList', label: 'Numbered List', shortcut: '' }
];

const MOBILE_PRIMARY_COMMANDS = FORMAT_COMMANDS.slice(0, 3);
const MOBILE_MORE_FORMATTING_COMMANDS = [
  FORMAT_COMMANDS[3],
  ...LIST_COMMANDS,
  { icon: 'format_quote', cmd: 'blockquote', label: 'Blockquote', shortcut: '' },
  { icon: 'horizontal_rule', cmd: 'horizontalRule', label: 'Horizontal Rule', shortcut: '' }
];

export function Toolbar() {
  const { editor } = useCurrentEditor();
  const { state, createChapter } = useApp();
  const [isMobile, setIsMobile] = useState(false);
  const [moreFormattingOpen, setMoreFormattingOpen] = useState(false);
  const moreFormattingRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [scrollHint, setScrollHint] = useState<'none' | 'right' | 'left' | 'both'>('none');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 820);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMoreFormattingOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el || !isMobile) {
      setScrollHint('none');
      return;
    }

    const updateHint = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const atStart = scrollLeft <= 2;
      const atEnd = scrollLeft + clientWidth >= scrollWidth - 2;

      if (scrollWidth <= clientWidth) setScrollHint('none');
      else if (atStart && atEnd) setScrollHint('none');
      else if (atStart) setScrollHint('right');
      else if (atEnd) setScrollHint('left');
      else setScrollHint('both');
    };

    updateHint();
    el.addEventListener('scroll', updateHint, { passive: true });
    window.addEventListener('resize', updateHint);
    return () => {
      el.removeEventListener('scroll', updateHint);
      window.removeEventListener('resize', updateHint);
    };
  }, [isMobile]);

  // Track whether a touch moved (scrolled) so we don't close the menu on scroll
  const touchMovedRef = useRef(false);

  useEffect(() => {
    const handleTouchStart = () => { touchMovedRef.current = false; };
    const handleTouchMove = () => { touchMovedRef.current = true; };
    const handleClickOutside = (event: MouseEvent) => {
      if (touchMovedRef.current) return;
      if (moreFormattingRef.current && !moreFormattingRef.current.contains(event.target as Node)) {
        setMoreFormattingOpen(false);
      }
    };

    if (moreFormattingOpen) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [moreFormattingOpen]);

  const getCurrentStyle = useCallback(() => {
    if (!editor) return 'p';
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    if (editor.isActive('heading', { level: 3 })) return 'h3';
    if (editor.isActive('heading', { level: 4 })) return 'h4';
    return 'p';
  }, [editor]);

  const handleStyleChange = (value: string) => {
    if (!editor) return;

    switch (value) {
      case 'h1': editor.insertHeading(1); break;
      case 'h2': editor.insertHeading(2); break;
      case 'h3': editor.insertHeading(3); break;
      case 'h4': editor.insertHeading(4); break;
      default: editor.setParagraph();
    }
    editor.focus();
  };

  const [lineSpacing, setLineSpacing] = useState('1.5');

  const handleLineSpacingChange = (value: string) => {
    setLineSpacing(value);
    if (!editor) return;
    editor.setLineHeight(value);
  };

  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleInsertImage = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleImageFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      editor.insertImage(src);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [editor]);

  const handleFormatClick = (cmd: string) => {
    if (!editor) return;

    switch (cmd) {
      case 'bold': editor.toggleBold(); break;
      case 'italic': editor.toggleItalic(); break;
      case 'underline': editor.toggleUnderline(); break;
      case 'strike': editor.toggleStrikethrough(); break;
      case 'bulletList': editor.toggleBulletList(); break;
      case 'orderedList': editor.toggleOrderedList(); break;
      case 'blockquote': editor.toggleBlockquote(); break;
      case 'horizontalRule': editor.insertHorizontalRule(); break;
      case 'undo': editor.undo(); break;
      case 'redo': editor.redo(); break;
    }
    editor.focus();
  };

  const triggerAddComment = useCallback(() => {
    window.dispatchEvent(new CustomEvent('writer1:add-comment'));
  }, []);

  const isActive = (cmd: string) => {
    if (!editor) return false;
    return editor.isActive(cmd);
  };

  if (isMobile) {
    const scrollClasses = [
      styles.toolbarScroll,
      (scrollHint === 'right' || scrollHint === 'both') && styles['toolbarScroll--overflowRight'],
      (scrollHint === 'left' || scrollHint === 'both') && styles['toolbarScroll--overflowLeft'],
    ].filter(Boolean).join(' ');

    return (
      <div className={scrollClasses}>
        <div className={styles.toolbar} ref={toolbarRef}>
          <div className={styles.toolbar__group}>
            <Select
              options={STYLE_OPTIONS}
              value={getCurrentStyle()}
              onChange={e => handleStyleChange(e.target.value)}
              className={styles.styleSelect}
            />
          </div>

          <div className={styles.toolbar__divider} />

          <div className={styles.toolbar__group}>
            {MOBILE_PRIMARY_COMMANDS.map(({ icon, cmd, label }) => (
              <IconButton
                key={cmd}
                icon={icon}
                label={label}
                variant="ghost"
                active={isActive(cmd)}
                onPointerDown={(e: React.PointerEvent) => e.preventDefault()}
                onClick={() => handleFormatClick(cmd)}
                className={styles.toolbarActionBtn}
              />
            ))}

            <div className={styles.moreFormatting} ref={moreFormattingRef}>
              <IconButton
                icon="more_horiz"
                label="More formatting"
                variant="ghost"
                active={moreFormattingOpen}
                onPointerDown={(e: React.PointerEvent) => e.preventDefault()}
                onClick={() => setMoreFormattingOpen(prev => !prev)}
                className={styles.toolbarActionBtn}
              />
              {moreFormattingOpen && (
                <div className={styles.moreFormattingMenu}>
                  {MOBILE_MORE_FORMATTING_COMMANDS.map(({ icon, cmd, label }) => (
                    <button
                      key={cmd}
                      className={styles.moreFormattingItem}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => {
                        handleFormatClick(cmd);
                        setMoreFormattingOpen(false);
                      }}
                    >
                      <span className="material-symbols-rounded">{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                  <button
                    className={styles.moreFormattingItem}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => {
                      handleInsertImage();
                      setMoreFormattingOpen(false);
                    }}
                  >
                    <span className="material-symbols-rounded">image</span>
                    <span>Insert Image</span>
                  </button>
                  <div className={styles.moreFormattingDivider} />
                  <div className={styles.moreFormattingRow}>
                    <span className={styles.moreFormattingLabel}>Line Spacing</span>
                    <Select
                      options={LINE_SPACING_OPTIONS}
                      value={lineSpacing}
                      onChange={e => {
                        handleLineSpacingChange(e.target.value);
                        setMoreFormattingOpen(false);
                      }}
                      className={styles.moreFormattingSelect}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.toolbar__divider} />

          <div className={styles.toolbar__group}>
            <Tooltip content="Add Comment (Ctrl+Shift+M)" position="bottom">
              <IconButton
                icon="add_comment"
                label="Add Comment (Ctrl+Shift+M)"
                variant="ghost"
                onClick={triggerAddComment}
                className={styles.toolbarActionBtn}
              />
            </Tooltip>
            <Tooltip content={state.projectType === 'screenplay' ? 'New Scene' : 'New Chapter'} position="bottom">
              <IconButton
                icon="note_add"
                label={state.projectType === 'screenplay' ? 'New Scene' : 'New Chapter'}
                variant="ghost"
                onClick={createChapter}
                className={styles.toolbarActionBtn}
              />
            </Tooltip>
          </div>

          <div className={styles.toolbar__spacer} />

          <div className={styles.toolbar__group}>
            <IconButton
              icon="undo"
              label="Undo"
              variant="ghost"
              onPointerDown={(e: React.PointerEvent) => e.preventDefault()}
              onClick={() => handleFormatClick('undo')}
              disabled={!editor?.canUndo()}
              className={styles.toolbarActionBtn}
            />
            <IconButton
              icon="redo"
              label="Redo"
              variant="ghost"
              onPointerDown={(e: React.PointerEvent) => e.preventDefault()}
              onClick={() => handleFormatClick('redo')}
              disabled={!editor?.canRedo()}
              className={styles.toolbarActionBtn}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbar__group}>
        <Tooltip content="Paragraph style" position="bottom">
          <Select
            options={STYLE_OPTIONS}
            value={getCurrentStyle()}
            onChange={e => handleStyleChange(e.target.value)}
            className={styles.styleSelect}
          />
        </Tooltip>
      </div>

      <div className={styles.toolbar__divider} />

      <div className={styles.toolbar__group}>
        {FORMAT_COMMANDS.map(({ icon, cmd, label, shortcut }) => (
          <Tooltip key={cmd} content={shortcut ? `${label} (${shortcut})` : label} position="bottom">
            <IconButton
              icon={icon}
              label={shortcut ? `${label} (${shortcut})` : label}
              variant="ghost"
              active={isActive(cmd)}
              onClick={() => handleFormatClick(cmd)}
            />
          </Tooltip>
        ))}
      </div>

      <div className={styles.toolbar__divider} />

      <div className={styles.toolbar__group}>
        {LIST_COMMANDS.map(({ icon, cmd, label }) => (
          <Tooltip key={cmd} content={label} position="bottom">
            <IconButton
              icon={icon}
              label={label}
              variant="ghost"
              active={isActive(cmd)}
              onClick={() => handleFormatClick(cmd)}
            />
          </Tooltip>
        ))}
      </div>

      <div className={styles.toolbar__divider} />

      <div className={styles.toolbar__group}>
        <Tooltip content="Blockquote" position="bottom">
          <IconButton
            icon="format_quote"
            label="Blockquote"
            variant="ghost"
            active={isActive('blockquote')}
            onClick={() => handleFormatClick('blockquote')}
          />
        </Tooltip>
        <Tooltip content="Horizontal Rule" position="bottom">
          <IconButton
            icon="horizontal_rule"
            label="Horizontal Rule"
            variant="ghost"
            onClick={() => handleFormatClick('horizontalRule')}
          />
        </Tooltip>
        <Tooltip content="Insert Image" position="bottom">
          <IconButton
            icon="image"
            label="Insert Image"
            variant="ghost"
            onClick={handleInsertImage}
          />
        </Tooltip>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageFileSelected}
        />
      </div>

      <div className={styles.toolbar__group}>
        <Tooltip content="Add Comment (Ctrl+Shift+M)" position="bottom">
          <IconButton
            icon="add_comment"
            label="Add Comment (Ctrl+Shift+M)"
            variant="ghost"
            onClick={triggerAddComment}
          />
        </Tooltip>
      </div>

      <div className={styles.toolbar__divider} />

      <div className={styles.toolbar__group}>
        <Tooltip content="Line Spacing" position="bottom">
          <Select
            options={LINE_SPACING_OPTIONS}
            value={lineSpacing}
            onChange={e => handleLineSpacingChange(e.target.value)}
            className={styles.lineSpacingSelect}
          />
        </Tooltip>
      </div>

      <div className={styles.toolbar__spacer} />

      <div className={styles.toolbar__group}>
        <Tooltip content="Undo (Ctrl+Z)" position="bottom">
          <IconButton
            icon="undo"
            label="Undo (Ctrl+Z)"
            variant="ghost"
            onClick={() => handleFormatClick('undo')}
            disabled={!editor?.canUndo()}
          />
        </Tooltip>
        <Tooltip content="Redo (Ctrl+Y)" position="bottom">
          <IconButton
            icon="redo"
            label="Redo (Ctrl+Y)"
            variant="ghost"
            onClick={() => handleFormatClick('redo')}
            disabled={!editor?.canRedo()}
          />
        </Tooltip>
      </div>
    </div>
  );
}
