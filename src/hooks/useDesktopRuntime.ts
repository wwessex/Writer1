import { useEffect, useMemo } from 'react';
import { importDhproj } from '@/lib/storage';
import { buildNativeMenuTemplate, buildReactiveCommandState, getCurrentPlatform, type MenuStateSnapshot } from '@/lib/nativeMenuAdapter';
import type { CommandId } from '@/lib/commands';

interface TauriRuntime {
  invoke: <T = unknown>(command: string, payload?: Record<string, unknown>) => Promise<T>;
  event: {
    listen: <T>(eventName: string, handler: (event: { payload: T }) => void | Promise<void>) => Promise<() => void>;
  };
}

interface UseDesktopRuntimeParams {
  hasUnsavedEdits: boolean;
  onDeepLink: (url: string) => void;
  onMenuAction: (action: CommandId) => void;
  menuState: MenuStateSnapshot;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;
}

const getTauriRuntime = (): TauriRuntime | null => {
  const runtime = (window as Window & { __TAURI__?: TauriRuntime }).__TAURI__;
  return runtime ?? null;
};

export function useDesktopRuntime({ hasUnsavedEdits, onDeepLink, onMenuAction, menuState, showToast }: UseDesktopRuntimeParams) {
  const platform = useMemo(() => getCurrentPlatform(), []);

  useEffect(() => {
    const runtime = getTauriRuntime();
    if (!runtime) return;

    void runtime.invoke('set_unsaved_edits', { value: hasUnsavedEdits });
  }, [hasUnsavedEdits]);

  useEffect(() => {
    const runtime = getTauriRuntime();
    if (!runtime) return;

    void runtime.invoke('set_native_menu', {
      menu: buildNativeMenuTemplate(platform, menuState),
      platform,
    });
  }, [menuState, platform]);

  useEffect(() => {
    const runtime = getTauriRuntime();
    if (!runtime) return;

    void runtime.invoke('set_native_menu_command_state', {
      commandStates: buildReactiveCommandState(menuState),
    });
  }, [menuState]);

  useEffect(() => {
    const runtime = getTauriRuntime();
    if (!runtime) return;

    let unlistenProject: (() => void) | undefined;
    let unlistenDeepLink: (() => void) | undefined;
    let unlistenConfirmQuit: (() => void) | undefined;
    let unlistenMenuAction: (() => void) | undefined;

    const setup = async () => {
      unlistenProject = await runtime.event.listen<string>('desktop://open-project', async (event: { payload: string }) => {
        try {
          const fileContent = await runtime.invoke<string>('read_text_file', { path: event.payload });
          const projectFile = new File([fileContent], 'opened.dhproj', { type: 'application/json' });
          await importDhproj(projectFile);
          showToast('Opened desktop project file. Reloading…', 'success');
          setTimeout(() => window.location.reload(), 600);
        } catch (error) {
          console.error('Failed to open desktop .dhproj:', error);
          showToast('Unable to open .dhproj file from desktop launcher.', 'error');
        }
      });

      unlistenDeepLink = await runtime.event.listen<string>('desktop://deep-link', (event: { payload: string }) => {
        onDeepLink(event.payload);
      });

      unlistenConfirmQuit = await runtime.event.listen('desktop://confirm-quit', async () => {
        const shouldQuit = window.confirm('You have unsaved edits. Quit DraftHarbour Studio anyway?');
        if (shouldQuit) {
          await runtime.invoke('quit_app');
        }
      });

      unlistenMenuAction = await runtime.event.listen<CommandId>('desktop://menu-command', (event: { payload: CommandId }) => {
        onMenuAction(event.payload);
      });
    };

    void setup();

    return () => {
      unlistenProject?.();
      unlistenDeepLink?.();
      unlistenConfirmQuit?.();
      unlistenMenuAction?.();
    };
  }, [onDeepLink, onMenuAction, showToast]);
}
