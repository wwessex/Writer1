import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  commentAnchorsField,
  commentDecorationsField,
  setCommentAnchorEffect,
  removeCommentAnchorEffect,
  updateCommentAnchorStateEffect,
  clearCommentAnchorsEffect,
  loadCommentAnchorsEffect,
  dispatchSetCommentAnchor,
  dispatchUpdateCommentState,
  dispatchLoadCommentAnchors,
} from './commentExtension';

function createState(doc = 'Hello, world! This is a test document.') {
  return EditorState.create({
    doc,
    extensions: [commentAnchorsField, commentDecorationsField],
  });
}

describe('commentExtension', () => {
  it('starts with empty anchors', () => {
    const state = createState();
    expect(state.field(commentAnchorsField)).toEqual([]);
  });

  it('adds an anchor via setCommentAnchorEffect', () => {
    const state = createState();
    const tr = state.update({
      effects: setCommentAnchorEffect.of({ threadId: 't1', from: 0, to: 5, state: 'open' }),
    });
    const anchors = tr.state.field(commentAnchorsField);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toEqual({ threadId: 't1', from: 0, to: 5, state: 'open' });
  });

  it('replaces anchor with same threadId', () => {
    let state = createState();
    state = state.update({
      effects: setCommentAnchorEffect.of({ threadId: 't1', from: 0, to: 5, state: 'open' }),
    }).state;
    state = state.update({
      effects: setCommentAnchorEffect.of({ threadId: 't1', from: 2, to: 8, state: 'open' }),
    }).state;
    const anchors = state.field(commentAnchorsField);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].from).toBe(2);
  });

  it('removes an anchor via removeCommentAnchorEffect', () => {
    let state = createState();
    state = state.update({
      effects: setCommentAnchorEffect.of({ threadId: 't1', from: 0, to: 5, state: 'open' }),
    }).state;
    state = state.update({
      effects: removeCommentAnchorEffect.of('t1'),
    }).state;
    expect(state.field(commentAnchorsField)).toHaveLength(0);
  });

  it('updates anchor state via updateCommentAnchorStateEffect', () => {
    let state = createState();
    state = state.update({
      effects: setCommentAnchorEffect.of({ threadId: 't1', from: 0, to: 5, state: 'open' }),
    }).state;
    state = state.update({
      effects: updateCommentAnchorStateEffect.of({ threadId: 't1', state: 'resolved' }),
    }).state;
    expect(state.field(commentAnchorsField)[0].state).toBe('resolved');
  });

  it('clears all anchors via clearCommentAnchorsEffect', () => {
    let state = createState();
    state = state.update({
      effects: [
        setCommentAnchorEffect.of({ threadId: 't1', from: 0, to: 5, state: 'open' }),
        setCommentAnchorEffect.of({ threadId: 't2', from: 6, to: 10, state: 'open' }),
      ],
    }).state;
    state = state.update({
      effects: clearCommentAnchorsEffect.of(undefined),
    }).state;
    expect(state.field(commentAnchorsField)).toHaveLength(0);
  });

  it('loads anchors via loadCommentAnchorsEffect', () => {
    let state = createState();
    const anchors = [
      { threadId: 't1', from: 0, to: 5, state: 'open' as const },
      { threadId: 't2', from: 6, to: 10, state: 'resolved' as const },
    ];
    state = state.update({
      effects: loadCommentAnchorsEffect.of(anchors),
    }).state;
    expect(state.field(commentAnchorsField)).toEqual(anchors);
  });

  it('remaps positions on document changes', () => {
    let state = createState('Hello world');
    state = state.update({
      effects: setCommentAnchorEffect.of({ threadId: 't1', from: 6, to: 11, state: 'open' }),
    }).state;
    // Insert "XX" at position 0
    state = state.update({
      changes: { from: 0, insert: 'XX' },
    }).state;
    const anchors = state.field(commentAnchorsField);
    expect(anchors[0].from).toBe(8);
    expect(anchors[0].to).toBe(13);
  });

  it('removes collapsed anchors on document changes', () => {
    let state = createState('Hello world');
    state = state.update({
      effects: setCommentAnchorEffect.of({ threadId: 't1', from: 2, to: 5, state: 'open' }),
    }).state;
    // Delete the anchored range
    state = state.update({
      changes: { from: 0, to: 8 },
    }).state;
    expect(state.field(commentAnchorsField)).toHaveLength(0);
  });

  it('builds decorations from anchors', () => {
    const state = createState('Hello, world! This is a test.');
    const updated = state.update({
      effects: setCommentAnchorEffect.of({ threadId: 't1', from: 0, to: 5, state: 'open' }),
    }).state;
    const decos = updated.field(commentDecorationsField);
    expect(decos).toBeDefined();
  });

  it('dispatchSetCommentAnchor dispatches to view', () => {
    const container = document.createElement('div');
    const view = new EditorView({
      state: createState(),
      parent: container,
    });
    dispatchSetCommentAnchor(view, { threadId: 't1', from: 0, to: 5, state: 'open' });
    expect(view.state.field(commentAnchorsField)).toHaveLength(1);
    view.destroy();
  });

  it('dispatchUpdateCommentState updates state', () => {
    const container = document.createElement('div');
    const view = new EditorView({
      state: createState(),
      parent: container,
    });
    dispatchSetCommentAnchor(view, { threadId: 't1', from: 0, to: 5, state: 'open' });
    dispatchUpdateCommentState(view, 't1', 'resolved');
    expect(view.state.field(commentAnchorsField)[0].state).toBe('resolved');
    view.destroy();
  });

  it('dispatchLoadCommentAnchors loads anchors', () => {
    const container = document.createElement('div');
    const view = new EditorView({
      state: createState(),
      parent: container,
    });
    const anchors = [{ threadId: 't1', from: 0, to: 5, state: 'open' as const }];
    dispatchLoadCommentAnchors(view, anchors);
    expect(view.state.field(commentAnchorsField)).toEqual(anchors);
    view.destroy();
  });
});
