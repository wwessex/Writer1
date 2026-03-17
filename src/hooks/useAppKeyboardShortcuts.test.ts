/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act, createElement, useRef, useState } from 'react';
import { COMMAND_IDS } from '@/lib/commands';
import { handleKeyboardShortcut, useAppKeyboardShortcuts } from './useAppKeyboardShortcuts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/commands', async () => {
  const actual = await vi.importActual<typeof import('@/lib/commands')>('@/lib/commands');
  return {
    ...actual,
    runCommand: vi.fn(),
  };
});

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

const createContext = (overrides: Record<string, unknown> = {}) => {
  return {
    findReplace: { open: vi.fn() },
    handleMenuAction: vi.fn(),
    toggleQuickSwitcher: vi.fn(),
    focusMode: false,
    ...overrides,
  };
};

describe('handleKeyboardShortcut', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let handleMenuAction: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let findReplaceOpen: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let toggleQuickSwitcher: any;

  beforeEach(() => {
    handleMenuAction = vi.fn();
    findReplaceOpen = vi.fn();
    toggleQuickSwitcher = vi.fn();
  });

  it('opens find on Ctrl+F', () => {
    const event = createEvent({ key: 'f', ctrlKey: true });
    const handled = handleKeyboardShortcut({
      event,
      findReplace: { open: findReplaceOpen },
      handleMenuAction,
      toggleQuickSwitcher,
      focusMode: false,
    });

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(findReplaceOpen).toHaveBeenCalledWith(false);
    expect(handleMenuAction).not.toHaveBeenCalled();
  });

  it('opens find on Meta+F (macOS)', () => {
    const event = createEvent({ key: 'f', metaKey: true });
    const handled = handleKeyboardShortcut({
      event,
      findReplace: { open: findReplaceOpen },
      handleMenuAction,
      toggleQuickSwitcher,
      focusMode: false,
    });

    expect(handled).toBe(true);
    expect(findReplaceOpen).toHaveBeenCalledWith(false);
  });

  it('opens find & replace on Ctrl+H', () => {
    const event = createEvent({ key: 'h', ctrlKey: true });
    const handled = handleKeyboardShortcut({
      event,
      findReplace: { open: findReplaceOpen },
      handleMenuAction,
      toggleQuickSwitcher,
      focusMode: false,
    });

    expect(handled).toBe(true);
    expect(findReplaceOpen).toHaveBeenCalledWith(true);
  });

  it('saves on Ctrl+S', () => {
    const event = createEvent({ key: 's', ctrlKey: true });
    const ctx = createContext({ handleMenuAction });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(true);
    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.SAVE_PROJECT_FILE);
  });

  it('opens file on Ctrl+O', () => {
    const event = createEvent({ key: 'o', ctrlKey: true });
    const ctx = createContext({ handleMenuAction });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(true);
    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.OPEN_PROJECT_FILE);
  });

  it('opens quick switcher on Ctrl+K', () => {
    const event = createEvent({ key: 'k', ctrlKey: true });
    const handled = handleKeyboardShortcut({
      event,
      findReplace: { open: findReplaceOpen },
      handleMenuAction,
      toggleQuickSwitcher,
      focusMode: false,
    });

    expect(handled).toBe(true);
    expect(toggleQuickSwitcher).toHaveBeenCalled();
  });

  it('creates new chapter on Ctrl+Shift+N', () => {
    const event = createEvent({ key: 'n', ctrlKey: true, shiftKey: true });
    const ctx = createContext({ handleMenuAction });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(true);
    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.NEW_CHAPTER);
  });

  it('opens export on Ctrl+Shift+E', () => {
    const event = createEvent({ key: 'e', ctrlKey: true, shiftKey: true });
    const ctx = createContext({ handleMenuAction });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(true);
    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.EXPORT);
  });

  it('toggles sidebar on Ctrl+Shift+B', () => {
    const event = createEvent({ key: 'b', ctrlKey: true, shiftKey: true });
    const ctx = createContext({ handleMenuAction });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(true);
    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.TOGGLE_SIDEBAR);
  });

  it('toggles focus mode on Ctrl+Shift+F', () => {
    const event = createEvent({ key: 'f', ctrlKey: true, shiftKey: true });
    const ctx = createContext({ handleMenuAction });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(true);
    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.TOGGLE_FOCUS_MODE);
  });

  it('toggles inspector on Ctrl+Shift+I', () => {
    const event = createEvent({ key: 'i', ctrlKey: true, shiftKey: true });
    const ctx = createContext({ handleMenuAction });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(true);
    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.INSPECTOR);
  });

  it('routes Shift+Ctrl+M to add comment command', () => {
    const event = createEvent({ key: 'm', ctrlKey: true, shiftKey: true });
    const ctx = createContext({ handleMenuAction });
    handleKeyboardShortcut({ ...ctx, event });

    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.ADD_COMMENT);
  });

  it('toggles typewriter mode on Ctrl+Shift+T', () => {
    const event = createEvent({ key: 't', ctrlKey: true, shiftKey: true });
    const ctx = createContext({ handleMenuAction });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(true);
    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.TOGGLE_TYPEWRITER_MODE);
  });

  it('toggles focus mode on Escape when focus mode is active', () => {
    const event = createEvent({ key: 'Escape' });
    const ctx = createContext({ handleMenuAction, focusMode: true });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(true);
    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.TOGGLE_FOCUS_MODE);
  });

  it('does not handle Escape when focus mode is inactive', () => {
    const event = createEvent({ key: 'Escape' });
    const ctx = createContext({ handleMenuAction, focusMode: false });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(false);
    expect(handleMenuAction).not.toHaveBeenCalled();
  });

  it('returns false for unrecognized key combinations', () => {
    const event = createEvent({ key: 'a', ctrlKey: true });
    const ctx = createContext({ handleMenuAction });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(false);
  });

  it('returns false for plain letter keys', () => {
    const event = createEvent({ key: 'f' });
    const ctx = createContext({ handleMenuAction });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(false);
  });

  it('handles uppercase key values', () => {
    const event = createEvent({ key: 'F', ctrlKey: true });
    const handled = handleKeyboardShortcut({
      event,
      findReplace: { open: findReplaceOpen },
      handleMenuAction,
      toggleQuickSwitcher,
      focusMode: false,
    });

    expect(handled).toBe(true);
    expect(findReplaceOpen).toHaveBeenCalledWith(false);
  });

  it('does not handle Ctrl+Shift with unrecognized key', () => {
    const event = createEvent({ key: 'z', ctrlKey: true, shiftKey: true });
    const ctx = createContext({ handleMenuAction });
    const handled = handleKeyboardShortcut({ ...ctx, event });

    expect(handled).toBe(false);
    expect(handleMenuAction).not.toHaveBeenCalled();
  });

  it('does not trigger find when shift is also held', () => {
    // Ctrl+Shift+F should trigger focus mode, not find
    const event = createEvent({ key: 'f', ctrlKey: true, shiftKey: true });
    const ctx = createContext({ handleMenuAction, findReplace: { open: findReplaceOpen } });
    handleKeyboardShortcut({ ...ctx, event });

    expect(findReplaceOpen).not.toHaveBeenCalled();
    expect(handleMenuAction).toHaveBeenCalledWith(COMMAND_IDS.TOGGLE_FOCUS_MODE);
  });
});

