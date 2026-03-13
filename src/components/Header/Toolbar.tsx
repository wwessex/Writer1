import { useCallback, useState, useEffect, useRef } from 'react';
import { useCurrentEditor } from '@tiptap/react';
import { useApp } from '@/context/AppContext';
import { IconButton } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import { LINE_SPACING_OPTIONS, FONT_FAMILY_OPTIONS } from '@/lib/constants/editorOptions';
import { FormattingButtons, ListButtons, FORMAT_COMMANDS, LIST_COMMANDS } from './FormattingButtons';
import { StyleSelector } from './StyleSelector';
import styles from './Toolbar.module.css';

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

  const [lineSpacing, setLineSpacing] = useState('1.5');
  const [fontFamily, setFontFamily] = useState('default');

  // Sync the font dropdown with the current selection's font
  useEffect(() => {
    if (!editor) return;

    const updateFontFromSelection = () => {
      const attrs = editor.getAttributes('textStyle');
      if (attrs.fontFamily) {
        // Find matching option or fall back to showing the raw value
        const match = FONT_FAMILY_OPTIONS.find(opt => opt.value === attrs.fontFamily);
        setFontFamily(match ? match.value : attrs.fontFamily);
      } else {
        setFontFamily('default');
      }
    };

    editor.on('selectionUpdate', updateFontFromSelection);
    editor.on('transaction', updateFontFromSelection);
    return () => {
      editor.off('selectionUpdate', updateFontFromSelection);
      editor.off('transaction', updateFontFromSelection);
    };
  }, [editor]);

  const handleLineSpacingChange = (value: string) => {
    setLineSpacing(value);
    if (!editor) return;
    const editorElement = editor.view.dom as HTMLElement;
    editorElement.style.lineHeight = value;
  };

  const handleFontFamilyChange = (value: string) => {
    setFontFamily(value);
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    if (hasSelection) {
      // Apply font only to the selected text via inline mark
      if (value === 'default') {
        editor.chain().focus().unsetFontFamily().run();
      } else {
        editor.chain().focus().setFontFamily(value).run();
      }
    } else {
      // No selection: set editor-wide default font
      const editorElement = editor.view.dom as HTMLElement;
      editorElement.style.fontFamily = value === 'default' ? '' : value;
    }
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
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [editor]);

  const handleFormatClick = (cmd: string) => {
    if (!editor) return;

    switch (cmd) {
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'underline':
        editor.chain().focus().toggleUnderline().run();
        break;
      case 'strike':
        editor.chain().focus().toggleStrike().run();
        break;
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'horizontalRule':
        editor.chain().focus().setHorizontalRule().run();
        break;
      case 'undo':
        editor.chain().focus().undo().run();
        break;
      case 'redo':
        editor.chain().focus().redo().run();
        break;
    }
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
            <StyleSelector editor={editor} className={styles.styleSelect} showTooltip={false} />
            <Select
              options={FONT_FAMILY_OPTIONS}
              value={fontFamily}
              onChange={e => handleFontFamilyChange(e.target.value)}
              className={styles.fontSelect}
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
              disabled={!editor?.can().undo()}
              className={styles.toolbarActionBtn}
            />
            <IconButton
              icon="redo"
              label="Redo"
              variant="ghost"
              onPointerDown={(e: React.PointerEvent) => e.preventDefault()}
              onClick={() => handleFormatClick('redo')}
              disabled={!editor?.can().redo()}
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
        <StyleSelector editor={editor} className={styles.styleSelect} />
        <Tooltip content="Font family" position="bottom">
          <Select
            options={FONT_FAMILY_OPTIONS}
            value={fontFamily}
            onChange={e => handleFontFamilyChange(e.target.value)}
            className={styles.fontSelect}
          />
        </Tooltip>
      </div>

      <div className={styles.toolbar__divider} />

      <div className={styles.toolbar__group}>
        <FormattingButtons onFormatClick={handleFormatClick} isActive={isActive} />
      </div>

      <div className={styles.toolbar__divider} />

      <div className={styles.toolbar__group}>
        <ListButtons onFormatClick={handleFormatClick} isActive={isActive} />
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
            disabled={!editor?.can().undo()}
          />
        </Tooltip>
        <Tooltip content="Redo (Ctrl+Y)" position="bottom">
          <IconButton
            icon="redo"
            label="Redo (Ctrl+Y)"
            variant="ghost"
            onClick={() => handleFormatClick('redo')}
            disabled={!editor?.can().redo()}
          />
        </Tooltip>
      </div>
    </div>
  );
}
