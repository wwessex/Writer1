import { useCallback } from 'react';
import { useCurrentEditor } from '@tiptap/react';
import { IconButton } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import styles from './Toolbar.module.css';

const STYLE_OPTIONS = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' }
];

export function Toolbar() {
  const { editor } = useCurrentEditor();

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
    { icon: 'format_bold', cmd: 'bold', label: 'Bold (Ctrl+B)' },
    { icon: 'format_italic', cmd: 'italic', label: 'Italic (Ctrl+I)' },
    { icon: 'format_underlined', cmd: 'underline', label: 'Underline (Ctrl+U)' },
    { icon: 'strikethrough_s', cmd: 'strike', label: 'Strikethrough' }
  ];

  const listCommands = [
    { icon: 'format_list_bulleted', cmd: 'bulletList', label: 'Bullet List' },
    { icon: 'format_list_numbered', cmd: 'orderedList', label: 'Numbered List' }
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
        {formatCommands.map(({ icon, cmd, label }) => (
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
        {listCommands.map(({ icon, cmd, label }) => (
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
          icon="format_quote"
          label="Blockquote"
          variant="ghost"
          active={isActive('blockquote')}
          onClick={() => handleFormatClick('blockquote')}
        />
        <IconButton
          icon="horizontal_rule"
          label="Horizontal Rule"
          variant="ghost"
          onClick={() => handleFormatClick('horizontalRule')}
        />
      </div>

      <div className={styles.toolbar__spacer} />

      <div className={styles.toolbar__group}>
        <IconButton
          icon="undo"
          label="Undo (Ctrl+Z)"
          variant="ghost"
          onClick={() => handleFormatClick('undo')}
          disabled={!editor?.can().undo()}
        />
        <IconButton
          icon="redo"
          label="Redo (Ctrl+Y)"
          variant="ghost"
          onClick={() => handleFormatClick('redo')}
          disabled={!editor?.can().redo()}
        />
      </div>
    </div>
  );
}
