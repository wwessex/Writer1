/**
 * Chrome Built-in AI feature detection.
 *
 * Each API exposes a static `availability()` method that returns
 * 'readily' | 'after-download' | 'no'. We wrap these in a safe
 * helper that returns 'no' when the global doesn't exist (i.e. the
 * browser does not support the API at all).
 */

import type { AvailabilityStatus, ChromeAIAvailability } from './types';

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

async function checkAPI(globalName: string): Promise<AvailabilityStatus> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (globalThis as any)[globalName];
    if (!api || typeof api.availability !== 'function') {
      return 'no';
    }
    const result: string = await api.availability();
    if (result === 'readily' || result === 'after-download' || result === 'no') {
      return result as AvailabilityStatus;
    }
    return 'unknown';
  } catch {
    return 'no';
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
    (s) => s === 'readily' || s === 'after-download',
  );
}
