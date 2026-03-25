/**
 * Fallback provider chain with retry logic.
 *
 * Wraps multiple AI providers in priority order. When the primary provider
 * fails, automatically retries with exponential backoff, then falls through
 * to the next provider in the chain.
 */

import { isDesktop } from '@/lib/desktopSecrets';
import { getBrokerBaseUrl } from '@/lib/featureFlags';
import type { AIProvider, AIProviderConfig, AIProviderType, AIRequest, AIResponse, FallbackConfig } from './types';
import { createProvider, loadAIConfig } from './providerManager';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Don't retry config/auth errors
    if (msg.includes('not configured') || msg.includes('api key') || msg.includes('disabled by managed policy')) {
      return false;
    }
    // Retry network/server errors
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout') ||
        msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('429')) {
      return true;
    }
  }
  return true;
}

function createFallbackValidationError(message: string): Error {
  return new Error(message);
}

function resolveFallbackTargetConfig(
  fallbackType: AIProviderType,
  primaryConfig: AIProviderConfig,
  persistedConfig: AIProviderConfig = loadAIConfig(),
): AIProviderConfig {
  const persistedFallback = persistedConfig.provider === fallbackType ? persistedConfig : undefined;

  switch (fallbackType) {
    case 'managed-cloud':
    case 'chrome-ai':
      return { provider: fallbackType };
    case 'openai-compatible': {
      const endpoint = primaryConfig.endpoint?.trim() || persistedFallback?.endpoint?.trim();
      if (!endpoint) {
        throw createFallbackValidationError(
          'Custom Provider fallback is not configured. Add an API endpoint in Custom provider (advanced) before selecting it as a fallback.',
        );
      }

      const sessionToken = primaryConfig.sessionToken?.trim()
        ? primaryConfig.sessionToken
        : persistedFallback?.sessionToken;
      if (!sessionToken?.trim() && !isDesktop()) {
        throw createFallbackValidationError(
          'Custom Provider fallback is not configured. Add an API key in Custom provider (advanced) before selecting it as a fallback.',
        );
      }

      return {
        provider: 'openai-compatible',
        endpoint,
        model: primaryConfig.model?.trim() || persistedFallback?.model?.trim(),
        sessionToken,
      };
    }
    case 'server-proxy': {
      const serverProvider = primaryConfig.serverProxy?.serverProvider ?? persistedFallback?.serverProxy?.serverProvider;
      const model = primaryConfig.serverProxy?.model?.trim() || persistedFallback?.serverProxy?.model?.trim();
      const userApiKey = primaryConfig.serverProxy?.userApiKey?.trim()
        ? primaryConfig.serverProxy.userApiKey
        : persistedFallback?.serverProxy?.userApiKey;

      if (!serverProvider || !model) {
        throw createFallbackValidationError(
          'Server Proxy fallback is not configured. Select a provider and model in Server AI Providers before selecting it as a fallback.',
        );
      }

      if (!userApiKey?.trim() && !getBrokerBaseUrl()) {
        throw createFallbackValidationError(
          'Server Proxy fallback is not configured. Add an API key or configure a broker URL before selecting it as a fallback.',
        );
      }

      return {
        provider: 'server-proxy',
        serverProxy: {
          serverProvider,
          model,
          userApiKey,
        },
      };
    }
    case 'custom-llm':
      throw createFallbackValidationError('Custom LLM cannot be used as a fallback target.');
  }
}

export function getFallbackTargetValidation(
  fallbackType: AIProviderType,
  primaryConfig: AIProviderConfig,
  persistedConfig: AIProviderConfig = loadAIConfig(),
): { isValid: boolean; reason?: string } {
  try {
    resolveFallbackTargetConfig(fallbackType, primaryConfig, persistedConfig);
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      reason: error instanceof Error ? error.message : 'Fallback provider is not configured.',
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Fallback provider                                                  */
/* ------------------------------------------------------------------ */

export class FallbackProvider implements AIProvider {
  readonly type = 'custom-llm' as const;
  readonly supportsStreaming: boolean;
  private providers: AIProvider[];

  constructor(private fallbackConfig: FallbackConfig) {
    this.providers = fallbackConfig.chain.map(cfg => createProvider(cfg));
    this.supportsStreaming = this.providers.some(p => p.supportsStreaming);
  }

  isAvailable(): boolean {
    return this.providers.some(p => p.isAvailable());
  }

  async execute(request: AIRequest): Promise<AIResponse> {
    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of this.providers) {
      if (!provider.isAvailable()) {
        errors.push({ provider: provider.type, error: 'not available' });
        continue;
      }

      for (let attempt = 0; attempt <= this.fallbackConfig.maxRetriesPerProvider; attempt++) {
        try {
          if (attempt > 0) {
            const backoffMs = this.fallbackConfig.retryBaseDelayMs * Math.pow(2, attempt - 1);
            await delay(backoffMs, request.signal);
          }

          return await provider.execute(request);
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === 'AbortError') throw err;

          const message = err instanceof Error ? err.message : String(err);

          if (!isRetryableError(err) || attempt === this.fallbackConfig.maxRetriesPerProvider) {
            errors.push({ provider: provider.type, error: message });
            break;
          }
        }
      }
    }

    const summary = errors.map(e => `${e.provider}: ${e.error}`).join('; ');
    throw new Error(`All AI providers failed. ${summary}`);
  }

  destroy(): void {
    for (const provider of this.providers) {
      provider.destroy();
    }
  }
}

/**
 * Build a fallback config from a custom LLM config, automatically
 * appending the specified fallback provider.
 */
export function buildFallbackChain(primaryConfig: AIProviderConfig): FallbackConfig | null {
  const fallbackType = primaryConfig.customLlm?.fallbackProvider;
  if (!fallbackType) return null;

  const primaryWithoutFallback: AIProviderConfig = {
    ...primaryConfig,
    customLlm: primaryConfig.customLlm ? { ...primaryConfig.customLlm } : primaryConfig.customLlm,
  };
  if (primaryWithoutFallback.customLlm) {
    delete primaryWithoutFallback.customLlm.fallbackProvider;
  }
  const fallbackConfig = resolveFallbackTargetConfig(fallbackType, primaryConfig);

  return {
    chain: [primaryWithoutFallback, fallbackConfig],
    maxRetriesPerProvider: 2,
    retryBaseDelayMs: 1000,
  };
}
