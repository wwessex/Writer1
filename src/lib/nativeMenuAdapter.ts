import { APP_MENUS, type AppMenuConfig } from '@/lib/menuConfig';
import { detectRuntimePlatform } from '@/lib/runtimePlatform';
import { COMMAND_IDS, COMMAND_METADATA, isCommandEnabled, type CommandId } from '@/lib/commands';

export type DesktopPlatform = 'macos' | 'windows' | 'linux';

export interface NativeMenuItemTemplate {
  id?: CommandId;
  label?: string;
  accelerator?: string;
  role?: 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll';
  enabled?: boolean;
  separator?: boolean;
  submenu?: NativeMenuItemTemplate[];
}

export interface NativeMenuTemplate {
  label: string;
  submenu: NativeMenuItemTemplate[];
}

export interface MenuStateSnapshot {
  editorFocused: boolean;
  hasSelection: boolean;
}

const ROLE_BY_COMMAND: Partial<Record<CommandId, NativeMenuItemTemplate['role']>> = {
  [COMMAND_IDS.UNDO]: 'undo',
  [COMMAND_IDS.REDO]: 'redo',
  [COMMAND_IDS.CUT]: 'cut',
  [COMMAND_IDS.COPY]: 'copy',
  [COMMAND_IDS.PASTE]: 'paste',
  [COMMAND_IDS.SELECT_ALL]: 'selectAll',
};

export const getCurrentPlatform = (): DesktopPlatform => detectRuntimePlatform();

const REDO_SHORTCUT_BY_PLATFORM: Record<DesktopPlatform, string> = {
  macos: 'Cmd+Shift+Z',
  windows: 'Ctrl+Y',
  linux: 'Ctrl+Shift+Z',
};

export const normalizeShortcut = (shortcut: string | undefined, platform: DesktopPlatform) => {
  if (!shortcut) return undefined;
  if (shortcut === 'Ctrl+Y') return REDO_SHORTCUT_BY_PLATFORM[platform];
  if (platform === 'macos') {
    return shortcut.replace(/Ctrl/g, 'Cmd');
  }
  return shortcut.replace(/Cmd/g, 'Ctrl');
};

const toNativeSubmenu = (menu: AppMenuConfig, platform: DesktopPlatform, state: MenuStateSnapshot): NativeMenuItemTemplate[] => {
  return menu.items.map(item => {
    if (item.divider) {
      return { separator: true };
    }

    const id = item.action as CommandId;
    const fallbackLabel = id ? COMMAND_METADATA[id].label : item.label;

    return {
      id,
      label: item.label ?? fallbackLabel,
      accelerator: normalizeShortcut(item.shortcut ?? (id ? COMMAND_METADATA[id].shortcut : undefined), platform),
      enabled: id ? isCommandEnabled(id, state) : !(item.disabled ?? false),
      role: id ? ROLE_BY_COMMAND[id] : undefined,
    };
  });
};

export const buildNativeMenuTemplate = (platform: DesktopPlatform, state: MenuStateSnapshot): NativeMenuTemplate[] => {
  return APP_MENUS.map(menu => ({
    label: menu.label,
    submenu: toNativeSubmenu(menu, platform, state),
  }));
};

export const buildReactiveCommandState = (state: MenuStateSnapshot) => {
  const commandIds = Object.values(COMMAND_IDS);
  return commandIds.map(commandId => ({
    commandId,
    enabled: isCommandEnabled(commandId, state),
  }));
};
