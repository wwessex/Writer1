import { useEffect } from 'react';

export function useFocusModeClass(focusMode: boolean) {
  useEffect(() => {
    document.body.classList.toggle('focus-mode', focusMode);

    return () => {
      document.body.classList.remove('focus-mode');
    };
  }, [focusMode]);
}
