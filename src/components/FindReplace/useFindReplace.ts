import { useState, useCallback, useEffect, useRef } from 'react';
import type { EditorAdapter } from '@/lib/editor';

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

export function useFindReplace(editor: EditorAdapter | null): FindReplaceControls {
  const [isOpen, setIsOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [searchTerm, setSearchTermLocal] = useState('');
  const [replaceTerm, setReplaceTermLocal] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState<Array<{ from: number; to: number }>>([]);
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  const totalMatches = matches.length;

  const updateMatches = useCallback((term: string, cs: boolean, ww: boolean) => {
    if (!editor || !term) {
      setMatches([]);
      setCurrentIndex(0);
      editor?.clearHighlights();
      return;
    }
    const found = editor.findMatches(term, { caseSensitive: cs, wholeWord: ww });
    setMatches(found);
    const idx = found.length > 0 ? 0 : 0;
    setCurrentIndex(idx);
    if (found.length > 0) {
      editor.highlightMatches(term, { caseSensitive: cs, wholeWord: ww }, idx);
      editor.scrollToPosition(found[idx].from);
    } else {
      editor.clearHighlights();
    }
  }, [editor]);

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermLocal(term);
    updateMatches(term, caseSensitive, wholeWord);
  }, [caseSensitive, wholeWord, updateMatches]);

  const setReplaceTerm = useCallback((term: string) => {
    setReplaceTermLocal(term);
  }, []);

  const open = useCallback((withReplace = false) => {
    setIsOpen(true);
    setShowReplace(withReplace);
    // Pre-fill search term with selected text
    if (editor) {
      const { empty } = editor.getSelection();
      if (!empty) {
        const text = editor.getSelectedText();
        if (text.length <= 200) {
          setSearchTermLocal(text);
          updateMatches(text, caseSensitive, wholeWord);
        }
      }
    }
  }, [editor, caseSensitive, wholeWord, updateMatches]);

  const close = useCallback(() => {
    setIsOpen(false);
    setMatches([]);
    setCurrentIndex(0);
    editor?.clearHighlights();
    editor?.focus();
  }, [editor]);

  const findNext = useCallback(() => {
    if (!editor || matchesRef.current.length === 0) return;
    const nextIndex = (currentIndex + 1) % matchesRef.current.length;
    setCurrentIndex(nextIndex);
    editor.highlightMatches(searchTerm, { caseSensitive, wholeWord }, nextIndex);
    editor.scrollToPosition(matchesRef.current[nextIndex].from);
  }, [editor, currentIndex, searchTerm, caseSensitive, wholeWord]);

  const findPrev = useCallback(() => {
    if (!editor || matchesRef.current.length === 0) return;
    const prevIndex = (currentIndex - 1 + matchesRef.current.length) % matchesRef.current.length;
    setCurrentIndex(prevIndex);
    editor.highlightMatches(searchTerm, { caseSensitive, wholeWord }, prevIndex);
    editor.scrollToPosition(matchesRef.current[prevIndex].from);
  }, [editor, currentIndex, searchTerm, caseSensitive, wholeWord]);

  const replaceCurrent = useCallback(() => {
    if (!editor || matchesRef.current.length === 0) return;
    const match = matchesRef.current[currentIndex];
    if (match) {
      editor.replaceRange(match.from, match.to, replaceTerm);
      // Re-run search after replacement
      updateMatches(searchTerm, caseSensitive, wholeWord);
    }
  }, [editor, currentIndex, replaceTerm, searchTerm, caseSensitive, wholeWord, updateMatches]);

  const replaceAllFn = useCallback(() => {
    if (!editor || !searchTerm) return;
    editor.replaceAll(searchTerm, replaceTerm, { caseSensitive, wholeWord });
    setMatches([]);
    setCurrentIndex(0);
    editor.clearHighlights();
  }, [editor, searchTerm, replaceTerm, caseSensitive, wholeWord]);

  const toggleCaseSensitive = useCallback(() => {
    const newValue = !caseSensitive;
    setCaseSensitive(newValue);
    updateMatches(searchTerm, newValue, wholeWord);
  }, [caseSensitive, searchTerm, wholeWord, updateMatches]);

  const toggleWholeWord = useCallback(() => {
    const newValue = !wholeWord;
    setWholeWord(newValue);
    updateMatches(searchTerm, caseSensitive, newValue);
  }, [wholeWord, searchTerm, caseSensitive, updateMatches]);

  // Clear state when editor changes
  useEffect(() => {
    setMatches([]);
    setCurrentIndex(0);
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
