/**
 * React context for the CodeMirror EditorAdapter.
 * Replaces Tiptap's EditorContext from @tiptap/react.
 */
import { createContext, useContext } from 'react';
import type { EditorAdapter } from './types';

interface EditorContextValue {
  editor: EditorAdapter | null;
}

export const EditorContext = createContext<EditorContextValue>({ editor: null });

/**
 * Hook to access the current editor adapter.
 * Replaces `useCurrentEditor()` from @tiptap/react.
 */
export function useCurrentEditor(): EditorContextValue {
  return useContext(EditorContext);
}
