import { describe, expect, it } from 'vitest';
import {
  adapterRegistry,
  scrivenerAdapter,
  googleDocsAdapter,
  dropboxAdapter,
} from './adapters';

describe('adapters', () => {
  it('registry has 3 built-in adapters', () => {
    expect(adapterRegistry.getAll()).toHaveLength(3);
  });

  it('can look up adapters by id', () => {
    expect(adapterRegistry.get('scrivener')).toBe(scrivenerAdapter);
    expect(adapterRegistry.get('google-docs')).toBe(googleDocsAdapter);
    expect(adapterRegistry.get('dropbox')).toBe(dropboxAdapter);
  });

  it('getByCapability filters by canSync', () => {
    const syncable = adapterRegistry.getByCapability('canSync');
    expect(syncable).toHaveLength(2);
    expect(syncable.map(a => a.metadata.id)).toContain('google-docs');
    expect(syncable.map(a => a.metadata.id)).toContain('dropbox');
  });

  it('register and unregister work', () => {
    const count = adapterRegistry.getAll().length;
    const mockAdapter = {
      metadata: {
        id: 'test',
        name: 'Test',
        description: 'Test adapter',
        icon: 'test',
        version: '1.0.0',
        capabilities: { canImport: false, canExport: false, canSync: false, supportedFormats: [], requiresAuth: false },
      },
      testConnection: async () => ({ ok: true, message: 'ok' }),
      importContent: async () => ({ chapters: [], warnings: [] }),
      exportContent: async () => ({ success: false, message: 'no' }),
    };
    adapterRegistry.register(mockAdapter);
    expect(adapterRegistry.getAll()).toHaveLength(count + 1);
    adapterRegistry.unregister('test');
    expect(adapterRegistry.getAll()).toHaveLength(count);
  });

  it('scrivener testConnection returns ok', async () => {
    const result = await scrivenerAdapter.testConnection();
    expect(result.ok).toBe(true);
  });

  it('scrivener exportContent produces blob', async () => {
    const chapters = [{ id: '1', novelId: 'n1', order: 0, title: 'Ch 1', content: 'Hello world', updatedAt: 0, summary: '', pov: '', status: 'draft' as const, tags: [], wordGoal: 0, scenes: [] }];
    const result = await scrivenerAdapter.exportContent(chapters, 'Test', 'book');
    expect(result.success).toBe(true);
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('googleDocs testConnection returns not ok', async () => {
    const result = await googleDocsAdapter.testConnection();
    expect(result.ok).toBe(false);
  });

  it('dropbox sync returns zero counts', async () => {
    const result = await dropboxAdapter.sync!([], 'n1', {});
    expect(result.pulled).toBe(0);
  });
});
