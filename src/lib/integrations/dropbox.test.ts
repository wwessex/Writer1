import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationConfig, Chapter } from '@/types';
import type { ProviderPayload } from './types';

const mockDirectAdapter = vi.hoisted(() => ({
  connect: vi.fn(),
  testConnection: vi.fn(),
  pull: vi.fn(),
  push: vi.fn(),
  listRemoteRevisions: vi.fn(),
}));

vi.mock('./dropboxDirect', () => ({
  dropboxDirectAdapter: {
    type: 'dropbox',
    ...mockDirectAdapter,
  },
}));

import { dropboxAdapter } from './dropbox';

const config: IntegrationConfig = {
  type: 'dropbox',
  enabled: true,
  sessionToken: 'test-token',
  folderId: '/TestFolder',
};

const payload: ProviderPayload = {
  novelId: 'novel-1',
  projectType: 'book',
  chapters: [{ id: 'ch-1', title: 'Chapter 1', body: 'content', order: 1, updatedAt: 100 }],
};

const chapters: Chapter[] = [{
  id: 'ch-1',
  novelId: 'novel-1',
  order: 1,
  title: 'Chapter 1',
  updatedAt: 100,
  content: null,
  summary: '',
  pov: '',
  status: 'draft',
  tags: [],
  wordGoal: 0,
  scenes: [],
}];

describe('dropboxAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDirectAdapter.connect.mockResolvedValue({ message: 'connected', syncedAt: 1 });
    mockDirectAdapter.testConnection.mockResolvedValue({ message: 'ok', syncedAt: 1 });
    mockDirectAdapter.push.mockResolvedValue({ message: 'pushed', syncedAt: 1 });
    mockDirectAdapter.pull.mockResolvedValue({ chapterUpdates: [], remoteRevision: 'rev', conflicts: [] });
    mockDirectAdapter.listRemoteRevisions.mockResolvedValue([]);
  });

  it('has type dropbox', () => {
    expect(dropboxAdapter.type).toBe('dropbox');
  });

  it('delegates connect to direct adapter', async () => {
    const result = await dropboxAdapter.connect(config);
    expect(mockDirectAdapter.connect).toHaveBeenCalledWith(config);
    expect(result.message).toBe('connected');
  });

  it('delegates testConnection to direct adapter', async () => {
    const result = await dropboxAdapter.testConnection(config);
    expect(mockDirectAdapter.testConnection).toHaveBeenCalledWith(config);
    expect(result.message).toBe('ok');
  });

  it('delegates push to direct adapter', async () => {
    const result = await dropboxAdapter.push(config, payload);
    expect(mockDirectAdapter.push).toHaveBeenCalledWith(config, payload);
    expect(result.message).toBe('pushed');
  });

  it('delegates pull to direct adapter', async () => {
    const result = await dropboxAdapter.pull(config, payload, chapters);
    expect(mockDirectAdapter.pull).toHaveBeenCalledWith(config, payload, chapters);
    expect(result.remoteRevision).toBe('rev');
  });

  it('delegates listRemoteRevisions to direct adapter', async () => {
    const result = await dropboxAdapter.listRemoteRevisions(config);
    expect(mockDirectAdapter.listRemoteRevisions).toHaveBeenCalledWith(config);
    expect(result).toEqual([]);
  });
});
