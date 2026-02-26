import { useEffect, useRef } from 'react';

interface UseLoadNovelOptions {
  loadNovel: () => Promise<void>;
  onLoaded: () => void;
  onError: (error: Error) => void;
}

export function useLoadNovel({ loadNovel, onLoaded, onError }: UseLoadNovelOptions) {
  const loadNovelRef = useRef(loadNovel);
  const onLoadedRef = useRef(onLoaded);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    loadNovelRef.current = loadNovel;
    onLoadedRef.current = onLoaded;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let mounted = true;

    loadNovelRef.current()
      .then(() => {
        if (mounted) {
          onLoadedRef.current();
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          onErrorRef.current(error instanceof Error ? error : new Error('Unknown error'));
        }
      });

    return () => {
      mounted = false;
    };
  }, []);
}
