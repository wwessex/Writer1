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

import type { AvailabilityStatus, ChromeAIAvailability } from './types';

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
  const result = await checkChromeAIAvailability();
  return Object.values(result).some(
    (s) => s === 'available' || s === 'downloadable' || s === 'downloading',
  );
}
