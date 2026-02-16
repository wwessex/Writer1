import { useCallback, useState, useEffect, useRef } from 'react';
import { useCurrentEditor } from '@tiptap/react';
import { useApp } from '@/context/AppContext';
import { IconButton } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import styles from './Toolbar.module.css';

const STYLE_OPTIONS = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' }
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreFormattingRef.current && !moreFormattingRef.current.contains(event.target as Node)) {
        setMoreFormattingOpen(false);
      }
    };

    if (moreFormattingOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [moreFormattingOpen]);

  const getCurrentStyle = useCallback(() => {
    if (!editor) return 'p';
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    return 'p';
  }, [editor]);

  const handleStyleChange = (value: string) => {
    if (!editor) return;

    switch (value) {
      case 'h1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'h2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      default:
        editor.chain().focus().setParagraph().run();
    }
  };

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
                onClick={() => setMoreFormattingOpen(prev => !prev)}
                className={styles.toolbarActionBtn}
              />
              {moreFormattingOpen && (
                <div className={styles.moreFormattingMenu}>
                  {MOBILE_MORE_FORMATTING_COMMANDS.map(({ icon, cmd, label }) => (
                    <button
                      key={cmd}
                      className={styles.moreFormattingItem}
                      onClick={() => {
                        handleFormatClick(cmd);
                        setMoreFormattingOpen(false);
                      }}
                    >
                      <span className="material-symbols-rounded">{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
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
              onClick={() => handleFormatClick('undo')}
              disabled={!editor?.can().undo()}
              className={styles.toolbarActionBtn}
            />
            <IconButton
              icon="redo"
              label="Redo"
              variant="ghost"
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
        <Select
          options={STYLE_OPTIONS}
          value={getCurrentStyle()}
          onChange={e => handleStyleChange(e.target.value)}
          className={styles.styleSelect}
        />
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
