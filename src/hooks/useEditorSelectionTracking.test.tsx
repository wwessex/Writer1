/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { useEditorSelectionTracking } from './useEditorSelectionTracking';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type EventName = 'selectionUpdate' | 'blur';

function createEditor(empty = true) {
  const listeners: Record<EventName, Set<() => void>> = {
    selectionUpdate: new Set(),
    blur: new Set(),
  };

  return {
    state: { selection: { empty } },
    on: vi.fn((event: EventName, callback: () => void) => listeners[event].add(callback)),
    off: vi.fn((event: EventName, callback: () => void) => listeners[event].delete(callback)),
    emit: (event: EventName) => listeners[event].forEach(cb => cb()),
  };
}

function mount(editor: ReturnType<typeof createEditor> | null) {
  const container = document.createElement('div');
  const root = createRoot(container);

  function Test({ targetEditor }: { targetEditor: ReturnType<typeof createEditor> | null }) {
    const hasSelection = useEditorSelectionTracking(targetEditor);
    return <span data-selection={String(hasSelection)} />;
  }

  act(() => {
    root.render(<Test targetEditor={editor} />);
  });

  return {
    readSelection: () => container.querySelector('span')?.getAttribute('data-selection'),
    unmount: () => act(() => root.unmount()),
  };
}

describe('useEditorSelectionTracking', () => {
  it('registers listeners and responds to selection and blur events', () => {
    const editor = createEditor(true);
    const harness = mount(editor);

    expect(editor.on).toHaveBeenCalledTimes(2);
    expect(harness.readSelection()).toBe('false');

    act(() => {
      editor.state.selection.empty = false;
      editor.emit('selectionUpdate');
    });

    expect(harness.readSelection()).toBe('true');

    act(() => {
      editor.emit('blur');
    });

    expect(harness.readSelection()).toBe('false');

    harness.unmount();
    expect(editor.off).toHaveBeenCalledTimes(2);
  });

  it('resets selection state when editor is missing', () => {
    const harness = mount(null);
    expect(harness.readSelection()).toBe('false');
    harness.unmount();
  });
});
