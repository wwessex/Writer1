import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleBrokerRequest } from './integrationBroker';

describe('integration broker contract envelopes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('returns success envelope for integration connect', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));

    const response = await handleBrokerRequest({
      method: 'POST',
      path: '/api/integrations/google-drive/connect',
      body: { config: { sessionToken: 'token' } },
    });

    expect(response?.status).toBe(200);
    expect(response?.body).toMatchObject({ ok: true });
    const body = response?.body as { ok: true; data: { message: string } };
    expect(body.data.message).toContain('Connected to Google Drive');
  });

  it('returns auth failure envelope for missing session token', async () => {
    const response = await handleBrokerRequest({
      method: 'POST',
      path: '/api/integrations/dropbox/connect',
      body: { config: {} },
    });

    expect(response?.status).toBe(401);
    expect(response?.body).toMatchObject({
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        status: 401,
      },
    });
  });

  it('returns rate-limit envelope when provider responds 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 429 }));

    const response = await handleBrokerRequest({
      method: 'POST',
      path: '/api/integrations/dropbox/connect',
      body: { config: { sessionToken: 'token' } },
    });

    expect(response?.status).toBe(429);
    expect(response?.body).toMatchObject({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        retryable: true,
      },
    });
  });

  it('pushes chapters to Google Drive via broker', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      // Call 1: find folder, Call 2+: find file (upsert check) + upload/create
      if (callCount === 1) return new Response(JSON.stringify({ files: [{ id: 'folder-1', name: 'DraftHarbour' }] }), { status: 200 });
      // For find file calls, return empty (new file)
      if (callCount % 2 === 0) return new Response(JSON.stringify({ files: [] }), { status: 200 });
      // For create calls, return success
      return new Response(JSON.stringify({ id: 'new-file', name: 'ch-1.json' }), { status: 200 });
    });

    const response = await handleBrokerRequest({
      method: 'POST',
      path: '/api/integrations/google-drive/push',
      body: {
        config: { sessionToken: 'token' },
        payload: {
          novelId: 'novel-1',
          projectType: 'book',
          chapters: [{ id: 'ch-1', title: 'Chapter 1', body: 'Hello', order: 0, updatedAt: 1000 }],
        },
      },
    });

    expect(response?.status).toBe(200);
    expect(response?.body).toMatchObject({ ok: true });
    const body = response?.body as { ok: true; data: { message: string } };
    expect(body.data.message).toContain('Pushed 1 chapter(s) to Google Drive');
  });

  it('pulls chapters from Google Drive via broker', async () => {
    const chapterDoc = { id: 'ch-1', title: 'Chapter 1', body: 'Remote content', order: 0, updatedAt: 2000 };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      // Call 1: find folder, Call 2: list files, Call 3: download chapter
      if (callCount === 1) return new Response(JSON.stringify({ files: [{ id: 'folder-1', name: 'DraftHarbour' }] }), { status: 200 });
      if (callCount === 2) return new Response(JSON.stringify({ files: [{ id: 'file-1', name: 'ch-1.json', modifiedTime: '2024-01-01T00:00:00Z' }] }), { status: 200 });
      return new Response(JSON.stringify(chapterDoc), { status: 200 });
    });

    const response = await handleBrokerRequest({
      method: 'POST',
      path: '/api/integrations/google-drive/pull',
      body: {
        config: { sessionToken: 'token' },
        localChapters: [{ id: 'ch-1', novelId: 'n-1', title: 'Chapter 1', content: 'Local', order: 0, updatedAt: 1000, summary: '', pov: '', status: 'draft', tags: [], wordGoal: 0, scenes: [] }],
      },
    });

    expect(response?.status).toBe(200);
    const body = response?.body as { ok: true; data: { chapterUpdates: Array<{ id: string; content: string }> } };
    expect(body.ok).toBe(true);
    // Remote doc (updatedAt: 2000) is newer than local (updatedAt: 1000), so content should be updated
    const ch = body.data.chapterUpdates.find((c: { id: string }) => c.id === 'ch-1');
    expect(ch?.content).toBe('Remote content');
  });

  it('pushes chapters to Dropbox via broker', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValue(new Response('{}', { status: 200 }));

    const response = await handleBrokerRequest({
      method: 'POST',
      path: '/api/integrations/dropbox/push',
      body: {
        config: { sessionToken: 'token', folderId: '/TestFolder' },
        payload: {
          novelId: 'novel-1',
          projectType: 'book',
          chapters: [{ id: 'ch-1', title: 'Chapter 1', body: 'Hello', order: 0, updatedAt: 1000 }],
        },
      },
    });

    expect(response?.status).toBe(200);
    expect(response?.body).toMatchObject({ ok: true });
    const body = response?.body as { ok: true; data: { message: string } };
    expect(body.data.message).toContain('Pushed 1 chapter(s) to Dropbox');
  });

  it('pulls chapters from Dropbox via broker', async () => {
    const chapterDoc = { id: 'ch-1', title: 'Chapter 1', body: 'Remote', order: 0, updatedAt: 2000 };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    let callCount = 0;
    fetchSpy.mockImplementation(async () => {
      callCount++;
      // Call 1: list_folder, Call 2: download chapter
      if (callCount === 1) return new Response(JSON.stringify({
        entries: [{ '.tag': 'file', name: 'ch-1.json', path_display: '/DraftHarbour/ch-1.json', server_modified: '2024-01-01T00:00:00Z', rev: 'abc' }],
        cursor: 'cur', has_more: false,
      }), { status: 200 });
      return new Response(JSON.stringify(chapterDoc), { status: 200 });
    });

    const response = await handleBrokerRequest({
      method: 'POST',
      path: '/api/integrations/dropbox/pull',
      body: {
        config: { sessionToken: 'token' },
        localChapters: [{ id: 'ch-1', novelId: 'n-1', title: 'Chapter 1', content: 'Local', order: 0, updatedAt: 1000, summary: '', pov: '', status: 'draft', tags: [], wordGoal: 0, scenes: [] }],
      },
    });

    expect(response?.status).toBe(200);
    const body = response?.body as { ok: true; data: { chapterUpdates: Array<{ id: string; content: string }> } };
    expect(body.ok).toBe(true);
    const ch = body.data.chapterUpdates.find((c: { id: string }) => c.id === 'ch-1');
    expect(ch?.content).toBe('Remote');
  });

  it('returns provider unavailable envelope for /api/chat without key', async () => {
    vi.stubEnv('BROKER_GROQ_API_KEY', '');
    vi.stubEnv('BROKER_OPENROUTER_API_KEY', '');
    vi.stubEnv('BROKER_GEMINI_API_KEY', '');

    const response = await handleBrokerRequest({
      method: 'POST',
      path: '/api/chat',
      body: { provider: 'groq', model: 'llama-3.1-8b-instant', prompt: 'hello' },
    });

    expect(response?.status).toBe(503);
    expect(response?.body).toMatchObject({
      ok: false,
      error: {
        code: 'PROVIDER_UNAVAILABLE',
        status: 503,
      },
    });
  });
});
