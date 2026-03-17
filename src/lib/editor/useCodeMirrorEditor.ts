/**
 * React hook that creates and manages a CodeMirror 6 EditorView.
 * Returns an EditorAdapter and a ref to mount the editor into.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { EditorState, Compartment, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { draftharbourTheme, draftharbourHighlightTheme } from './theme';
import { richPreviewExtension } from './richPreviewExtension';
import { commentAnchorsField, commentDecorationsField } from './commentExtension';
import { typewriterExtension } from './typewriterExtension';
import { fountainDecoPlugin, fountainKeymap } from './fountainExtension';
import { CodeMirrorAdapter, findHighlightsField } from './codemirrorAdapter';
import type { EditorAdapter } from './types';

interface UseCodeMirrorEditorOptions {
  initialContent?: string;
  onChange?: (content: string) => void;
  screenplayMode?: boolean;
  typewriterMode?: boolean;
}

export function useCodeMirrorEditor(options: UseCodeMirrorEditorOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const adapterRef = useRef<CodeMirrorAdapter | null>(null);
  const [adapter, setAdapter] = useState<EditorAdapter | null>(null);
  const onChangeRef = useRef(options.onChange);
  onChangeRef.current = options.onChange;

  const screenplayMode = options.screenplayMode ?? false;
  const typewriterMode = options.typewriterMode ?? false;

  // Compartment for dynamic extensions (screenplay/typewriter)
  const dynamicCompartment = useRef(new Compartment());

  const getDynamicExtensions = useCallback((): Extension[] => {
    const exts: Extension[] = [];
    if (screenplayMode) {
      exts.push(fountainDecoPlugin, fountainKeymap);
    }
    if (typewriterMode) {
      exts.push(typewriterExtension);
    }
    return exts;
  }, [screenplayMode, typewriterMode]);

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const compartment = dynamicCompartment.current;

    const extensions: Extension[] = [
      // Core
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown(),
      syntaxHighlighting(defaultHighlightStyle),

      // Theme
      draftharbourTheme,
      draftharbourHighlightTheme,

      // Rich preview decorations
      richPreviewExtension,

      // Comment anchors
      commentAnchorsField,
      commentDecorationsField,

      // Find/replace highlight decorations
      findHighlightsField,

      // Update listener to proxy events to adapter
      EditorView.updateListener.of((update) => {
        const ad = adapterRef.current;
        if (!ad) return;

        ad.emitUpdate(update.docChanged, update.selectionSet, update.focusChanged);

        if (update.docChanged) {
          onChangeRef.current?.(update.state.doc.toString());
        }
      }),

      // Dynamic extensions (screenplay, typewriter) via compartment
      compartment.of(getDynamicExtensions()),
    ];

    const state = EditorState.create({
      doc: options.initialContent || '',
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    const ad = new CodeMirrorAdapter(view);
    adapterRef.current = ad;
    setAdapter(ad);

    return () => {
      ad.destroy();
      viewRef.current = null;
      adapterRef.current = null;
      setAdapter(null);
    };
    // Only run on mount/unmount. Content and mode changes handled via reconfigure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconfigure dynamic extensions when screenplay/typewriter mode changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: dynamicCompartment.current.reconfigure(getDynamicExtensions()),
    });
  }, [getDynamicExtensions]);

  return { containerRef, adapter };
}
