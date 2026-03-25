import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectLocalLlmServer } from './availability';

describe('detectLocalLlmServer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects Ollama when localhost:11434 responds', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('11434')) {
        return { ok: true } as Response;
      }
      throw new Error('Connection refused');
    });

    const result = await detectLocalLlmServer();
    expect(result.available).toBe(true);
    expect(result.backend).toBe('ollama');
    expect(result.baseUrl).toBe('http://localhost:11434');
  });

  it('detects vLLM when localhost:8000 responds', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('8000')) {
        return { ok: true } as Response;
      }
      throw new Error('Connection refused');
    });

    const result = await detectLocalLlmServer();
    expect(result.available).toBe(true);
    expect(result.backend).toBe('vllm');
    expect(result.baseUrl).toBe('http://localhost:8000');
  });

  it('returns unavailable when no servers respond', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));

    const result = await detectLocalLlmServer();
    expect(result.available).toBe(false);
    expect(result.backend).toBeUndefined();
  });

  it('prefers Ollama when multiple servers respond', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    const result = await detectLocalLlmServer();
    expect(result.available).toBe(true);
    // Ollama is first in the probe list
    expect(result.backend).toBe('ollama');
  });
});
