import { describe, expect, it } from 'vitest';
import type { BackupData, LegacyBackupData } from '@/types';
import { mergeImportedIntegrations, mergeImportedSettings, upgradeBackup } from './storage';

describe('storage backup compatibility', () => {
  it('upgrades backup versions and normalizes project type', () => {
    const legacy: LegacyBackupData = {
      novel: { id: 'novel-1', title: 'Legacy', updatedAt: 1 },
      chapters: [],
      exportedAt: 1,
    };

    const upgradedLegacy = upgradeBackup(legacy);
    expect(upgradedLegacy.version).toBe(3);
    expect(upgradedLegacy.projectType).toBe('book');

    const v3WithUnknownType = {
      version: 3,
      projectType: 'weird',
      project: { id: 'novel-2', title: 'Current', projectType: 'weird', updatedAt: 1 },
      sections: [],
      exportedAt: 1,
    } as unknown as BackupData;

    const upgradedV3 = upgradeBackup(v3WithUnknownType);
    expect(upgradedV3.projectType).toBe('book');
    expect(upgradedV3.project.projectType).toBe('book');
  });

  it('imports partial legacy payloads without requiring optional fields', () => {
    const partialLegacy = {
      novel: { id: 'novel-3', title: 'Partial', updatedAt: 1 },
      chapters: [],
    } as unknown as LegacyBackupData;

    const upgraded = upgradeBackup(partialLegacy);
    expect(upgraded.sections).toEqual([]);
    expect(upgraded.snapshots).toBeUndefined();
    expect(typeof upgraded.exportedAt).toBe('number');
  });

  it('merges imported settings and integrations safely with existing local payloads', () => {
    const mergedSettings = mergeImportedSettings('{bad-json', { theme: 'dark', focusMode: true });
    expect(mergedSettings.theme).toBe('dark');
    expect(mergedSettings.focusMode).toBe(true);

    const mergedIntegrations = mergeImportedIntegrations(
      JSON.stringify({
        'google-drive': { type: 'google-drive', enabled: true, connectionId: 'existing' },
        dropbox: { type: 'dropbox', enabled: true, connectionId: 'dropbox-existing' },
      }),
      {
        'google-drive': { type: 'google-drive', enabled: true, providerUserId: 'new-user', accessToken: 'secret' },
        dropbox: { type: 'dropbox', enabled: false },
      }
    );

    expect(mergedIntegrations['google-drive']).toEqual({
      type: 'google-drive',
      enabled: true,
      providerUserId: 'new-user',
    });
    expect(mergedIntegrations.dropbox).toEqual({ type: 'dropbox', enabled: false });
    expect(JSON.stringify(mergedIntegrations)).not.toContain('secret');
  });
});
