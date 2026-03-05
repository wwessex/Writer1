/**
 * Tiptap extension for real-time AI-powered grammar checking.
 *
 * Runs grammar checks on the current paragraph after a debounced pause.
 * Shows inline decorations (wavy underlines) for issues with
 * hover tooltips showing suggestions.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface GrammarIssue {
  id: string;
  from: number;
  to: number;
  message: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'style';
}

export interface GrammarCheckState {
  enabled: boolean;
  checking: boolean;
  issues: GrammarIssue[];
}

const grammarPluginKey = new PluginKey('grammarCheck');

export const GrammarCheckExtension = Extension.create({
  name: 'grammarCheck',

  addStorage() {
    return {
      enabled: false,
      checking: false,
      issues: [] as GrammarIssue[],
      decorations: DecorationSet.empty,
      checkTimeout: null as ReturnType<typeof setTimeout> | null,
      onStateChange: null as ((state: GrammarCheckState) => void) | null,
      checkCallback: null as ((text: string, from: number) => Promise<GrammarIssue[]>) | null,
    };
  },

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extension = this;

    return [
      new Plugin({
        key: grammarPluginKey,

        state: {
          init() {
            return DecorationSet.empty;
          },

          apply(tr, _old) {
            void _old;
            const storage = extension.storage;
            if (!storage.enabled || storage.issues.length === 0) {
              return DecorationSet.empty;
            }

            const decos = storage.issues.map((issue: GrammarIssue) => {
              const className = issue.severity === 'error'
                ? 'grammar-error'
                : issue.severity === 'warning'
                  ? 'grammar-warning'
                  : 'grammar-style';

              return Decoration.inline(issue.from, issue.to, {
                class: className,
                title: `${issue.message}${issue.suggestion ? ` → ${issue.suggestion}` : ''}`,
              });
            });

            return DecorationSet.create(tr.doc, decos);
          },
        },

        props: {
          decorations(state) {
            return grammarPluginKey.getState(state);
          },
        },

        view() {
          return {
            update(view) {
              const storage = extension.storage;
              if (!storage.enabled || !storage.checkCallback) return;

              if (storage.checkTimeout) {
                clearTimeout(storage.checkTimeout);
              }

              storage.checkTimeout = setTimeout(async () => {
                const { $from } = view.state.selection;
                const paragraph = $from.parent;
                const start = $from.start();
                const text = paragraph.textContent;

                if (text.length < 10) return;

                storage.checking = true;
                storage.onStateChange?.({
                  enabled: storage.enabled,
                  checking: true,
                  issues: storage.issues,
                });

                try {
                  const newIssues = await storage.checkCallback(text, start);
                  storage.issues = newIssues;
                } catch {
                  // Silently fail grammar checks
                } finally {
                  storage.checking = false;
                  storage.onStateChange?.({
                    enabled: storage.enabled,
                    checking: false,
                    issues: storage.issues,
                  });
                }
              }, 2000);
            },
          };
        },
      }),
    ];
  },
});
