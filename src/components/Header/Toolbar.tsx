import { useCallback, useState, useEffect } from 'react';
import { useCurrentEditor } from '@tiptap/react';
import { IconButton } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import styles from './Toolbar.module.css';

const STYLE_OPTIONS = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' }
];

export function Toolbar() {
  const { editor } = useCurrentEditor();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 820);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  const formatCommands = [
    { icon: 'format_bold', cmd: 'bold', label: 'Bold', shortcut: 'Ctrl+B' },
    { icon: 'format_italic', cmd: 'italic', label: 'Italic', shortcut: 'Ctrl+I' },
    { icon: 'format_underlined', cmd: 'underline', label: 'Underline', shortcut: 'Ctrl+U' },
    { icon: 'strikethrough_s', cmd: 'strike', label: 'Strikethrough', shortcut: '' }
  ];

  const listCommands = [
    { icon: 'format_list_bulleted', cmd: 'bulletList', label: 'Bullet List', shortcut: '' },
    { icon: 'format_list_numbered', cmd: 'orderedList', label: 'Numbered List', shortcut: '' }
  ];

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

  const isActive = (cmd: string) => {
    if (!editor) return false;
    return editor.isActive(cmd);
  };

  // Mobile: show only essential formatting buttons
  if (isMobile) {
    const mobileCommands = formatCommands.slice(0, 3); // Bold, Italic, Underline only

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
          {mobileCommands.map(({ icon, cmd, label }) => (
            <IconButton
              key={cmd}
              icon={icon}
              label={label}
              variant="ghost"
              active={isActive(cmd)}
              onClick={() => handleFormatClick(cmd)}
            />
          ))}
        </div>

        <div className={styles.toolbar__divider} />

        <div className={styles.toolbar__group}>
          <IconButton
            icon="format_list_bulleted"
            label="Bullet List"
            variant="ghost"
            active={isActive('bulletList')}
            onClick={() => handleFormatClick('bulletList')}
          />
        </div>

        <div className={styles.toolbar__spacer} />

        <div className={styles.toolbar__group}>
          <IconButton
            icon="undo"
            label="Undo"
            variant="ghost"
            onClick={() => handleFormatClick('undo')}
            disabled={!editor?.can().undo()}
          />
          <IconButton
            icon="redo"
            label="Redo"
            variant="ghost"
            onClick={() => handleFormatClick('redo')}
            disabled={!editor?.can().redo()}
          />
        </div>
      </div>
    );
  }

  // Desktop: full toolbar with tooltips
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
        {formatCommands.map(({ icon, cmd, label, shortcut }) => (
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
        {listCommands.map(({ icon, cmd, label }) => (
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
