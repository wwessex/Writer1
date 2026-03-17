import { describe, expect, it, vi, beforeEach } from 'vitest';
import { COMMAND_IDS, COMMAND_HANDLERS, isCommandEnabled, runCommand } from './commands';

function createEditorMock() {
  return {
    isFocused: vi.fn(() => true),
    undo: vi.fn(),
    redo: vi.fn(),
    toggleBold: vi.fn(),
    toggleItalic: vi.fn(),
    toggleUnderline: vi.fn(),
    toggleBlockquote: vi.fn(),
    insertHorizontalRule: vi.fn(),
    insertHeading: vi.fn(),
    setParagraph: vi.fn(),
    selectAll: vi.fn(),
    deleteSelection: vi.fn(),
    focus: vi.fn(),
  };
}

describe('commands', () => {
  beforeEach(() => {
    (document as Document & { execCommand?: (command: string) => boolean }).execCommand = vi.fn(() => true);
  });

  it('applies enablement rules for focus and selection', () => {
    expect(isCommandEnabled(COMMAND_IDS.UNDO, { editorFocused: false, hasSelection: true })).toBe(false);
    expect(isCommandEnabled(COMMAND_IDS.CUT, { editorFocused: true, hasSelection: false })).toBe(false);
    expect(isCommandEnabled(COMMAND_IDS.COPY, { editorFocused: true, hasSelection: true })).toBe(true);
    expect(isCommandEnabled(COMMAND_IDS.NEW_CHAPTER, { editorFocused: false, hasSelection: false })).toBe(true);
  });

  it('runs every registered command handler without throwing', () => {
    const editor = createEditorMock();
    const context = {
      editor,
      fileInputRef: { current: { click: vi.fn() } } as unknown as { current: HTMLInputElement },
      importInputRef: { current: { click: vi.fn() } } as unknown as { current: HTMLInputElement },
      projectFileInputRef: { current: { click: vi.fn() } } as unknown as { current: HTMLInputElement },
      createChapter: vi.fn(),
      handleExportBackup: vi.fn(),
      handleSaveProjectFile: vi.fn(),
      openRecentProjects: vi.fn(),
      reopenLastProject: vi.fn(),
      openModal: vi.fn(),
      toggleModal: vi.fn(),
      toggleInspector: vi.fn(),
      openQuickSwitcher: vi.fn(),
      toggleSidebar: vi.fn(),
      togglePageView: vi.fn(),
      toggleFocusMode: vi.fn(),
      toggleTypewriterMode: vi.fn(),
      setTheme: vi.fn(),
      showToast: vi.fn(),
      createCommentFromSelection: vi.fn(),
    };

    Object.values(COMMAND_IDS).forEach((commandId) => {
      expect(() => runCommand(commandId, context as never)).not.toThrow();
    });

    expect(context.createChapter).toHaveBeenCalledTimes(1);
    expect(context.openModal).toHaveBeenCalled();
    expect(context.toggleModal).toHaveBeenCalled();
    expect(editor.toggleBold).toHaveBeenCalled();
    expect(editor.selectAll).toHaveBeenCalledTimes(1);
    expect((document as Document & { execCommand: ReturnType<typeof vi.fn> }).execCommand).toHaveBeenCalled();
  });

  it('exports handler map for all command ids', () => {
    const definedIds = new Set(Object.values(COMMAND_IDS));
    const handledIds = new Set(Object.keys(COMMAND_HANDLERS));
    for (const id of definedIds) {
      expect(handledIds.has(id), `Missing handler for "${id}"`).toBe(true);
    }
  });
});
