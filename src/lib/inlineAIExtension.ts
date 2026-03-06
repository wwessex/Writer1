/**
 * Tiptap extension for inline AI slash commands.
 *
 * Listens for `/` typed at the start of a line or after whitespace and shows
 * a floating command palette. Commands pipe text through the AI provider.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

export interface InlineAIState {
  active: boolean;
  query: string;
  from: number;
  decorationPosition: { top: number; left: number } | null;
}

export type InlineAIStorage = {
  active: boolean;
  query: string;
  from: number;
  decorationPosition: { top: number; left: number } | null;
  onStateChange: ((state: InlineAIState) => void) | null;
};

const inlineAIPluginKey = new PluginKey('inlineAI');

export const InlineAIExtension = Extension.create({
  name: 'inlineAI',

  addStorage() {
    return {
      active: false,
      query: '',
      from: 0,
      decorationPosition: null as { top: number; left: number } | null,
      onStateChange: null as ((state: InlineAIState) => void) | null,
    };
  },

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extension = this;

    return [
      new Plugin({
        key: inlineAIPluginKey,

        props: {
          handleKeyDown(view: EditorView, event: KeyboardEvent) {
            const storage = extension.storage;

            if (storage.active) {
              if (event.key === 'Escape') {
                storage.active = false;
                storage.query = '';
                storage.onStateChange?.({
                  active: false,
                  query: '',
                  from: storage.from,
                  decorationPosition: null,
                });
                return true;
              }

              if (event.key === 'Backspace') {
                if (storage.query.length === 0) {
                  storage.active = false;
                  storage.onStateChange?.({
                    active: false,
                    query: '',
                    from: storage.from,
                    decorationPosition: null,
                  });
                }
                return false;
              }

              return false;
            }

            if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
              const { state } = view;
              const { $from } = state.selection;

              const isAtStart = $from.parentOffset === 0;
              const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
              const isAfterWhitespace = textBefore.length > 0 && /\s$/.test(textBefore);

              if (isAtStart || isAfterWhitespace) {
                const coords = view.coordsAtPos(state.selection.from);
                storage.active = true;
                storage.query = '';
                storage.from = state.selection.from;
                storage.decorationPosition = {
                  top: coords.bottom + 4,
                  left: coords.left,
                };
                storage.onStateChange?.({
                  active: true,
                  query: '',
                  from: state.selection.from,
                  decorationPosition: storage.decorationPosition,
                });
              }
            }

            return false;
          },

          handleTextInput(_view: EditorView, _from: number, _to: number, text: string) {
            const storage = extension.storage;

            if (storage.active) {
              storage.query += text;
              storage.onStateChange?.({
                active: true,
                query: storage.query,
                from: storage.from,
                decorationPosition: storage.decorationPosition,
              });
            }

            return false;
          },
        },
      }),
    ];
  },
});

export function dismissInlineAI(editor: { extensionManager: { extensions: Array<{ name: string; storage: Record<string, unknown> }> } }) {
  const ext = editor.extensionManager.extensions.find(e => e.name === 'inlineAI');
  if (ext) {
    const storage = ext.storage as InlineAIStorage;
    storage.active = false;
    storage.query = '';
    storage.onStateChange?.({
      active: false,
      query: '',
      from: storage.from,
      decorationPosition: null,
    });
  }
}
