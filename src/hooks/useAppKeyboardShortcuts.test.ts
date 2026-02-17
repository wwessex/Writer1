import { describe, expect, it, vi } from 'vitest';
import { COMMAND_IDS } from '@/lib/commands';
import { handleKeyboardShortcut } from './useAppKeyboardShortcuts';

const createEvent = (overrides: Partial<KeyboardEvent> & { key: string }) => {
  const preventDefault = vi.fn();
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault,
    ...overrides,
  };
};

describe('handleKeyboardShortcut', () => {
  it('opens find on Ctrl+F', () => {
    const open = vi.fn();
    const handleMenuAction = vi.fn();
    const event = createEvent({ key: 'f', ctrlKey: true });

    const handled = handleKeyboardShortcut({
      event,
      findReplace: { open },
      handleMenuAction,
      toggleQuickSwitcher: vi.fn(),
      focusMode: false,
    });

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith(false);
    expect(handleMenuAction).not.toHaveBeenCalled();
  });

  it('routes Shift+Ctrl+M to add comment command', () => {
    const handleMenuAction = vi.fn();
    const event = createEvent({ key: 'm', ctrlKey: true, shiftKey: true });

    handleKeyboardShortcut({
      event,
      findReplace: { open: vi.fn() },
      handleMenuAction,
      toggleQuickSwitcher: vi.fn(),
      focusMode: false,
    });

    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.ADD_COMMENT);
  });

  it('toggles focus mode on Escape when focus mode is active', () => {
    const handleMenuAction = vi.fn();

    handleKeyboardShortcut({
      event: createEvent({ key: 'Escape' }),
      findReplace: { open: vi.fn() },
      handleMenuAction,
      toggleQuickSwitcher: vi.fn(),
      focusMode: true,
    });

    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.TOGGLE_FOCUS_MODE);
  });
});
