import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export const findReplacePluginKey = new PluginKey('findReplace');

interface FindReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  currentIndex: number;
  matches: Array<{ from: number; to: number }>;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegex(term: string, caseSensitive: boolean, wholeWord: boolean): RegExp {
  const escaped = escapeRegex(term);
  const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
  return new RegExp(pattern, caseSensitive ? 'g' : 'gi');
}

function findMatches(
  doc: ProseMirrorNode,
  searchTerm: string,
  caseSensitive: boolean,
  wholeWord: boolean
): Array<{ from: number; to: number }> {
  if (!searchTerm) return [];

  const results: Array<{ from: number; to: number }> = [];
  const regex = buildRegex(searchTerm, caseSensitive, wholeWord);

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(node.text)) !== null) {
      results.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
      });
    }
  });

  return results;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    findReplace: {
      setSearchTerm: (term: string) => ReturnType;
      setReplaceTerm: (term: string) => ReturnType;
      findNext: () => ReturnType;
      findPrev: () => ReturnType;
      replaceCurrent: () => ReturnType;
      replaceAll: () => ReturnType;
      clearSearch: () => ReturnType;
      toggleCaseSensitive: () => ReturnType;
      toggleWholeWord: () => ReturnType;
    };
  }
}

export const FindReplaceExtension = Extension.create<object, FindReplaceStorage>({
  name: 'findReplace',

  addStorage() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      wholeWord: false,
      currentIndex: 0,
      matches: [],
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: findReplacePluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(_tr, _oldDecorations, _oldState, newState) {
            const storage = extension.storage;
            if (!storage.searchTerm) {
              storage.matches = [];
              return DecorationSet.empty;
            }

            const matches = findMatches(
              newState.doc,
              storage.searchTerm,
              storage.caseSensitive,
              storage.wholeWord
            );
            storage.matches = matches;

            // Clamp currentIndex
            if (matches.length === 0) {
              storage.currentIndex = 0;
            } else if (storage.currentIndex >= matches.length) {
              storage.currentIndex = 0;
            }

            const decorations = matches.map((match, i) => {
              const className = i === storage.currentIndex
                ? 'find-replace-current'
                : 'find-replace-match';
              return Decoration.inline(match.from, match.to, { class: className });
            });

            return DecorationSet.create(newState.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return findReplacePluginKey.getState(state) as DecorationSet;
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setSearchTerm: (term: string) => ({ editor }) => {
        this.storage.searchTerm = term;
        this.storage.currentIndex = 0;
        // Force decoration recalculation
        editor.view.dispatch(editor.state.tr.setMeta('findReplace', true));
        return true;
      },

      setReplaceTerm: (term: string) => () => {
        this.storage.replaceTerm = term;
        return true;
      },

      findNext: () => ({ editor }) => {
        const { matches } = this.storage;
        if (matches.length === 0) return false;
        this.storage.currentIndex = (this.storage.currentIndex + 1) % matches.length;
        const match = matches[this.storage.currentIndex];
        editor.commands.setTextSelection(match);
        // Force decoration update and scroll
        editor.view.dispatch(editor.state.tr.setMeta('findReplace', true));
        editor.commands.scrollIntoView();
        return true;
      },

      findPrev: () => ({ editor }) => {
        const { matches } = this.storage;
        if (matches.length === 0) return false;
        this.storage.currentIndex = (this.storage.currentIndex - 1 + matches.length) % matches.length;
        const match = matches[this.storage.currentIndex];
        editor.commands.setTextSelection(match);
        editor.view.dispatch(editor.state.tr.setMeta('findReplace', true));
        editor.commands.scrollIntoView();
        return true;
      },

      replaceCurrent: () => ({ editor }) => {
        const { matches, currentIndex, replaceTerm } = this.storage;
        if (matches.length === 0) return false;
        const match = matches[currentIndex];
        editor.chain()
          .setTextSelection(match)
          .insertContentAt({ from: match.from, to: match.to }, replaceTerm)
          .run();
        // After replacement, trigger re-search via decoration update
        editor.view.dispatch(editor.state.tr.setMeta('findReplace', true));
        return true;
      },

      replaceAll: () => ({ editor }) => {
        const { matches, replaceTerm } = this.storage;
        if (matches.length === 0) return false;
        // Replace in reverse order to preserve positions
        const { tr } = editor.state;
        for (let i = matches.length - 1; i >= 0; i--) {
          const match = matches[i];
          tr.replaceRangeWith(match.from, match.to, editor.schema.text(replaceTerm));
        }
        tr.setMeta('findReplace', true);
        editor.view.dispatch(tr);
        this.storage.currentIndex = 0;
        return true;
      },

      clearSearch: () => ({ editor }) => {
        this.storage.searchTerm = '';
        this.storage.replaceTerm = '';
        this.storage.currentIndex = 0;
        this.storage.matches = [];
        editor.view.dispatch(editor.state.tr.setMeta('findReplace', true));
        return true;
      },

      toggleCaseSensitive: () => ({ editor }) => {
        this.storage.caseSensitive = !this.storage.caseSensitive;
        this.storage.currentIndex = 0;
        editor.view.dispatch(editor.state.tr.setMeta('findReplace', true));
        return true;
      },

      toggleWholeWord: () => ({ editor }) => {
        this.storage.wholeWord = !this.storage.wholeWord;
        this.storage.currentIndex = 0;
        editor.view.dispatch(editor.state.tr.setMeta('findReplace', true));
        return true;
      },
    };
  },
});
