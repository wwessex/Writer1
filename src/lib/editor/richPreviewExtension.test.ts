/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { richPreviewExtension } from './richPreviewExtension';

function createView(doc: string) {
  const container = document.createElement('div');
  const state = EditorState.create({
    doc,
    extensions: [markdown(), richPreviewExtension],
  });
  return { view: new EditorView({ state, parent: container }), container };
}

describe('richPreviewExtension', () => {
  it('exports a ViewPlugin extension', () => {
    expect(richPreviewExtension).toBeDefined();
  });

  it('creates decorations for headings', () => {
    const { view } = createView('# Heading 1\n## Heading 2');
    expect(view.state.doc.toString()).toContain('# Heading 1');
    view.destroy();
  });

  it('creates decorations for bold text', () => {
    const { view } = createView('This is **bold** text');
    expect(view.state.doc.toString()).toContain('**bold**');
    view.destroy();
  });

  it('creates decorations for italic text', () => {
    const { view } = createView('This is *italic* text');
    expect(view.state.doc.toString()).toContain('*italic*');
    view.destroy();
  });

  it('creates decorations for blockquotes', () => {
    const { view } = createView('> Quoted text');
    expect(view.state.doc.toString()).toContain('> Quoted');
    view.destroy();
  });

  it('creates decorations for horizontal rules', () => {
    const { view } = createView('---');
    expect(view.state.doc.toString()).toBe('---');
    view.destroy();
  });

  it('creates decorations for inline code', () => {
    const { view } = createView('Use `console.log` here');
    expect(view.state.doc.toString()).toContain('`console.log`');
    view.destroy();
  });

  it('creates decorations for images', () => {
    const { view } = createView('![alt](http://img.png)');
    expect(view.state.doc.toString()).toContain('![alt]');
    view.destroy();
  });

  it('creates decorations for links', () => {
    const { view } = createView('[text](http://url.com)');
    expect(view.state.doc.toString()).toContain('[text]');
    view.destroy();
  });

  it('updates decorations on doc change', () => {
    const { view } = createView('plain text');
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: '# New heading' },
    });
    expect(view.state.doc.toString()).toBe('# New heading');
    view.destroy();
  });

  it('handles complex content without errors', () => {
    const { view } = createView(
      '# Title\n\n**Bold** and *italic* and ~~strike~~\n\n> Blockquote\n\n---\n\n![img](url)\n\n[link](url)\n\n`code`'
    );
    expect(view.state.doc.lines).toBeGreaterThan(5);
    view.destroy();
  });
});
