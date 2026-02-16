import { useState, useCallback } from 'react';
import type { Editor } from '@tiptap/core';

export interface FindReplaceControls {
  isOpen: boolean;
  showReplace: boolean;
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  currentIndex: number;
  totalMatches: number;
  setSearchTerm: (term: string) => void;
  setReplaceTerm: (term: string) => void;
  findNext: () => void;
  findPrev: () => void;
  replaceCurrent: () => void;
  replaceAll: () => void;
  toggleCaseSensitive: () => void;
  toggleWholeWord: () => void;
  open: (withReplace?: boolean) => void;
  close: () => void;
}

export function useFindReplace(editor: Editor | null): FindReplaceControls {
  const [isOpen, setIsOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [searchTerm, setSearchTermLocal] = useState('');
  const [replaceTerm, setReplaceTermLocal] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);

  const storage = editor?.storage?.findReplace;
  const currentIndex = storage?.currentIndex ?? 0;
  const totalMatches = storage?.matches?.length ?? 0;

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermLocal(term);
    editor?.commands.setSearchTerm(term);
  }, [editor]);

  const setReplaceTerm = useCallback((term: string) => {
    setReplaceTermLocal(term);
    editor?.commands.setReplaceTerm(term);
  }, [editor]);

  const open = useCallback((withReplace = false) => {
    setIsOpen(true);
    setShowReplace(withReplace);
    // Pre-fill search term with selected text
    if (editor) {
      const { from, to, empty } = editor.state.selection;
      if (!empty) {
        const text = editor.state.doc.textBetween(from, to);
        if (text.length <= 200) {
          setSearchTermLocal(text);
          editor.commands.setSearchTerm(text);
        }
      }
    }
  }, [editor]);

  const close = useCallback(() => {
    setIsOpen(false);
    editor?.commands.clearSearch();
    editor?.commands.focus();
  }, [editor]);

  const findNext = useCallback(() => {
    editor?.commands.findNext();
  }, [editor]);

  const findPrev = useCallback(() => {
    editor?.commands.findPrev();
  }, [editor]);

  const replaceCurrent = useCallback(() => {
    editor?.commands.replaceCurrent();
  }, [editor]);

  const replaceAllFn = useCallback(() => {
    editor?.commands.replaceAll();
  }, [editor]);

  const toggleCaseSensitive = useCallback(() => {
    setCaseSensitive(prev => !prev);
    editor?.commands.toggleCaseSensitive();
  }, [editor]);

  const toggleWholeWord = useCallback(() => {
    setWholeWord(prev => !prev);
    editor?.commands.toggleWholeWord();
  }, [editor]);

  return {
    isOpen,
    showReplace,
    searchTerm,
    replaceTerm,
    caseSensitive,
    wholeWord,
    currentIndex,
    totalMatches,
    setSearchTerm,
    setReplaceTerm,
    findNext,
    findPrev,
    replaceCurrent,
    replaceAll: replaceAllFn,
    toggleCaseSensitive,
    toggleWholeWord,
    open,
    close,
  };
}