describe('useAppKeyboardShortcuts hook', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  function TestComponent() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);
    const projectFileInputRef = useRef<HTMLInputElement>(null);
    const [, setInspectorOpen] = useState(false);
    const [, setQuickSwitcherOpen] = useState(false);

    const { handleMenuAction } = useAppKeyboardShortcuts({
      editor: null,
      findReplace: { open: vi.fn(), close: vi.fn(), isOpen: false, query: '', setQuery: vi.fn(), replaceText: '', setReplaceText: vi.fn(), matchCount: 0, currentMatch: 0, findNext: vi.fn(), findPrev: vi.fn(), replaceOne: vi.fn(), replaceAll: vi.fn(), caseSensitive: false, setCaseSensitive: vi.fn(), wholeWord: false, setWholeWord: vi.fn(), useRegex: false, setUseRegex: vi.fn() } as never,
      fileInputRef,
      importInputRef,
      projectFileInputRef,
      createChapter: vi.fn(),
      handleExportBackup: vi.fn(),
      handleSaveProjectFile: vi.fn(),
      openModal: vi.fn(),
      toggleModal: vi.fn(),
      dispatch: vi.fn(),
      updateSettings: vi.fn(),
      settings: { focusMode: false, typewriterMode: false } as never,
      showToast: vi.fn(),
      createCommentFromSelection: vi.fn(),
      setInspectorOpen,
      setQuickSwitcherOpen,
      openRecentProjects: vi.fn(),
      reopenLastProject: vi.fn(),
    });

    return createElement('div', { 'data-testid': 'hook-test', 'data-action': String(typeof handleMenuAction) });
  }

  it('can be rendered without throwing', () => {
    act(() => {
      createRoot(container).render(createElement(TestComponent));
    });
    const el = container.querySelector('[data-testid="hook-test"]');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-action')).toBe('function');
  });

  it('registers keydown event listener on window', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    act(() => {
      createRoot(container).render(createElement(TestComponent));
    });
    const keydownCalls = addSpy.mock.calls.filter(c => c[0] === 'keydown');
    expect(keydownCalls.length).toBeGreaterThan(0);
    addSpy.mockRestore();
  });

  it('registers writer1:add-comment custom event listener', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    act(() => {
      createRoot(container).render(createElement(TestComponent));
    });
    const commentCalls = addSpy.mock.calls.filter(c => c[0] === 'writer1:add-comment');
    expect(commentCalls.length).toBeGreaterThan(0);
    addSpy.mockRestore();
  });
});
