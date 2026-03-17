/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { typewriterExtension } from './typewriterExtension';

describe('typewriterExtension', () => {
  it('exports a ViewPlugin extension', () => {
    expect(typewriterExtension).toBeDefined();
  });

  it('can be loaded as an extension', () => {
    const container = document.createElement('div');
    const state = EditorState.create({
      doc: 'Hello world\nSecond line\nThird line',
      extensions: [typewriterExtension],
    });
    const view = new EditorView({ state, parent: container });
    expect(view.state.doc.toString()).toContain('Hello world');
    view.destroy();
  });

  it('handles cursor movement without errors', () => {
    const container = document.createElement('div');
    const state = EditorState.create({
      doc: 'Line one\nLine two\nLine three',
      extensions: [typewriterExtension],
    });
    const view = new EditorView({ state, parent: container });
    // Move cursor
    view.dispatch({ selection: { anchor: 15 } });
    expect(view.state.selection.main.head).toBe(15);
    view.destroy();
  });

  it('handles doc changes without errors', () => {
    const container = document.createElement('div');
    const state = EditorState.create({
      doc: 'Initial',
      extensions: [typewriterExtension],
    });
    const view = new EditorView({ state, parent: container });
    view.dispatch({ changes: { from: 7, insert: ' text' } });
    expect(view.state.doc.toString()).toBe('Initial text');
    view.destroy();
  });
});
