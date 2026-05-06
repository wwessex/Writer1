import type { AppSettings } from '@/types';

export type ThemePreference = AppSettings['theme'];
export type ResolvedTheme = Exclude<ThemePreference, 'auto'>;

export const normalizeThemePreference = (
  value: unknown,
  fallback: ThemePreference = 'light'
): ThemePreference => {
  if (value === 'auto' || value === 'light' || value === 'dark') {
    return value;
  }

  if (value === 'high-contrast') {
    return 'dark';
  }

  return fallback;
};

export const resolveThemePreference = (
  theme: ThemePreference,
  prefersDark: boolean
): ResolvedTheme => theme === 'auto'
  ? (prefersDark ? 'dark' : 'light')
  : theme;

export const getSystemPrefersDark = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};
