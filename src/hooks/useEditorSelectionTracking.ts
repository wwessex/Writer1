import { useEffect, useState } from 'react';

interface SelectionTrackingEditor {
  state: {
    selection: {
      empty: boolean;
    };
  };
  on: (event: 'selectionUpdate' | 'blur', cb: () => void) => void;
  off: (event: 'selectionUpdate' | 'blur', cb: () => void) => void;
}

export function useEditorSelectionTracking(editor: SelectionTrackingEditor | null | undefined) {
  const [hasTextSelection, setHasTextSelection] = useState(false);

  useEffect(() => {
    if (!editor) {
      setHasTextSelection(false);
      return;
    }

    const updateSelectionState = () => {
      setHasTextSelection(!editor.state.selection.empty);
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
