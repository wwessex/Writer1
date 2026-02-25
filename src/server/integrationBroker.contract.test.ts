import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleBrokerRequest } from './integrationBroker';

describe('integration broker contract envelopes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    const promise = handleBrokerRequest({
      method: 'POST',
      path: '/api/integrations/dropbox/connect',
      body: { config: { sessionToken: 'token' } },
    });

    // Advance past the retry delays (300ms + 600ms)
    await vi.advanceTimersByTimeAsync(1000);

    const response = await promise;

    expect(response?.status).toBe(429);
    expect(response?.body).toMatchObject({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        retryable: true,
      },
    });
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
