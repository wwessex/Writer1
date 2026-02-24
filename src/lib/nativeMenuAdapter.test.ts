import { describe, expect, it } from 'vitest';
import { COMMAND_IDS } from '@/lib/commands';
import { buildNativeMenuTemplate, normalizeShortcut } from './nativeMenuAdapter';

describe('nativeMenuAdapter', () => {
  it('normalizes accelerators by platform', () => {
    expect(normalizeShortcut('Ctrl+S', 'macos')).toBe('Cmd+S');
    expect(normalizeShortcut('Ctrl+Y', 'linux')).toBe('Ctrl+Shift+Z');
    expect(normalizeShortcut('Ctrl+Y', 'windows')).toBe('Ctrl+Y');
  });

  it('maps edit actions to native roles and command enablement', () => {
    const menu = buildNativeMenuTemplate('macos', { editorFocused: false, hasSelection: false });
    const editMenu = menu.find(item => item.label === 'Edit');
    expect(editMenu).toBeDefined();

    const undo = editMenu?.submenu.find(item => item.id === COMMAND_IDS.UNDO);
    const cut = editMenu?.submenu.find(item => item.id === COMMAND_IDS.CUT);

    expect(undo?.role).toBe('undo');
    expect(undo?.enabled).toBe(false);
    expect(cut?.role).toBe('cut');
    expect(cut?.enabled).toBe(false);
  });
});
