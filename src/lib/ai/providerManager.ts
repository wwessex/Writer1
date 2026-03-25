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
import { CustomLlmProvider } from './customLlmProvider';
import { FallbackProvider, buildFallbackChain } from './fallbackProvider';
import { isChromeAIAvailable, isChromeBrowser, detectLocalLlmServer } from './availability';
import { deleteSecret, getSecret, isDesktop, setSecret } from '@/lib/desktopSecrets';
import { getManagedPolicy } from '@/lib/policy';

const STORAGE_KEY = 'draftharbour_ai_config';
const AI_TOKEN_SECRET_KEY = 'ai_session_token';
const CUSTOM_LLM_SECRET_KEY = 'custom_llm_api_key';

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
    const raw = localStorage.getItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
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
      customLlm: (safeConfig as AIProviderConfig).customLlm,
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider: 'managed-cloud' }));
    return;
  }

  if (isDesktop()) {
    if (config.sessionToken) {
      void setSecret(AI_TOKEN_SECRET_KEY, config.sessionToken);
    } else {
      void deleteSecret(AI_TOKEN_SECRET_KEY);
    }
    if (config.customLlm?.apiKey) {
      void setSecret(CUSTOM_LLM_SECRET_KEY, config.customLlm.apiKey);
    } else {
      void deleteSecret(CUSTOM_LLM_SECRET_KEY);
    }
  }

  // Scrub sensitive fields from customLlm before persisting
  const safeCustomLlm = config.customLlm ? {
    ...config.customLlm,
    apiKey: isDesktop() ? undefined : config.customLlm.apiKey,
  } : undefined;

  const safeConfig: AIProviderConfig = {
    provider: config.provider,
    endpoint: config.endpoint,
    model: config.model,
    sessionToken: isDesktop() ? undefined : config.sessionToken,
    serverProxy: config.serverProxy,
    customLlm: safeCustomLlm,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeConfig));
}

/**
 * Hydrate secrets from the OS keychain on desktop.
 * Call after `loadAIConfig()` to restore API keys that are
 * deliberately scrubbed from localStorage.
 */
export async function hydrateDesktopSecrets(config: AIProviderConfig): Promise<AIProviderConfig> {
  if (!isDesktop()) return config;

  const [sessionToken, customLlmKey] = await Promise.all([
    config.sessionToken ? Promise.resolve(config.sessionToken) : getSecret(AI_TOKEN_SECRET_KEY),
    config.customLlm?.apiKey ? Promise.resolve(config.customLlm.apiKey) : getSecret(CUSTOM_LLM_SECRET_KEY),
  ]);

  return {
    ...config,
    sessionToken: sessionToken ?? config.sessionToken,
    customLlm: config.customLlm ? {
      ...config.customLlm,
      apiKey: customLlmKey ?? config.customLlm.apiKey,
    } : config.customLlm,
  };
}

/* ------------------------------------------------------------------ */
/*  Provider factory                                                   */
/* ------------------------------------------------------------------ */

/** Create the appropriate AIProvider instance from a config. */
export function createProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case 'custom-llm': {
      // If a fallback is configured, wrap in FallbackProvider
      const fallbackConfig = buildFallbackChain(config);
      if (fallbackConfig) {
        return new FallbackProvider(fallbackConfig);
      }
      return new CustomLlmProvider(config);
    }
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
 * Checks Chrome AI first, then probes for local LLM servers,
 * and falls back to 'managed-cloud'.
 */
export async function detectBestProvider(): Promise<AIProviderType> {
  if (await isChromeAIAvailable()) {
    return 'chrome-ai';
  }
  const local = await detectLocalLlmServer();
  if (local.available) {
    return 'custom-llm';
  }
  return 'managed-cloud';
}

/**
 * Detect a local LLM server and return a pre-filled config.
 * Useful for auto-configuring the custom LLM provider in the UI.
 */
export async function detectLocalLlmConfig(): Promise<AIProviderConfig | null> {
  const local = await detectLocalLlmServer();
  if (!local.available || !local.backend || !local.baseUrl) return null;
  return {
    provider: 'custom-llm',
    customLlm: {
      backend: local.backend,
      baseUrl: local.baseUrl,
      model: local.backend === 'ollama' ? 'narratryx:latest' : 'narratryx',
      streaming: true,
    },
  };
}

/**
 * True when the user is in Chrome but the on-device AI APIs
 * are not yet available (model not downloaded, flag not enabled, etc.).
 * Useful for showing targeted guidance in the UI.
 */
export function isChromeWithoutAI(): boolean {
  return isChromeBrowser() && !new ChromeAIProvider().isAvailable();
}
