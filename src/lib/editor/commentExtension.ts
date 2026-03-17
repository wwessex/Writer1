/**
 * Comment anchor tracking for CodeMirror 6.
 * Stores comment positions as a side-channel StateField and renders decorations.
 */
import { StateField, StateEffect, type EditorState } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';

export interface CommentAnchorData {
  threadId: string;
  from: number;
  to: number;
  state: 'open' | 'resolved';
}

// ── Effects ────────────────────────────────────────────────

export const setCommentAnchorEffect = StateEffect.define<CommentAnchorData>();
export const removeCommentAnchorEffect = StateEffect.define<string>(); // threadId
export const updateCommentAnchorStateEffect = StateEffect.define<{ threadId: string; state: 'open' | 'resolved' }>();
export const clearCommentAnchorsEffect = StateEffect.define<void>();
export const loadCommentAnchorsEffect = StateEffect.define<CommentAnchorData[]>();

// ── StateField ─────────────────────────────────────────────

export const commentAnchorsField = StateField.define<CommentAnchorData[]>({
  create() {
    return [];
  },

  update(anchors, tr) {
    let result = anchors;

    // Remap positions on document changes
    if (tr.docChanged) {
      result = result.map(anchor => {
        const from = tr.changes.mapPos(anchor.from, 1);
        const to = tr.changes.mapPos(anchor.to, -1);
        if (from >= to) return null; // Anchor collapsed
        return { ...anchor, from, to };
      }).filter((a): a is CommentAnchorData => a !== null);
    }

    // Process effects
    for (const effect of tr.effects) {
      if (effect.is(setCommentAnchorEffect)) {
        const newAnchor = effect.value;
        result = result.filter(a => a.threadId !== newAnchor.threadId);
        result.push(newAnchor);
      }
      if (effect.is(removeCommentAnchorEffect)) {
        result = result.filter(a => a.threadId !== effect.value);
      }
      if (effect.is(updateCommentAnchorStateEffect)) {
        result = result.map(a =>
          a.threadId === effect.value.threadId
            ? { ...a, state: effect.value.state }
            : a
        );
      }
      if (effect.is(clearCommentAnchorsEffect)) {
        result = [];
      }
      if (effect.is(loadCommentAnchorsEffect)) {
        result = effect.value;
      }
    }

    return result;
  },
});

// ── Decorations ────────────────────────────────────────────

function buildDecorations(state: EditorState): DecorationSet {
  const anchors = state.field(commentAnchorsField);
  const decorations = anchors
    .filter(a => a.from < state.doc.length && a.to <= state.doc.length && a.from < a.to)
    .sort((a, b) => a.from - b.from)
    .map(anchor =>
      Decoration.mark({
        class: anchor.state === 'resolved' ? 'cm-comment-anchor-resolved' : 'cm-comment-anchor',
        attributes: { 'data-comment-thread-id': anchor.threadId },
      }).range(anchor.from, anchor.to)
    );

  return Decoration.set(decorations);
}

export const commentDecorationsField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state);
  },
  update(_decorations, tr) {
    return buildDecorations(tr.state);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ── Helper to dispatch comment anchor effects ──────────────

export function dispatchSetCommentAnchor(view: EditorView, data: CommentAnchorData) {
  view.dispatch({ effects: setCommentAnchorEffect.of(data) });
}

export function dispatchUpdateCommentState(view: EditorView, threadId: string, state: 'open' | 'resolved') {
  view.dispatch({ effects: updateCommentAnchorStateEffect.of({ threadId, state }) });
}

export function dispatchLoadCommentAnchors(view: EditorView, anchors: CommentAnchorData[]) {
  view.dispatch({ effects: loadCommentAnchorsEffect.of(anchors) });
}
