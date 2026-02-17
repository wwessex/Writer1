import { describe, expect, it } from 'vitest';
import { createSettingsEnvelope, loadSettingsFromStorage } from '@/lib/settingsMigration';
import { createDefaultSettings, mergeSettings, normalizeSidebarPanels } from './appSettings';

describe('AppContext settings behavior', () => {
  it('falls back to defaults for malformed localStorage payloads', () => {
    const defaults = createDefaultSettings(false);

    expect(loadSettingsFromStorage('{invalid-json', defaults)).toEqual(defaults);
    expect(loadSettingsFromStorage(JSON.stringify({ version: 999, data: {} }), defaults)).toEqual(defaults);
  });

  it('normalizes sidebar panel order and flags per project type', () => {
    const normalizedBook = normalizeSidebarPanels(
      {
        order: ['scenePlanner', 'scenePlanner', 'outline'],
        collapsed: { chapters: true },
      },
      'book'
    );

    expect(normalizedBook.order).toEqual(['scenePlanner', 'outline', 'chapters']);
    expect(normalizedBook.collapsed).toEqual({ chapters: true, scenePlanner: false, outline: false });
    expect(normalizedBook.visible).toEqual({ chapters: true, scenePlanner: true, outline: true });

    const normalizedScreenplay = normalizeSidebarPanels(
      { order: ['outline'] },
      'screenplay'
    );

    expect(normalizedScreenplay.order).toEqual(['outline', 'chapters', 'scenePlanner']);
  });

  it('preserves nested settings through update and persistence cycle', () => {
    const defaults = createDefaultSettings(false);
    const updated = mergeSettings(defaults, {
      typography: { fontSize: 20 },
      assist: { languageToolEnabled: true },
      sidebarPanels: { collapsed: { outline: true } }
    });

    const persisted = JSON.stringify(createSettingsEnvelope(updated));
    const reloaded = loadSettingsFromStorage(persisted, defaults);

    expect(reloaded.typography).toEqual({
      fontFamily: defaults.typography.fontFamily,
      fontSize: 20,
      lineHeight: defaults.typography.lineHeight
    });
    expect(reloaded.assist.languageToolEnabled).toBe(true);
    expect(reloaded.assist.languageToolUrl).toBe(defaults.assist.languageToolUrl);
    expect(reloaded.sidebarPanels.collapsed?.outline).toBe(true);
  });
});
