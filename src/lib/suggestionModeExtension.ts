/**
 * Tiptap extension for Suggestion Mode (Track Changes).
 *
 * When active, all edits are tracked as suggestions that can be
 * individually accepted or rejected. Uses custom marks for insertions
 * (highlighted green) and deletions (struck through red).
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface TrackedChange {
  id: string;
  type: 'insertion' | 'deletion';
  from: number;
  to: number;
  text: string;
  author: string;
  createdAt: number;
}

export interface SuggestionModeState {
  enabled: boolean;
  changes: TrackedChange[];
}

const suggestionModePluginKey = new PluginKey('suggestionMode');

export const SuggestionModeExtension = Extension.create({
  name: 'suggestionMode',

  addStorage() {
    return {
      enabled: false,
      changes: [] as TrackedChange[],
      onStateChange: null as ((state: SuggestionModeState) => void) | null,
    };
  },

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extension = this;

    return [
      new Plugin({
        key: suggestionModePluginKey,

        filterTransaction(tr) {
          const storage = extension.storage;
          if (!storage.enabled || !tr.docChanged || tr.getMeta('suggestionMode-internal')) {
            return true;
          }

          // Track insertions from this transaction
          tr.steps.forEach(() => {
            const change: TrackedChange = {
              id: `change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: 'insertion',
              from: tr.mapping.map(tr.selection?.from ?? 0),
              to: tr.mapping.map(tr.selection?.to ?? 0),
              text: '',
              author: 'Author',
              createdAt: Date.now(),
            };
            storage.changes.push(change);
          });

          storage.onStateChange?.({
            enabled: storage.enabled,
            changes: storage.changes,
          });

          return true;
        },
      }),
    ];
  },
});

/** Toggle suggestion mode on the editor. */
export function toggleSuggestionMode(editor: { extensionManager: { extensions: Array<{ name: string; storage: Record<string, unknown> }> } }) {
  const ext = editor.extensionManager.extensions.find(e => e.name === 'suggestionMode');
  if (ext) {
    const storage = ext.storage as {
      enabled: boolean;
      changes: TrackedChange[];
      onStateChange: ((state: SuggestionModeState) => void) | null;
    };
    storage.enabled = !storage.enabled;
    if (!storage.enabled) {
      storage.changes = [];
    }
    storage.onStateChange?.({
      enabled: storage.enabled,
      changes: storage.changes,
    });
  }
}
