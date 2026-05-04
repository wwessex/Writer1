import { useEffect, useMemo } from 'react';
import { importDhproj } from '@/lib/storage';
import { buildNativeMenuTemplate, buildReactiveCommandState, getCurrentPlatform, type MenuStateSnapshot } from '@/lib/nativeMenuAdapter';
import { getTauriRuntime } from '@/lib/tauriRuntime';
import type { CommandId } from '@/lib/commands';

interface UseDesktopRuntimeParams {
  hasUnsavedEdits: boolean;
  onDeepLink: (url: string) => void;
  onMenuAction: (action: CommandId) => void;
  menuState: MenuStateSnapshot;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;
}

export function useDesktopRuntime({ hasUnsavedEdits, onDeepLink, onMenuAction, menuState, showToast }: UseDesktopRuntimeParams) {
  const platform = useMemo(() => getCurrentPlatform(), []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const runtime = await getTauriRuntime();
      if (!runtime || cancelled) return;

      await runtime.invoke('set_unsaved_edits', { value: hasUnsavedEdits });
    })();

    return () => {
      cancelled = true;
    };
  }, [hasUnsavedEdits]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const runtime = await getTauriRuntime();
      if (!runtime || cancelled) return;

      await runtime.invoke('set_native_menu', {
        menu: buildNativeMenuTemplate(platform, menuState),
        platform,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [menuState, platform]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const runtime = await getTauriRuntime();
      if (!runtime || cancelled) return;

      await runtime.invoke('set_native_menu_command_state', {
        commandStates: buildReactiveCommandState(menuState),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [menuState]);

  useEffect(() => {
    let unlistenProject: (() => void) | undefined;
    let unlistenDeepLink: (() => void) | undefined;
    let unlistenConfirmQuit: (() => void) | undefined;
    let unlistenMenuAction: (() => void) | undefined;
    let disposed = false;

    const setup = async () => {
      const runtime = await getTauriRuntime();
      if (!runtime || disposed) return;

      unlistenProject = await runtime.listen<string>('desktop://open-project', async (event: { payload: string }) => {
        try {
          const fileContent = await runtime.invoke<string>('read_project_file', { path: event.payload });
          const projectFile = new File([fileContent], 'opened.dhproj', { type: 'application/json' });
          await importDhproj(projectFile);
          showToast('Opened desktop project file. Reloading…', 'success');
          setTimeout(() => window.location.reload(), 600);
        } catch (error) {
          console.error('Failed to open desktop .dhproj:', error);
          showToast('Unable to open .dhproj file from desktop launcher.', 'error');
        }
      });

      unlistenDeepLink = await runtime.listen<string>('desktop://deep-link', (event: { payload: string }) => {
        onDeepLink(event.payload);
      });

      unlistenConfirmQuit = await runtime.listen('desktop://confirm-quit', async () => {
        const shouldQuit = window.confirm('You have unsaved edits. Quit DraftHarbour Studio anyway?');
        if (shouldQuit) {
          await runtime.invoke('quit_app');
        }
      });

      unlistenMenuAction = await runtime.listen<CommandId>('desktop://menu-command', (event: { payload: CommandId }) => {
        onMenuAction(event.payload);
      });
    };

    void setup();

    return () => {
      disposed = true;
      unlistenProject?.();
      unlistenDeepLink?.();
      unlistenConfirmQuit?.();
      unlistenMenuAction?.();
    };
  }, [onDeepLink, onMenuAction, showToast]);
}
