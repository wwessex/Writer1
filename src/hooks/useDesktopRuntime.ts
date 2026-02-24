import { useEffect } from 'react';
import { importDhproj } from '@/lib/storage';

interface UseDesktopRuntimeParams {
  hasUnsavedEdits: boolean;
  onDeepLink: (url: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', icon?: string) => void;
}

const isDesktopRuntime = () => '__TAURI_INTERNALS__' in window;

export function useDesktopRuntime({ hasUnsavedEdits, onDeepLink, showToast }: UseDesktopRuntimeParams) {
  useEffect(() => {
    if (!isDesktopRuntime()) return;

    const updateDirtyFlag = async () => {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_unsaved_edits', { value: hasUnsavedEdits });
    };

    void updateDirtyFlag();
  }, [hasUnsavedEdits]);

  useEffect(() => {
    if (!isDesktopRuntime()) return;

    let unlistenProject: (() => void) | undefined;
    let unlistenDeepLink: (() => void) | undefined;
    let unlistenConfirmQuit: (() => void) | undefined;

    const setup = async () => {
      const [{ invoke }, { listen }] = await Promise.all([
        import('@tauri-apps/api/core'),
        import('@tauri-apps/api/event')
      ]);

      unlistenProject = await listen<string>('desktop://open-project', async (event) => {
        try {
          const fileContent = await invoke<string>('read_text_file', { path: event.payload });
          const projectFile = new File([fileContent], 'opened.dhproj', { type: 'application/json' });
          await importDhproj(projectFile);
          showToast('Opened desktop project file. Reloading…', 'success');
          setTimeout(() => window.location.reload(), 600);
        } catch (error) {
          console.error('Failed to open desktop .dhproj:', error);
          showToast('Unable to open .dhproj file from desktop launcher.', 'error');
        }
      });

      unlistenDeepLink = await listen<string>('desktop://deep-link', (event) => {
        onDeepLink(event.payload);
      });

      unlistenConfirmQuit = await listen('desktop://confirm-quit', async () => {
        const shouldQuit = window.confirm('You have unsaved edits. Quit DraftHarbour Studio anyway?');
        if (shouldQuit) {
          await invoke('quit_app');
        }
      });
    };

    void setup();

    return () => {
      unlistenProject?.();
      unlistenDeepLink?.();
      unlistenConfirmQuit?.();
    };
  }, [onDeepLink, showToast]);
}
