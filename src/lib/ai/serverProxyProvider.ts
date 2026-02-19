/**
 * Server proxy provider.
 *
 * Routes AI requests through the server-side PHP proxy at /api/chat,
 * which forwards to Groq, OpenRouter, or Gemini. API keys are managed
 * server-side — never embedded in the browser JS bundle.
 */

import { getBrokerBaseUrl } from '@/lib/featureFlags';
import type { AIProvider, AIProviderConfig, AIRequest, AIResponse, ServerProxyProviderType } from './types';

/* ------------------------------------------------------------------ */
/*  Model catalogues per provider                                      */
/* ------------------------------------------------------------------ */

export const SERVER_PROXY_MODELS: Record<ServerProxyProviderType, { id: string; label: string }[]> = {
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
    { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it', label: 'Gemma 2 9B' },
  ],
  openrouter: [
    { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (Free)' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)' },
    { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { id: 'openai/gpt-4o', label: 'GPT-4o' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
};

export const SERVER_PROXY_LABELS: Record<ServerProxyProviderType, string> = {
  groq: 'Groq',
  openrouter: 'OpenRouter',
  gemini: 'Google Gemini',
};

/* ------------------------------------------------------------------ */
/*  Provider class                                                     */
/* ------------------------------------------------------------------ */

export class ServerProxyProvider implements AIProvider {
  readonly type = 'server-proxy' as const;

  constructor(private config: AIProviderConfig) {}

  isAvailable(): boolean {
    return !!this.config.serverProxy?.serverProvider && !!this.config.serverProxy?.model;
  }

  async execute(request: AIRequest): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('Server proxy is not configured. Select a provider and model in AI Settings.');
    }

    const start = Date.now();
    const base = getBrokerBaseUrl();
    const { serverProvider, model, userApiKey } = this.config.serverProxy!;

    const fullPrompt = request.context
      ? `Here is the current ${request.projectType === 'screenplay' ? 'scene' : 'chapter'} text for context:\n\n---\n${request.context}\n---\n\n${request.prompt}`
      : request.prompt;

    const body: Record<string, unknown> = {
      provider: serverProvider,
      model,
      prompt: fullPrompt,
      projectType: request.projectType,
    };

    if (userApiKey?.trim()) {
      body.userApiKey = userApiKey;
    }

    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { message?: string; error?: string };
      const detail = errBody.message || errBody.error || res.statusText;
      throw new Error(`Server proxy error (${res.status}): ${detail}`);
    }

    const data = await res.json() as {
      text: string;
      model: string;
      provider: string;
      usage?: { promptTokens?: number; completionTokens?: number };
    };

    return {
      text: data.text,
      provider: 'server-proxy',
      latencyMs: Date.now() - start,
      usage: data.usage,
    };
  }

  destroy(): void {
    // No resources to clean up for an HTTP-based provider
  }
}
