/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useFindReplace, type FindReplaceControls } from './useFindReplace';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createEditorMock() {
  return {
    getSelection: vi.fn(() => ({ from: 0, to: 0, empty: true })),
    getSelectedText: vi.fn(() => ''),
    findMatches: vi.fn(() => [{ from: 0, to: 5 }, { from: 10, to: 15 }]),
    highlightMatches: vi.fn(),
    clearHighlights: vi.fn(),
    scrollToPosition: vi.fn(),
    replaceRange: vi.fn(),
    replaceAll: vi.fn(() => 2),
    focus: vi.fn(),
  };
}

function mount(editor: ReturnType<typeof createEditorMock> | null) {
  const container = document.createElement('div');
  const root = createRoot(container);
  let controls: FindReplaceControls | null = null;

  function Test({ e }: { e: ReturnType<typeof createEditorMock> | null }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    controls = useFindReplace(e as any);
    return null;
  }

  act(() => { root.render(<Test e={editor} />); });

  return {
    get controls() { return controls!; },
    unmount: () => act(() => root.unmount()),
    rerender: (e: ReturnType<typeof createEditorMock> | null) => {
      act(() => { root.render(<Test e={e} />); });
    },
  };
}

describe('useFindReplace', () => {
  let editor: ReturnType<typeof createEditorMock>;

  beforeEach(() => {
    editor = createEditorMock();
  });

  it('starts closed with empty state', () => {
    const h = mount(editor);
    expect(h.controls.isOpen).toBe(false);
    expect(h.controls.searchTerm).toBe('');
    expect(h.controls.totalMatches).toBe(0);
    h.unmount();
  });

  it('open sets isOpen to true', () => {
    const h = mount(editor);
    act(() => h.controls.open());
    expect(h.controls.isOpen).toBe(true);
    h.unmount();
  });

  it('open with replace shows replace', () => {
    const h = mount(editor);
    act(() => h.controls.open(true));
    expect(h.controls.showReplace).toBe(true);
    h.unmount();
  });

  it('close resets state and focuses editor', () => {
    const h = mount(editor);
    act(() => h.controls.open());
    act(() => h.controls.close());
    expect(h.controls.isOpen).toBe(false);
    expect(editor.clearHighlights).toHaveBeenCalled();
    expect(editor.focus).toHaveBeenCalled();
    h.unmount();
  });

  it('setSearchTerm triggers search', () => {
    const h = mount(editor);
    act(() => h.controls.setSearchTerm('hello'));
    expect(h.controls.searchTerm).toBe('hello');
    expect(editor.findMatches).toHaveBeenCalled();
    expect(h.controls.totalMatches).toBe(2);
    h.unmount();
  });

  it('setReplaceTerm updates replace term', () => {
    const h = mount(editor);
    act(() => h.controls.setReplaceTerm('world'));
    expect(h.controls.replaceTerm).toBe('world');
    h.unmount();
  });

  it('findNext advances currentIndex', () => {
    const h = mount(editor);
    act(() => h.controls.setSearchTerm('hello'));
    act(() => h.controls.findNext());
    expect(h.controls.currentIndex).toBe(1);
    expect(editor.scrollToPosition).toHaveBeenCalled();
    h.unmount();
  });

  it('findPrev decrements currentIndex with wrapping', () => {
    const h = mount(editor);
    act(() => h.controls.setSearchTerm('hello'));
    act(() => h.controls.findPrev());
    expect(h.controls.currentIndex).toBe(1); // wraps from 0 to last
    h.unmount();
  });

  it('replaceCurrent replaces and re-searches', () => {
    const h = mount(editor);
    act(() => h.controls.setSearchTerm('hello'));
    act(() => h.controls.setReplaceTerm('world'));
    act(() => h.controls.replaceCurrent());
    expect(editor.replaceRange).toHaveBeenCalledWith(0, 5, 'world');
    h.unmount();
  });

  it('replaceAll replaces all matches', () => {
    const h = mount(editor);
    act(() => h.controls.setSearchTerm('hello'));
    act(() => h.controls.setReplaceTerm('world'));
    act(() => h.controls.replaceAll());
    expect(editor.replaceAll).toHaveBeenCalled();
    expect(h.controls.totalMatches).toBe(0);
    h.unmount();
  });

  it('toggleCaseSensitive toggles and re-searches', () => {
    const h = mount(editor);
    act(() => h.controls.setSearchTerm('hello'));
    expect(h.controls.caseSensitive).toBe(false);
    act(() => h.controls.toggleCaseSensitive());
    expect(h.controls.caseSensitive).toBe(true);
    h.unmount();
  });

  it('toggleWholeWord toggles and re-searches', () => {
    const h = mount(editor);
    act(() => h.controls.setSearchTerm('hello'));
    expect(h.controls.wholeWord).toBe(false);
    act(() => h.controls.toggleWholeWord());
    expect(h.controls.wholeWord).toBe(true);
    h.unmount();
  });

  it('open pre-fills search with selected text', () => {
    editor.getSelection.mockReturnValue({ from: 0, to: 5, empty: false });
    editor.getSelectedText.mockReturnValue('Hello');
    const h = mount(editor);
    act(() => h.controls.open());
    expect(h.controls.searchTerm).toBe('Hello');
    h.unmount();
  });

  it('handles null editor gracefully', () => {
    const h = mount(null);
    expect(h.controls.isOpen).toBe(false);
    act(() => h.controls.open());
    act(() => h.controls.setSearchTerm('test'));
    act(() => h.controls.findNext());
    act(() => h.controls.close());
    h.unmount();
  });

  it('clears state when editor changes', () => {
    const h = mount(editor);
    act(() => h.controls.setSearchTerm('hello'));
    expect(h.controls.totalMatches).toBe(2);
    h.rerender(null);
    expect(h.controls.totalMatches).toBe(0);
    h.unmount();
  });
});
