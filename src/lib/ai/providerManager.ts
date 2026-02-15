/**
 * AI provider factory, configuration persistence, and auto-detection.
 *
 * Manages the `draftharbour_ai_config` localStorage key and creates
 * the appropriate AIProvider instance based on the stored config.
 *
 * Handles migration from the legacy format (endpoint + apiKey only,
 * no provider field) to the new format that includes a provider selector.
 */

import type { AIProviderConfig, AIProviderType, AIProvider } from './types';
import { ChromeAIProvider } from './chromeAI';
import { OpenAIProvider } from './openaiProvider';
import { isChromeAIAvailable } from './availability';

const STORAGE_KEY = 'draftharbour_ai_config';

/* ------------------------------------------------------------------ */
/*  Config persistence                                                 */
/* ------------------------------------------------------------------ */

/** Load AI config from localStorage, migrating legacy format if needed. */
export function loadAIConfig(): AIProviderConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { provider: 'chrome-ai' };
    }

    const parsed = JSON.parse(raw);

    // Migrate legacy format: { endpoint, apiKey } with no provider field
    if (!parsed.provider) {
      if (parsed.endpoint && parsed.apiKey) {
        return {
          provider: 'openai-compatible',
          endpoint: parsed.endpoint,
          apiKey: parsed.apiKey,
          model: parsed.model,
        };
      }
      return { provider: 'chrome-ai' };
    }

    return parsed as AIProviderConfig;
  } catch {
    return { provider: 'chrome-ai' };
  }
}

/** Save AI config to localStorage. */
export function saveAIConfig(config: AIProviderConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/* ------------------------------------------------------------------ */
/*  Provider factory                                                   */
/* ------------------------------------------------------------------ */

/** Create the appropriate AIProvider instance from a config. */
export function createProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case 'openai-compatible':
      return new OpenAIProvider(config);
    case 'chrome-ai':
    default:
      return new ChromeAIProvider();
  }
}

/* ------------------------------------------------------------------ */
/*  Auto-detection                                                     */
/* ------------------------------------------------------------------ */

/**
 * Detect the best available provider.
 * Returns 'chrome-ai' when on a supported Chrome build,
 * otherwise falls back to 'openai-compatible'.
 */
export async function detectBestProvider(): Promise<AIProviderType> {
  if (await isChromeAIAvailable()) {
    return 'chrome-ai';
  }
  return 'openai-compatible';
}
