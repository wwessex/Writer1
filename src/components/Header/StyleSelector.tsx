import { useCallback } from 'react';
import { Tooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import { STYLE_OPTIONS } from '@/lib/constants/editorOptions';
import type { Editor } from '@tiptap/react';

interface StyleSelectorProps {
  editor: Editor | null;
  className?: string;
  showTooltip?: boolean;
}

export function StyleSelector({ editor, className, showTooltip = true }: StyleSelectorProps) {
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
      case 'h1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
      case 'h2': editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
      case 'h3': editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
      case 'h4': editor.chain().focus().toggleHeading({ level: 4 }).run(); break;
      default: editor.chain().focus().setParagraph().run();
    }
  };

  const select = (
    <Select
      options={STYLE_OPTIONS}
      value={getCurrentStyle()}
      onChange={e => handleStyleChange(e.target.value)}
      className={className}
    />
  );

  if (showTooltip) {
    return <Tooltip content="Paragraph style" position="bottom">{select}</Tooltip>;
  }
  return select;
}
