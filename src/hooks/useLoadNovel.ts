import { useEffect } from 'react';

interface UseLoadNovelOptions {
  loadNovel: () => Promise<void>;
  onLoaded: () => void;
  onError: (error: Error) => void;
}

export function useLoadNovel({ loadNovel, onLoaded, onError }: UseLoadNovelOptions) {
  useEffect(() => {
    let mounted = true;

    loadNovel()
      .then(() => {
        if (mounted) {
          onLoaded();
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          onError(error instanceof Error ? error : new Error('Unknown error'));
        }
      });

    return () => {
      mounted = false;
    };
  }, [loadNovel, onLoaded, onError]);
}
