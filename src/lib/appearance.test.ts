import { describe, expect, it } from 'vitest';
import { normalizeThemePreference, resolveThemePreference } from './appearance';

describe('appearance', () => {
  it('normalizes current and legacy theme preferences', () => {
    expect(normalizeThemePreference('auto')).toBe('auto');
    expect(normalizeThemePreference('light')).toBe('light');
    expect(normalizeThemePreference('dark')).toBe('dark');
    expect(normalizeThemePreference('high-contrast')).toBe('dark');
    expect(normalizeThemePreference('system')).toBe('light');
  });

  it('resolves auto from system color-scheme preference', () => {
    expect(resolveThemePreference('auto', true)).toBe('dark');
    expect(resolveThemePreference('auto', false)).toBe('light');
    expect(resolveThemePreference('light', true)).toBe('light');
    expect(resolveThemePreference('dark', false)).toBe('dark');
  });
});
