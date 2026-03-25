/**
 * Chrome Built-in AI feature detection.
 *
 * Chrome ≤ 137 exposed `availability()` returning 'readily' | 'after-download' | 'no'.
 * Chrome 138+ changed to 'available' | 'downloadable' | 'downloading' | 'unavailable'.
 *
 * We accept both old and new values and normalise them into the current
 * vocabulary so the rest of the app only needs to handle one set.
 *
 * APIs are checked first as top-level globals (LanguageModel, Summarizer,
 * Writer, Rewriter) and then via the `self.ai` namespace as a fallback,
 * since some Chrome builds expose them there instead.
 */

import type { AvailabilityStatus, ChromeAIAvailability, CustomLlmBackend } from './types';

/* ------------------------------------------------------------------ */
/*  Browser guard — only real Chrome ships usable Built-in AI APIs     */
/* ------------------------------------------------------------------ */

/**
 * Return `true` only when running inside Google Chrome (not Edge, Brave,
 * Opera, or other Chromium forks that may expose `self.ai` stubs).
 *
 * Uses the modern `NavigatorUAData` API first (Chromium 90+) and falls
 * back to the classic `navigator.userAgent` string.
 */
export function isChromeBrowser(): boolean {
  try {
    // Modern: navigator.userAgentData.brands
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uaData = (navigator as any).userAgentData;
    if (uaData?.brands) {
      const brands: { brand: string }[] = uaData.brands;
      const hasChrome = brands.some(b => b.brand === 'Google Chrome');
      // Edge injects "Microsoft Edge" and Brave injects "Brave"
      const hasEdge = brands.some(b => b.brand === 'Microsoft Edge');
      const hasBrave = brands.some(b => b.brand === 'Brave');
      return hasChrome && !hasEdge && !hasBrave;
    }
  } catch {
    // ignore — fall through to UA string
  }

  // Legacy: user-agent string check
  const ua = navigator.userAgent;
  return /Chrome\/\d+/.test(ua) && !/Edg\//.test(ua) && !/OPR\//.test(ua) && !/Brave/.test(ua);
}

/* ------------------------------------------------------------------ */
/*  Normalisation map — old values → new vocabulary                    */
/* ------------------------------------------------------------------ */

const NORMALISE: Record<string, AvailabilityStatus> = {
  // New values (Chrome 138+)
  available: 'available',
  downloadable: 'downloadable',
  downloading: 'downloading',
  unavailable: 'unavailable',
  // Legacy values (Chrome ≤ 137)
  readily: 'available',
  'after-download': 'downloadable',
  no: 'unavailable',
};

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

/**
 * Resolve an API object by name, trying the top-level global first and
 * then the `self.ai` namespace (e.g. `self.ai.languageModel`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveAPI(globalName: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const top = (globalThis as any)[globalName];
  if (top) return top;

  // Fallback: self.ai namespace uses camelCase names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ai = (globalThis as any).ai ?? (typeof self !== 'undefined' ? (self as any).ai : undefined);
  if (!ai) return undefined;

  const camelName = globalName.charAt(0).toLowerCase() + globalName.slice(1);
  return ai[camelName] ?? undefined;
}

async function checkAPI(globalName: string): Promise<AvailabilityStatus> {
  try {
    const api = resolveAPI(globalName);
    if (!api || typeof api.availability !== 'function') {
      return 'unavailable';
    }
    const result: string = await api.availability();
    return NORMALISE[result] ?? 'unknown';
  } catch {
    return 'unavailable';
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/** Check availability of all four Chrome Built-in AI APIs. */
export async function checkChromeAIAvailability(): Promise<ChromeAIAvailability> {
  // Only real Chrome ships functional Built-in AI; other Chromium forks
  // (Edge, Brave, Opera …) may expose stubs that don't actually work.
  if (!isChromeBrowser()) {
    return {
      languageModel: 'unavailable',
      summarizer: 'unavailable',
      writer: 'unavailable',
      rewriter: 'unavailable',
    };
  }

  const [languageModel, summarizer, writer, rewriter] = await Promise.all([
    checkAPI('LanguageModel'),
    checkAPI('Summarizer'),
    checkAPI('Writer'),
    checkAPI('Rewriter'),
  ]);
  return { languageModel, summarizer, writer, rewriter };
}

/** Quick boolean: is at least one Chrome AI API usable? */
export async function isChromeAIAvailable(): Promise<boolean> {
  if (!isChromeBrowser()) return false;
  const result = await checkChromeAIAvailability();
  return Object.values(result).some(
    (s) => s === 'available' || s === 'downloadable' || s === 'downloading',
  );
}

/* ------------------------------------------------------------------ */
/*  Local LLM server detection                                         */
/* ------------------------------------------------------------------ */

export interface LocalLlmDetection {
  available: boolean;
  backend?: CustomLlmBackend;
  baseUrl?: string;
}

const LOCAL_LLM_PROBES: { backend: CustomLlmBackend; baseUrl: string; path: string }[] = [
  { backend: 'ollama', baseUrl: 'http://localhost:11434', path: '/api/tags' },
  { backend: 'vllm', baseUrl: 'http://localhost:8000', path: '/v1/models' },
  { backend: 'llama-cpp', baseUrl: 'http://localhost:8080', path: '/v1/models' },
];

const PROBE_TIMEOUT_MS = 1500;

/**
 * Probe well-known localhost ports to detect a running LLM inference server.
 * Returns the first backend that responds successfully.
 */
export async function detectLocalLlmServer(): Promise<LocalLlmDetection> {
  const results = await Promise.allSettled(
    LOCAL_LLM_PROBES.map(async (probe) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      try {
        const res = await fetch(`${probe.baseUrl}${probe.path}`, {
          method: 'GET',
          signal: controller.signal,
        });
        if (res.ok) return probe;
        return null;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      return {
        available: true,
        backend: result.value.backend,
        baseUrl: result.value.baseUrl,
      };
    }
  }

  return { available: false };
}
