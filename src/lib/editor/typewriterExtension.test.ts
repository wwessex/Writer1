/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
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

  it('centers the cursor position via requestMeasure write phase', () => {
    const container = document.createElement('div');
    const state = EditorState.create({
      doc: 'Line one\nLine two\nLine three',
      extensions: [typewriterExtension],
    });
    const view = new EditorView({ state, parent: container });

    const scrollTo = vi.fn();
    Object.defineProperty(view.scrollDOM, 'scrollTop', { value: 30, writable: true });
    view.scrollDOM.scrollTo = scrollTo;
    view.scrollDOM.getBoundingClientRect = () =>
      ({ top: 20, height: 200, left: 0, right: 0, bottom: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    view.coordsAtPos = () => ({ top: 100, bottom: 110, left: 0, right: 10 }) as DOMRect;
    const originalRequestMeasure = view.requestMeasure.bind(view);
    view.requestMeasure = ((arg1: unknown, arg2?: unknown) => {
      const spec = (arg2 ?? arg1) as { read: (view: EditorView) => unknown; write: (measurement: unknown, view: EditorView) => void } | undefined;
      if (!spec || typeof spec.read !== 'function' || typeof spec.write !== 'function') {
        return originalRequestMeasure(arg1 as never);
      }
      const measurement = spec.read(view);
      spec.write(measurement, view);
      return undefined;
    }) as EditorView['requestMeasure'];

    view.dispatch({ selection: { anchor: 15 } });

    expect(scrollTo).toHaveBeenCalledWith({ top: 10, behavior: 'smooth' });
    view.destroy();
  });

  it('skips scrolling when coords are unavailable', () => {
    const container = document.createElement('div');
    const state = EditorState.create({
      doc: 'Line one\nLine two\nLine three',
      extensions: [typewriterExtension],
    });
    const view = new EditorView({ state, parent: container });

    const scrollTo = vi.fn();
    view.scrollDOM.scrollTo = scrollTo;

    view.coordsAtPos = () => null;
    const originalRequestMeasure = view.requestMeasure.bind(view);
    view.requestMeasure = ((arg1: unknown, arg2?: unknown) => {
      const spec = (arg2 ?? arg1) as { read: (view: EditorView) => unknown; write: (measurement: unknown, view: EditorView) => void } | undefined;
      if (!spec || typeof spec.read !== 'function' || typeof spec.write !== 'function') {
        return originalRequestMeasure(arg1 as never);
      }
      const measurement = spec.read(view);
      spec.write(measurement, view);
      return undefined;
    }) as EditorView['requestMeasure'];

    view.dispatch({ selection: { anchor: 15 } });

    expect(scrollTo).not.toHaveBeenCalled();
    view.destroy();
  });
});
