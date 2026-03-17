import { useEffect, useState } from 'react';
import type { EditorAdapter } from '@/lib/editor';

export function useEditorSelectionTracking(editor: EditorAdapter | null | undefined) {
  const [hasTextSelection, setHasTextSelection] = useState(false);

  useEffect(() => {
    if (!editor) {
      setHasTextSelection(false);
      return;
    }

    const updateSelectionState = () => {
      setHasTextSelection(!editor.getSelection().empty);
    };
    const handleEditorBlur = () => setHasTextSelection(false);

    updateSelectionState();
    editor.on('selectionUpdate', updateSelectionState);
    editor.on('blur', handleEditorBlur);

    return () => {
      editor.off('selectionUpdate', updateSelectionState);
      editor.off('blur', handleEditorBlur);
    };
  }, [editor]);

  return hasTextSelection;
}
