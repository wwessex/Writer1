import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isChromeBrowser, checkChromeAIAvailability, isChromeAIAvailable, detectLocalLlmServer } from './availability';

/* ------------------------------------------------------------------ */
/*  isChromeBrowser                                                     */
/* ------------------------------------------------------------------ */

describe('isChromeBrowser', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true });
  });

  it('returns true for Chrome UA string', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36' },
      configurable: true,
    });
    expect(isChromeBrowser()).toBe(true);
  });

  it('returns false for Edge UA string', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0' },
      configurable: true,
    });
    expect(isChromeBrowser()).toBe(false);
  });

  it('returns false for Opera UA string', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 OPR/120.0.0.0' },
      configurable: true,
    });
    expect(isChromeBrowser()).toBe(false);
  });

  it('returns false for Brave UA string', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36 Brave/1.0' },
      configurable: true,
    });
    expect(isChromeBrowser()).toBe(false);
  });

  it('returns false for Firefox UA string', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0' },
      configurable: true,
    });
    expect(isChromeBrowser()).toBe(false);
  });

  it('detects Chrome via userAgentData brands', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: '',
        userAgentData: {
          brands: [
            { brand: 'Chromium', version: '120' },
            { brand: 'Google Chrome', version: '120' },
          ],
        },
      },
      configurable: true,
    });
    expect(isChromeBrowser()).toBe(true);
  });

  it('returns false for Edge via userAgentData brands', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: '',
        userAgentData: {
          brands: [
            { brand: 'Chromium', version: '120' },
            { brand: 'Google Chrome', version: '120' },
            { brand: 'Microsoft Edge', version: '120' },
          ],
        },
      },
      configurable: true,
    });
    expect(isChromeBrowser()).toBe(false);
  });

  it('returns false for Brave via userAgentData brands', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: '',
        userAgentData: {
          brands: [
            { brand: 'Chromium', version: '120' },
            { brand: 'Google Chrome', version: '120' },
            { brand: 'Brave', version: '120' },
          ],
        },
      },
      configurable: true,
    });
    expect(isChromeBrowser()).toBe(false);
  });

  it('falls through to UA string when userAgentData throws', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36',
        get userAgentData() {
          throw new Error('not supported');
        },
      },
      configurable: true,
    });
    expect(isChromeBrowser()).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  checkChromeAIAvailability                                          */
/* ------------------------------------------------------------------ */

describe('checkChromeAIAvailability', () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).LanguageModel;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).Summarizer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).Writer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).Rewriter;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).ai;
  });

  it('returns all unavailable when not Chrome', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Firefox/115.0' },
      configurable: true,
    });
    const result = await checkChromeAIAvailability();
    expect(result.languageModel).toBe('unavailable');
    expect(result.summarizer).toBe('unavailable');
    expect(result.writer).toBe('unavailable');
    expect(result.rewriter).toBe('unavailable');
  });

  it('checks APIs when Chrome is detected', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Chrome/138.0.0.0 Safari/537.36' },
      configurable: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).LanguageModel = { availability: async () => 'available' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Summarizer = { availability: async () => 'downloadable' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Writer = { availability: async () => 'unavailable' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Rewriter = { availability: async () => 'downloading' };

    const result = await checkChromeAIAvailability();
    expect(result.languageModel).toBe('available');
    expect(result.summarizer).toBe('downloadable');
    expect(result.writer).toBe('unavailable');
    expect(result.rewriter).toBe('downloading');
  });

  it('normalises legacy Chrome values', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Chrome/136.0.0.0 Safari/537.36' },
      configurable: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).LanguageModel = { availability: async () => 'readily' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Summarizer = { availability: async () => 'after-download' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Writer = { availability: async () => 'no' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).Rewriter = { availability: async () => 'no' };

    const result = await checkChromeAIAvailability();
    expect(result.languageModel).toBe('available');
    expect(result.summarizer).toBe('downloadable');
    expect(result.writer).toBe('unavailable');
  });

  it('returns unavailable when API has no availability function', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Chrome/138.0.0.0 Safari/537.36' },
      configurable: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).LanguageModel = {};

    const result = await checkChromeAIAvailability();
    expect(result.languageModel).toBe('unavailable');
  });

  it('returns unknown for unrecognised availability values', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Chrome/138.0.0.0 Safari/537.36' },
      configurable: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).LanguageModel = { availability: async () => 'some-future-value' };

    const result = await checkChromeAIAvailability();
    expect(result.languageModel).toBe('unknown');
  });

  it('resolves APIs from self.ai namespace', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Chrome/138.0.0.0 Safari/537.36' },
      configurable: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ai = {
      languageModel: { availability: async () => 'available' },
      summarizer: { availability: async () => 'unavailable' },
      writer: { availability: async () => 'unavailable' },
      rewriter: { availability: async () => 'unavailable' },
    };

    const result = await checkChromeAIAvailability();
    expect(result.languageModel).toBe('available');
  });

  it('handles availability() that throws', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Chrome/138.0.0.0 Safari/537.36' },
      configurable: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).LanguageModel = {
      availability: async () => { throw new Error('boom'); },
    };

    const result = await checkChromeAIAvailability();
    expect(result.languageModel).toBe('unavailable');
  });
});

/* ------------------------------------------------------------------ */
/*  isChromeAIAvailable                                                */
/* ------------------------------------------------------------------ */

describe('isChromeAIAvailable', () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).LanguageModel;
  });

  it('returns false when not Chrome', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Firefox/115.0' },
      configurable: true,
    });
    expect(await isChromeAIAvailable()).toBe(false);
  });

  it('returns true when at least one API is available', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Chrome/138.0.0.0 Safari/537.36' },
      configurable: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).LanguageModel = { availability: async () => 'available' };

    expect(await isChromeAIAvailable()).toBe(true);
  });

  it('returns true when an API is downloadable', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'Mozilla/5.0 Chrome/138.0.0.0 Safari/537.36' },
      configurable: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).LanguageModel = { availability: async () => 'downloadable' };

    expect(await isChromeAIAvailable()).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  detectLocalLlmServer                                               */
/* ------------------------------------------------------------------ */

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

  it('detects llama.cpp when localhost:8080 responds', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
      if (url.includes('8080')) {
        return { ok: true } as Response;
      }
      throw new Error('Connection refused');
    });

    const result = await detectLocalLlmServer();
    expect(result.available).toBe(true);
    expect(result.backend).toBe('llama-cpp');
    expect(result.baseUrl).toBe('http://localhost:8080');
  });

  it('returns unavailable when no servers respond', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection refused'));

    const result = await detectLocalLlmServer();
    expect(result.available).toBe(false);
    expect(result.backend).toBeUndefined();
  });

  it('returns unavailable when server returns non-ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);

    const result = await detectLocalLlmServer();
    expect(result.available).toBe(false);
  });

  it('prefers Ollama when multiple servers respond', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);

    const result = await detectLocalLlmServer();
    expect(result.available).toBe(true);
    expect(result.backend).toBe('ollama');
  });
});
