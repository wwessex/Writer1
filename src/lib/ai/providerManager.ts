/**
 * AI provider factory, configuration persistence, and auto-detection.
 *
 * Manages the `draftharbour_ai_config` localStorage key and creates
 * the appropriate AIProvider instance based on the stored config.
 *
 * Handles migration from legacy formats while scrubbing sensitive API keys
 * from persisted localStorage payloads.
 */

import type { AIProviderConfig, AIProviderType, AIProvider } from './types';
import { ChromeAIProvider } from './chromeAI';
import { OpenAIProvider } from './openaiProvider';
import { ServerProxyProvider } from './serverProxyProvider';
import { isChromeAIAvailable, isChromeBrowser } from './availability';
import { deleteSecret, isDesktop, setSecret } from '@/lib/desktopSecrets';
import { getManagedPolicy } from '@/lib/policy';
import { AI_CONFIG_STORAGE_KEY } from '@/lib/constants/storageKeys';
const AI_TOKEN_SECRET_KEY = 'ai_session_token';

/* ------------------------------------------------------------------ */
/*  Config persistence                                                 */
/* ------------------------------------------------------------------ */

/** Load AI config from localStorage, migrating legacy format if needed. */
export function loadAIConfig(): AIProviderConfig {
  const policy = getManagedPolicy();
  if (policy.disableAIProviders) {
    return { provider: 'managed-cloud' };
  }

  try {
    const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) {
      return { provider: 'managed-cloud' };
    }

    const parsed = JSON.parse(raw);

    // Legacy payloads may include raw `apiKey`; scrub and avoid persistence of secrets.
    if (!parsed.provider) {
      if (parsed.endpoint) {
        return {
          provider: 'openai-compatible',
          endpoint: parsed.endpoint,
          model: parsed.model,
        };
      }
      return { provider: 'managed-cloud' };
    }

    const safeConfig = parsed as AIProviderConfig & { apiKey?: string };
    // Migrate legacy `apiKey` → `sessionToken` and persist the cleaned config
    if ('apiKey' in safeConfig) {
      const migratedToken = safeConfig.sessionToken || safeConfig.apiKey;
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
        provider: safeConfig.provider,
        endpoint: safeConfig.endpoint,
        model: safeConfig.model,
        sessionToken: migratedToken,
        serverProxy: safeConfig.serverProxy,
      }));
      return {
        provider: safeConfig.provider,
        endpoint: safeConfig.endpoint,
        model: safeConfig.model,
        sessionToken: migratedToken,
        serverProxy: safeConfig.serverProxy,
      };
    }

    const loadedConfig: AIProviderConfig = {
      provider: safeConfig.provider,
      endpoint: safeConfig.endpoint,
      model: safeConfig.model,
      sessionToken: safeConfig.sessionToken,
      serverProxy: safeConfig.serverProxy,
    };

    if (policy.disabledAIProviderTypes?.includes(loadedConfig.provider)) {
      return { provider: 'managed-cloud' };
    }

    return loadedConfig;
  } catch {
    return { provider: 'managed-cloud' };
  }
}

/** Save AI config to localStorage. */
export function saveAIConfig(config: AIProviderConfig): void {
  const policy = getManagedPolicy();
  if (policy.disableAIProviders || policy.disabledAIProviderTypes?.includes(config.provider)) {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ provider: 'managed-cloud' }));
    return;
  }

  if (isDesktop()) {
    if (config.sessionToken) {
      void setSecret(AI_TOKEN_SECRET_KEY, config.sessionToken);
    } else {
      void deleteSecret(AI_TOKEN_SECRET_KEY);
    }
  }

  const safeConfig: AIProviderConfig = {
    provider: config.provider,
    endpoint: config.endpoint,
    model: config.model,
    sessionToken: isDesktop() ? undefined : config.sessionToken,
    serverProxy: config.serverProxy,
  };
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(safeConfig));
}

/* ------------------------------------------------------------------ */
/*  Provider factory                                                   */
/* ------------------------------------------------------------------ */

/** Create the appropriate AIProvider instance from a config. */
export function createProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case 'server-proxy':
      return new ServerProxyProvider(config);
    case 'openai-compatible':
    case 'managed-cloud':
      return new OpenAIProvider(config);
    case 'chrome-ai': {
      const chromeProvider = new ChromeAIProvider();
      if (chromeProvider.isAvailable()) {
        return chromeProvider;
      }
      return new OpenAIProvider({ provider: 'managed-cloud', model: config.model });
    }
    default:
      return new OpenAIProvider({ provider: 'managed-cloud', model: config.model });
  }
}

/* ------------------------------------------------------------------ */
/*  Auto-detection                                                     */
/* ------------------------------------------------------------------ */

/**
 * Detect the best available provider.
 * Returns 'chrome-ai' when on a supported Chrome build with the APIs
 * available, otherwise falls back to 'managed-cloud'.
 */
export async function detectBestProvider(): Promise<AIProviderType> {
  if (await isChromeAIAvailable()) {
    return 'chrome-ai';
  }
  return 'managed-cloud';
}

/**
 * True when the user is in Chrome but the on-device AI APIs
 * are not yet available (model not downloaded, flag not enabled, etc.).
 * Useful for showing targeted guidance in the UI.
 */
export function isChromeWithoutAI(): boolean {
  return isChromeBrowser() && !new ChromeAIProvider().isAvailable();
}
