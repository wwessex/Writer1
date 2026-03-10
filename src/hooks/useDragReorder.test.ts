/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createElement, useEffect } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useDragReorder } from './useDragReorder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createDragEvent(type: string, data: Record<string, string> = {}, clientY = 0, currentTarget?: HTMLElement): React.DragEvent {
  const store: Record<string, string> = { ...data };
  return {
    preventDefault: vi.fn(),
    dataTransfer: {
      effectAllowed: '',
      dropEffect: '',
      setData: (key: string, value: string) => { store[key] = value; },
      getData: (key: string) => store[key] || '',
    },
    clientY,
    currentTarget: currentTarget || document.createElement('div'),
    type,
  } as unknown as React.DragEvent;
}

describe('useDragReorder', () => {
  let container: HTMLDivElement;
  let root: Root;
  let hookResult: ReturnType<typeof useDragReorder>;

  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const onReorder = vi.fn();

  function TestHarness({ items: harnessItems, trackDropPosition }: { items: { id: string }[]; trackDropPosition?: boolean }) {
    const result = useDragReorder({ items: harnessItems, onReorder, trackDropPosition });
    useEffect(() => { hookResult = result; });
    return null;
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('returns initial drag state', async () => {
    await act(async () => { root.render(createElement(TestHarness, { items })); });
    expect(hookResult.dragState.dragging).toBe(false);
    expect(hookResult.dragState.draggedId).toBeNull();
    expect(hookResult.dragState.dropTargetId).toBeNull();
    expect(hookResult.justMovedId).toBeNull();
  });

  it('handleDragStart sets dragging state', async () => {
    await act(async () => { root.render(createElement(TestHarness, { items })); });
    const e = createDragEvent('dragstart');
    await act(async () => { hookResult.handleDragStart(e, 'a'); });
    expect(hookResult.dragState.dragging).toBe(true);
    expect(hookResult.dragState.draggedId).toBe('a');
    expect(e.dataTransfer.effectAllowed).toBe('move');
  });

  it('handleDragOver sets dropTargetId', async () => {
    await act(async () => { root.render(createElement(TestHarness, { items })); });
    const e = createDragEvent('dragover');
    await act(async () => { hookResult.handleDragOver(e, 'b'); });
    expect(hookResult.dragState.dropTargetId).toBe('b');
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('handleDragOver with trackDropPosition computes above/below', async () => {
    await act(async () => { root.render(createElement(TestHarness, { items, trackDropPosition: true })); });
    const target = document.createElement('div');
    Object.defineProperty(target, 'getBoundingClientRect', {
      value: () => ({ top: 100, height: 40, left: 0, right: 0, bottom: 140, width: 100 }),
    });
    // clientY above midpoint (120) → 'above'
    const eAbove = createDragEvent('dragover', {}, 110, target);
    await act(async () => { hookResult.handleDragOver(eAbove, 'b'); });
    expect(hookResult.dragState.dropPosition).toBe('above');

    // clientY below midpoint → 'below'
    const eBelow = createDragEvent('dragover', {}, 130, target);
    await act(async () => { hookResult.handleDragOver(eBelow, 'b'); });
    expect(hookResult.dragState.dropPosition).toBe('below');
  });

  it('handleDragEnd resets state', async () => {
    await act(async () => { root.render(createElement(TestHarness, { items })); });
    await act(async () => { hookResult.handleDragStart(createDragEvent('dragstart'), 'a'); });
    expect(hookResult.dragState.dragging).toBe(true);
    await act(async () => { hookResult.handleDragEnd(); });
    expect(hookResult.dragState.dragging).toBe(false);
    expect(hookResult.dragState.draggedId).toBeNull();
  });

  it('handleDrop reorders items', async () => {
    await act(async () => { root.render(createElement(TestHarness, { items })); });
    // Drop 'a' onto 'c'
    const e = createDragEvent('drop', { 'text/plain': 'a' });
    await act(async () => { hookResult.handleDrop(e, 'c'); });
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('handleDrop does nothing when dropping on itself', async () => {
    await act(async () => { root.render(createElement(TestHarness, { items })); });
    const e = createDragEvent('drop', { 'text/plain': 'a' });
    await act(async () => { hookResult.handleDrop(e, 'a'); });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('handleDrop with trackDropPosition=below inserts after target', async () => {
    await act(async () => { root.render(createElement(TestHarness, { items, trackDropPosition: true })); });
    // Simulate dragOver to set dropPosition to 'below'
    const target = document.createElement('div');
    Object.defineProperty(target, 'getBoundingClientRect', {
      value: () => ({ top: 100, height: 40, left: 0, right: 0, bottom: 140, width: 100 }),
    });
    const eDragOver = createDragEvent('dragover', {}, 130, target);
    await act(async () => { hookResult.handleDragOver(eDragOver, 'b'); });

    // Drop 'a' onto 'b' with position=below
    const eDrop = createDragEvent('drop', { 'text/plain': 'a' });
    await act(async () => { hookResult.handleDrop(eDrop, 'b'); });
    // 'a' moves after 'b': ['b', 'a', 'c']
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c']);
  });

  it('sets justMovedId temporarily after drop', async () => {
    vi.useFakeTimers();
    await act(async () => { root.render(createElement(TestHarness, { items })); });
    const e = createDragEvent('drop', { 'text/plain': 'a' });
    await act(async () => { hookResult.handleDrop(e, 'c'); });
    expect(hookResult.justMovedId).toBe('a');

    await act(async () => { vi.advanceTimersByTime(300); });
    expect(hookResult.justMovedId).toBeNull();
    vi.useRealTimers();
  });
});
