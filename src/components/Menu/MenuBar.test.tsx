/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { MenuBar } from './MenuBar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/context/AppContext', () => ({
  useApp: () => ({ state: { projectType: 'book' } }),
}));

vi.mock('@/lib/nativeMenuAdapter', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/nativeMenuAdapter')>();
  return {
    ...original,
    getCurrentPlatform: () => 'macos' as const,
  };
});

describe('MenuBar', () => {
  it('disables editor actions when editor is not focused and shows normalized shortcuts', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(<MenuBar onAction={vi.fn()} editorFocused={false} hasSelection={false} />);
    });

    act(() => {
      (Array.from(container.querySelectorAll('button')).find(btn => btn.textContent === 'Edit') as HTMLButtonElement).click();
    });

    const undoButton = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('Undo')) as HTMLButtonElement;
    expect(undoButton.disabled).toBe(true);
    expect(container.textContent).toContain('Cmd+Z');

    act(() => root.unmount());
  });
});
