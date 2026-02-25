import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chapter, IntegrationConfig } from '@/types';

const {
  emitMock,
  buildPushSyncMetadataMock,
  pushMock,
  pullMock,
  connectMock,
  testConnectionMock,
  listRemoteRevisionsMock,
  safeModeState,
} = vi.hoisted(() => ({
  emitMock: vi.fn(),
  buildPushSyncMetadataMock: vi.fn(),
  pushMock: vi.fn(),
  pullMock: vi.fn(),
  connectMock: vi.fn(),
  testConnectionMock: vi.fn(),
  listRemoteRevisionsMock: vi.fn(),
  safeModeState: { enabled: false },
}));

vi.mock('@/lib/plugins', () => ({
  pluginManager: { emit: emitMock },
}));

vi.mock('@/lib/errors', () => ({
  isSafeModeEnabledForSession: () => safeModeState.enabled,
}));

vi.mock('./sync', () => ({
  buildPushSyncMetadata: buildPushSyncMetadataMock,
}));

vi.mock('./orchestration', () => ({
  mapAppStateToProviderPayload: (appState: { novelId: string; projectType: string; chapters: Chapter[] }) => ({
    novelId: appState.novelId,
    projectType: appState.projectType,
    chapters: appState.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      body: chapter.summary,
      order: chapter.order,
      updatedAt: chapter.updatedAt,
    })),
  }),
}));

vi.mock('./dropbox', () => ({
  dropboxAdapter: {
    type: 'dropbox',
    connect: connectMock,
    testConnection: testConnectionMock,
    pull: pullMock,
    push: pushMock,
    listRemoteRevisions: listRemoteRevisionsMock,
  },
}));

vi.mock('./googleDrive', () => ({
  googleDriveAdapter: {
    type: 'google-drive',
    connect: vi.fn(),
    testConnection: vi.fn(),
    pull: vi.fn(),
    push: vi.fn(),
    listRemoteRevisions: vi.fn(),
  },
}));

vi.mock('./scrivener', () => ({
  scrivenerAdapter: {
    type: 'scrivener',
    connect: vi.fn(),
    testConnection: vi.fn(),
    pull: vi.fn(),
    push: vi.fn(),
    listRemoteRevisions: vi.fn(),
  },
}));

import {
  connectIntegration,
  listIntegrationRevisions,
  pullIntegrationData,
  pushIntegrationData,
  testIntegrationConnection,
} from './service';

function makeChapter(id: string): Chapter {
  return {
    id,
    novelId: 'novel-1',
    order: 1,
    title: `Chapter ${id}`,
    updatedAt: 100,
    content: null,
    summary: `Summary ${id}`,
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 0,
    scenes: [],
  };
}

describe('integration service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    safeModeState.enabled = false;
    pushMock.mockResolvedValue({ message: 'ok', syncedAt: 1234 });
    pullMock.mockResolvedValue({ chapterUpdates: [], remoteRevision: 'rev-2', conflicts: [] });
    connectMock.mockResolvedValue({ message: 'connected', syncedAt: 1 });
    testConnectionMock.mockResolvedValue({ message: 'ok', syncedAt: 1 });
    listRemoteRevisionsMock.mockResolvedValue([{ id: 'rev-1', label: 'Latest', updatedAt: 1 }]);
    buildPushSyncMetadataMock.mockImplementation(async (chapter: Chapter, _provider: string, remoteRevision: string) => ({
      providerRevisionIds: { dropbox: remoteRevision },
      lastPushedHash: `sha256:${chapter.id}`,
      lastSyncedContent: chapter.content,
    }));
  });

  it('awaits metadata generation per chapter before emitting export completion', async () => {
    const appState = {
      novelId: 'novel-1',
      projectType: 'book' as const,
      chapters: [makeChapter('ch-1'), makeChapter('ch-2')],
    };

    const config = {} as IntegrationConfig;
    await pushIntegrationData('dropbox', config, appState);

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(buildPushSyncMetadataMock).toHaveBeenCalledTimes(2);

    const afterEvent = emitMock.mock.calls.find(([event]) => event === 'sync:export:after');
    expect(afterEvent).toBeDefined();
    const payload = afterEvent?.[1] as { chapters: Chapter[]; remoteRevision: string };
    expect(payload.remoteRevision).toBe('push-dropbox-1234');
    expect(payload.chapters[0].sync?.lastPushedHash).toBe('sha256:ch-1');
    expect(payload.chapters[1].sync?.lastPushedHash).toBe('sha256:ch-2');
  });

  it('delegates connect/test/pull/list operations to the adapter', async () => {
    const config = {} as IntegrationConfig;
    const appState = { novelId: 'novel-1', projectType: 'book' as const, chapters: [makeChapter('ch-1')] };

    await connectIntegration('dropbox', config);
    await testIntegrationConnection('dropbox', config);
    await pullIntegrationData('dropbox', config, appState);
    await listIntegrationRevisions('dropbox', config);

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(testConnectionMock).toHaveBeenCalledTimes(1);
    expect(pullMock).toHaveBeenCalledTimes(1);
    expect(listRemoteRevisionsMock).toHaveBeenCalledTimes(1);
  });

  it('throws when integrations are invoked in safe mode', async () => {
    safeModeState.enabled = true;
    const config = {} as IntegrationConfig;

    await expect(connectIntegration('dropbox', config)).rejects.toThrow('Integrations are disabled in Safe Mode.');
  });
});
