/**
 * Server proxy provider.
 *
 * Routes AI requests through the server-side PHP proxy at /api/chat when
 * available, or calls Groq / OpenRouter / Gemini APIs directly when the
 * user supplies their own API key.
 */

import { getBrokerBaseUrl, getBrokerEndpoint } from '@/lib/featureFlags';
import { fetchEnvelope, fetchWithPolicy } from '@/lib/integrations/providerClient';
import { getManagedPolicy } from '@/lib/policy';
import type { AIProvider, AIProviderConfig, AIRequest, AIResponse, ServerProxyProviderType } from './types';

/* ------------------------------------------------------------------ */
/*  Direct API endpoints per provider                                  */
/* ------------------------------------------------------------------ */

export const SERVER_PROXY_ENDPOINTS: Record<ServerProxyProviderType, string> = {
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
};

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
    if (!this.config.serverProxy?.serverProvider || !this.config.serverProxy?.model) {
      return false;
    }
    // Available if user has their own API key OR a broker proxy is configured
    return !!(this.config.serverProxy.userApiKey?.trim()) || !!getBrokerBaseUrl();
  }

  async execute(request: AIRequest): Promise<AIResponse> {
    const policy = getManagedPolicy();
    if (policy.forceLocalOnly || policy.disableAIProviders || policy.disabledAIProviderTypes?.includes('server-proxy')) {
      throw new Error('Server proxy AI is disabled by managed policy.');
    }

    if (!this.config.serverProxy?.serverProvider || !this.config.serverProxy?.model) {
      throw new Error('Server proxy is not configured. Select a provider and model in AI Settings.');
    }

    const { serverProvider, model, userApiKey } = this.config.serverProxy!;
    const hasUserKey = !!userApiKey?.trim();
    const hasBroker = !!getBrokerBaseUrl();

    // Direct API call when user has their own key
    if (hasUserKey) {
      return this.executeDirect(request, serverProvider, model, userApiKey!);
    }

    // Fall back to broker proxy
    if (!hasBroker) {
      throw new Error(
        'No API key provided. Enter your API key in AI Settings to connect directly, or configure a broker URL.',
      );
    }

    return this.executeViaProxy(request, serverProvider, model, userApiKey);
  }

  /** Call the AI provider API directly using the user's API key. */
  private async executeDirect(
    request: AIRequest,
    serverProvider: ServerProxyProviderType,
    model: string,
    apiKey: string,
  ): Promise<AIResponse> {
    const start = Date.now();
    const fullPrompt = request.context
      ? `Here is the current ${request.projectType === 'screenplay' ? 'scene' : 'chapter'} text for context:\n\n---\n${request.context}\n---\n\n${request.prompt}`
      : request.prompt;

    const systemMessage = `You are a helpful creative writing assistant for ${
      request.projectType === 'screenplay' ? 'screenplays' : 'books'
    }. Respond in plain text with clear formatting.`;

    if (serverProvider === 'gemini') {
      return this.executeGeminiDirect(fullPrompt, systemMessage, model, apiKey, request.signal, start);
    }

    // Groq and OpenRouter use OpenAI-compatible format
    const endpoint = SERVER_PROXY_ENDPOINTS[serverProvider];
    const trimmedKey = apiKey.trim();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${trimmedKey}`,
    };

    // OpenRouter recommends identifying the app
    if (serverProvider === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'DraftHarbour Studio';
    }

    const res = await fetchWithPolicy(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: fullPrompt },
        ],
        max_tokens: 2048,
      }),
      signal: request.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${SERVER_PROXY_LABELS[serverProvider]} API error (${res.status}): ${body || res.statusText}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? JSON.stringify(data, null, 2);

    return {
      text,
      provider: 'server-proxy',
      latencyMs: Date.now() - start,
      usage: data.usage
        ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
        : undefined,
    };
  }

  /** Call the Google Gemini API directly. */
  private async executeGeminiDirect(
    prompt: string,
    systemInstruction: string,
    model: string,
    apiKey: string,
    signal: AbortSignal | undefined,
    start: number,
  ): Promise<AIResponse> {
    const endpoint = `${SERVER_PROXY_ENDPOINTS.gemini}/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    const res = await fetchWithPolicy(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048 },
      }),
      signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini API error (${res.status}): ${body || res.statusText}`);
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(data, null, 2);

    return {
      text,
      provider: 'server-proxy',
      latencyMs: Date.now() - start,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
          }
        : undefined,
    };
  }

  /** Route the request through the server-side PHP proxy. */
  private async executeViaProxy(
    request: AIRequest,
    serverProvider: ServerProxyProviderType,
    model: string,
    userApiKey: string | undefined,
  ): Promise<AIResponse> {
    const start = Date.now();
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

    const envelope = await fetchEnvelope<{
      text: string;
      model: string;
      provider: string;
      usage?: { promptTokens?: number; completionTokens?: number };
    }>(getBrokerEndpoint('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!envelope.ok) {
      if (envelope.error.status === 404) {
        throw new Error(
          'Server proxy endpoint not found (404). Enter your own API key in AI Settings to connect directly to the provider.',
        );
      }
      throw new Error(`${envelope.error.userMessage} (${envelope.error.status}: ${envelope.error.message})`);
    }

    const data = envelope.data;

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
