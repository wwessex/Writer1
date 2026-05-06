import { useEffect, useState } from 'react';
import {
  getSystemPrefersDark,
  resolveThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/appearance';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export function useResolvedTheme(theme: ThemePreference): ResolvedTheme {
  const [prefersDark, setPrefersDark] = useState(getSystemPrefersDark);

  useEffect(() => {
    if (theme !== 'auto' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia(DARK_SCHEME_QUERY);
    setPrefersDark(query.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches);
    };

    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [theme]);

  return resolveThemePreference(theme, prefersDark);
}
