/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history } from '@codemirror/commands';
import { CodeMirrorAdapter, findHighlightsField } from './codemirrorAdapter';
import { commentAnchorsField, commentDecorationsField } from './commentExtension';

function createAdapter(doc = 'Hello, world!') {
  const container = document.createElement('div');
  const state = EditorState.create({
    doc,
    extensions: [history(), commentAnchorsField, commentDecorationsField, findHighlightsField],
  });
  const view = new EditorView({ state, parent: container });
  return { adapter: new CodeMirrorAdapter(view), view, container };
}

describe('CodeMirrorAdapter', () => {
  describe('content', () => {
    it('getContent returns document text', () => {
      const { adapter, view } = createAdapter('Test content');
      expect(adapter.getContent()).toBe('Test content');
      view.destroy();
    });

    it('setContent replaces document', () => {
      const { adapter, view } = createAdapter('Old');
      adapter.setContent('New content');
      expect(adapter.getContent()).toBe('New content');
      view.destroy();
    });

    it('getPlainText strips markdown', () => {
      const { adapter, view } = createAdapter('**bold** and *italic*');
      expect(adapter.getPlainText()).toBe('bold and italic');
      view.destroy();
    });
  });

  describe('selection', () => {
    it('getSelection returns cursor position', () => {
      const { adapter, view } = createAdapter('Hello');
      const sel = adapter.getSelection();
      expect(sel.from).toBe(0);
      expect(sel.empty).toBe(true);
      view.destroy();
    });

    it('selectAll selects entire document', () => {
      const { adapter, view } = createAdapter('Hello');
      adapter.selectAll();
      const sel = adapter.getSelection();
      expect(sel.from).toBe(0);
      expect(sel.to).toBe(5);
      expect(sel.empty).toBe(false);
      view.destroy();
    });

    it('getSelectedText returns selected text', () => {
      const { adapter, view } = createAdapter('Hello world');
      adapter.selectAll();
      expect(adapter.getSelectedText()).toBe('Hello world');
      view.destroy();
    });

    it('deleteSelection removes selected text', () => {
      const { adapter, view } = createAdapter('Hello world');
      adapter.selectAll();
      adapter.deleteSelection();
      expect(adapter.getContent()).toBe('');
      view.destroy();
    });

    it('deleteSelection does nothing with empty selection', () => {
      const { adapter, view } = createAdapter('Hello');
      adapter.deleteSelection();
      expect(adapter.getContent()).toBe('Hello');
      view.destroy();
    });
  });

  describe('formatting', () => {
    it('toggleBold wraps selection in **', () => {
      const { adapter, view } = createAdapter('Hello world');
      view.dispatch({ selection: { anchor: 0, head: 5 } });
      adapter.toggleBold();
      expect(adapter.getContent()).toBe('**Hello** world');
      view.destroy();
    });

    it('toggleItalic wraps selection in *', () => {
      const { adapter, view } = createAdapter('Hello world');
      view.dispatch({ selection: { anchor: 0, head: 5 } });
      adapter.toggleItalic();
      expect(adapter.getContent()).toBe('*Hello* world');
      view.destroy();
    });

    it('toggleStrikethrough wraps selection in ~~', () => {
      const { adapter, view } = createAdapter('Hello world');
      view.dispatch({ selection: { anchor: 0, head: 5 } });
      adapter.toggleStrikethrough();
      expect(adapter.getContent()).toBe('~~Hello~~ world');
      view.destroy();
    });

    it('insertHeading adds # prefix', () => {
      const { adapter, view } = createAdapter('Title');
      adapter.insertHeading(1);
      expect(adapter.getContent()).toBe('# Title');
      view.destroy();
    });

    it('insertHeading changes heading level', () => {
      const { adapter, view } = createAdapter('# Title');
      adapter.insertHeading(2);
      expect(adapter.getContent()).toBe('## Title');
      view.destroy();
    });

    it('insertHeading removes heading when same level', () => {
      const { adapter, view } = createAdapter('## Title');
      adapter.insertHeading(2);
      expect(adapter.getContent()).toBe('Title');
      view.destroy();
    });

    it('setParagraph removes heading prefix', () => {
      const { adapter, view } = createAdapter('## Title');
      adapter.setParagraph();
      expect(adapter.getContent()).toBe('Title');
      view.destroy();
    });

    it('setParagraph does nothing on plain text', () => {
      const { adapter, view } = createAdapter('Text');
      adapter.setParagraph();
      expect(adapter.getContent()).toBe('Text');
      view.destroy();
    });

    it('toggleBlockquote adds > prefix', () => {
      const { adapter, view } = createAdapter('Quote text');
      adapter.toggleBlockquote();
      expect(adapter.getContent()).toBe('> Quote text');
      view.destroy();
    });

    it('toggleBlockquote removes > prefix', () => {
      const { adapter, view } = createAdapter('> Quote text');
      adapter.toggleBlockquote();
      expect(adapter.getContent()).toBe('Quote text');
      view.destroy();
    });

    it('toggleBulletList adds - prefix', () => {
      const { adapter, view } = createAdapter('Item');
      adapter.toggleBulletList();
      expect(adapter.getContent()).toBe('- Item');
      view.destroy();
    });

    it('toggleOrderedList adds 1. prefix', () => {
      const { adapter, view } = createAdapter('Item');
      adapter.toggleOrderedList();
      expect(adapter.getContent()).toBe('1. Item');
      view.destroy();
    });

    it('insertHorizontalRule inserts ---', () => {
      const { adapter, view } = createAdapter('Text');
      view.dispatch({ selection: { anchor: 4 } });
      adapter.insertHorizontalRule();
      expect(adapter.getContent()).toContain('---');
      view.destroy();
    });

    it('insertImage inserts markdown image', () => {
      const { adapter, view } = createAdapter('');
      adapter.insertImage('http://example.com/img.png');
      expect(adapter.getContent()).toBe('![](http://example.com/img.png)');
      view.destroy();
    });
  });

  describe('history', () => {
    it('canUndo returns false initially', () => {
      const { adapter, view } = createAdapter('Hello');
      expect(adapter.canUndo()).toBe(false);
      view.destroy();
    });

    it('canRedo returns false initially', () => {
      const { adapter, view } = createAdapter('Hello');
      expect(adapter.canRedo()).toBe(false);
      view.destroy();
    });
  });

  describe('isActive', () => {
    it('detects heading', () => {
      const { adapter, view } = createAdapter('## Heading');
      expect(adapter.isActive('heading')).toBe(true);
      expect(adapter.isActive('heading', { level: 2 })).toBe(true);
      expect(adapter.isActive('heading', { level: 1 })).toBe(false);
      view.destroy();
    });

    it('detects bulletList', () => {
      const { adapter, view } = createAdapter('- Item');
      expect(adapter.isActive('bulletList')).toBe(true);
      view.destroy();
    });

    it('detects orderedList', () => {
      const { adapter, view } = createAdapter('1. Item');
      expect(adapter.isActive('orderedList')).toBe(true);
      view.destroy();
    });

    it('detects blockquote', () => {
      const { adapter, view } = createAdapter('> Quote');
      expect(adapter.isActive('blockquote')).toBe(true);
      view.destroy();
    });

    it('returns false for unknown names', () => {
      const { adapter, view } = createAdapter('Text');
      expect(adapter.isActive('unknown')).toBe(false);
      view.destroy();
    });
  });

  describe('events', () => {
    it('on/off registers and removes listeners', () => {
      const { adapter, view } = createAdapter('Hello');
      const cb = vi.fn();
      adapter.on('update', cb);
      adapter.emitUpdate(true, false, false);
      expect(cb).toHaveBeenCalledTimes(1);

      adapter.off('update', cb);
      adapter.emitUpdate(true, false, false);
      expect(cb).toHaveBeenCalledTimes(1);
      view.destroy();
    });

    it('emitUpdate fires selectionUpdate', () => {
      const { adapter, view } = createAdapter('Hello');
      const cb = vi.fn();
      adapter.on('selectionUpdate', cb);
      adapter.emitUpdate(false, true, false);
      expect(cb).toHaveBeenCalledTimes(1);
      view.destroy();
    });

    it('emitUpdate fires blur when not focused', () => {
      const { adapter, view } = createAdapter('Hello');
      const cb = vi.fn();
      adapter.on('blur', cb);
      adapter.emitUpdate(false, false, true);
      expect(cb).toHaveBeenCalledTimes(1);
      view.destroy();
    });
  });

  describe('find/replace', () => {
    it('findMatches returns empty for empty term', () => {
      const { adapter, view } = createAdapter('Hello world');
      expect(adapter.findMatches('', { caseSensitive: false, wholeWord: false })).toEqual([]);
      view.destroy();
    });

    it('findMatches finds occurrences', () => {
      const { adapter, view } = createAdapter('Hello world hello');
      const matches = adapter.findMatches('hello', { caseSensitive: false, wholeWord: false });
      expect(matches).toHaveLength(2);
      view.destroy();
    });

    it('findMatches respects caseSensitive', () => {
      const { adapter, view } = createAdapter('Hello world hello');
      const matches = adapter.findMatches('Hello', { caseSensitive: true, wholeWord: false });
      expect(matches).toHaveLength(1);
      expect(matches[0].from).toBe(0);
      view.destroy();
    });

    it('findMatches respects wholeWord', () => {
      const { adapter, view } = createAdapter('cat concatenate');
      const matches = adapter.findMatches('cat', { caseSensitive: false, wholeWord: true });
      expect(matches).toHaveLength(1);
      view.destroy();
    });

    it('replaceRange replaces text at position', () => {
      const { adapter, view } = createAdapter('Hello world');
      adapter.replaceRange(0, 5, 'Goodbye');
      expect(adapter.getContent()).toBe('Goodbye world');
      view.destroy();
    });

    it('replaceAll replaces all occurrences', () => {
      const { adapter, view } = createAdapter('foo bar foo');
      const count = adapter.replaceAll('foo', 'baz', { caseSensitive: false, wholeWord: false });
      expect(count).toBe(2);
      expect(adapter.getContent()).toBe('baz bar baz');
      view.destroy();
    });

    it('replaceAll returns 0 for no matches', () => {
      const { adapter, view } = createAdapter('Hello');
      const count = adapter.replaceAll('xyz', 'abc', { caseSensitive: false, wholeWord: false });
      expect(count).toBe(0);
      view.destroy();
    });

    it('highlightMatches dispatches decorations', () => {
      const { adapter, view } = createAdapter('Hello world hello');
      adapter.highlightMatches('hello', { caseSensitive: false, wholeWord: false }, 0);
      // Should not throw
      expect(view.state.field(findHighlightsField)).toBeDefined();
      view.destroy();
    });

    it('clearHighlights removes decorations', () => {
      const { adapter, view } = createAdapter('Hello');
      adapter.clearHighlights();
      expect(view.state.field(findHighlightsField)).toBeDefined();
      view.destroy();
    });

    it('scrollToPosition sets cursor position', () => {
      const { adapter, view } = createAdapter('Hello world');
      adapter.scrollToPosition(5);
      expect(view.state.selection.main.head).toBe(5);
      view.destroy();
    });
  });

  describe('comment anchors', () => {
    it('setCommentAnchor adds anchor', () => {
      const { adapter, view } = createAdapter('Hello, world!');
      adapter.setCommentAnchor('t1', 0, 5, 'open');
      const anchors = adapter.getCommentAnchors();
      expect(anchors).toHaveLength(1);
      expect(anchors[0].threadId).toBe('t1');
      view.destroy();
    });

    it('setCommentAnchorState updates state', () => {
      const { adapter, view } = createAdapter('Hello, world!');
      adapter.setCommentAnchor('t1', 0, 5, 'open');
      adapter.setCommentAnchorState('t1', 'resolved');
      expect(adapter.getCommentAnchors()[0].state).toBe('resolved');
      view.destroy();
    });
  });

  describe('screenplay', () => {
    it('getScreenplayBlockType detects action for plain text', () => {
      const { adapter, view } = createAdapter('Some action text');
      expect(adapter.getScreenplayBlockType()).toBe('action');
      view.destroy();
    });

    it('getScreenplayBlockType detects scene heading', () => {
      const { adapter, view } = createAdapter('INT. OFFICE - DAY');
      expect(adapter.getScreenplayBlockType()).toBe('scene-heading');
      view.destroy();
    });

    it('setScreenplayBlockType changes line to character', () => {
      const { adapter, view } = createAdapter('john');
      adapter.setScreenplayBlockType('character');
      expect(adapter.getContent()).toBe('@JOHN');
      view.destroy();
    });
  });

  describe('dom and lifecycle', () => {
    it('dom returns the view dom element', () => {
      const { adapter, view } = createAdapter('Hi');
      expect(adapter.dom).toBe(view.dom);
      view.destroy();
    });

    it('isFocused returns boolean', () => {
      const { adapter, view } = createAdapter('Hi');
      expect(typeof adapter.isFocused()).toBe('boolean');
      view.destroy();
    });

    it('setLineHeight sets CSS property', () => {
      const { adapter, view } = createAdapter('Hi');
      adapter.setLineHeight('2.0');
      expect(view.dom.style.getPropertyValue('--editor-line-height')).toBe('2.0');
      view.destroy();
    });

    it('destroy cleans up', () => {
      const { adapter } = createAdapter('Hi');
      expect(() => adapter.destroy()).not.toThrow();
    });
  });
});
