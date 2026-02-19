/**
 * OpenAI-compatible chat completion provider.
 */

import { getBrokerBaseUrl, isAIDeveloperModeEnabled } from '@/lib/featureFlags';
import type { AIProvider, AIProviderConfig, AIRequest, AIResponse } from './types';

export class OpenAIProvider implements AIProvider {
  readonly type: AIProviderConfig['provider'];

  constructor(private config: AIProviderConfig) {
    this.type = config.provider;
  }

  isAvailable(): boolean {
    const hasCustomEndpoint = !!(this.config.endpoint?.trim() && this.config.sessionToken?.trim());

    if (this.config.provider === 'managed-cloud') {
      // managed-cloud requires a broker URL to function
      return !!getBrokerBaseUrl();
    }
    if (this.config.provider === 'openai-compatible' && hasCustomEndpoint) {
      return true;
    }
    if (!isAIDeveloperModeEnabled()) {
      return !!getBrokerBaseUrl();
    }
    return hasCustomEndpoint;
  }

  async execute(request: AIRequest): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('Custom provider is not configured. Set an API endpoint and session token.');
    }

    const start = Date.now();
    const fullPrompt = request.context
      ? `Here is the current ${request.projectType === 'screenplay' ? 'scene' : 'chapter'} text for context:\n\n---\n${request.context}\n---\n\n${request.prompt}`
      : request.prompt;

    const hasCustomEndpoint = !!(this.config.endpoint?.trim() && this.config.sessionToken?.trim());
    const useCustomEndpoint = this.config.provider === 'openai-compatible' && hasCustomEndpoint;
    const useManagedBroker = this.config.provider === 'managed-cloud' || (!useCustomEndpoint && !isAIDeveloperModeEnabled());

    if (useManagedBroker) {
      const brokerBase = getBrokerBaseUrl();
      if (!brokerBase) {
        throw new Error(
          'Cloud AI is not available. To use AI features, open Settings in the AI panel and expand "Custom provider (advanced)" to connect your own OpenAI-compatible API endpoint and key (e.g. from platform.openai.com). Alternatively, use Google Chrome which supports free on-device AI.',
        );
      }

      const brokerRes = await fetch(`${brokerBase}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          projectType: request.projectType,
          model: this.config.model || 'gpt-4o',
        }),
        signal: request.signal,
      });

      if (!brokerRes.ok) {
        let detail = brokerRes.statusText;
        try {
          const errBody = await brokerRes.json() as { message?: string; error?: string };
          detail = errBody.message || errBody.error || detail;
        } catch {
          const text = await brokerRes.text().catch(() => '');
          if (text) detail = text;
        }
        if (brokerRes.status === 404) {
          throw new Error(
            'Cloud AI endpoint not found (404). Please switch to a custom OpenAI-compatible provider in Settings → Custom provider (advanced) and supply your own API endpoint and key.',
          );
        }
        throw new Error(`Broker AI request failed (${brokerRes.status}): ${detail}`);
      }

      const brokerData = await brokerRes.json() as { text: string };
      return {
        text: brokerData.text,
        provider: this.config.provider,
        latencyMs: Date.now() - start,
      };
    }

    const res = await fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.sessionToken}`,
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a helpful creative writing assistant for ${
              request.projectType === 'screenplay' ? 'screenplays' : 'books'
            }. Respond in plain text with clear formatting.`,
          },
          { role: 'user', content: fullPrompt },
        ],
        max_tokens: 2048,
      }),
      signal: request.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API request failed (${res.status}): ${body || res.statusText}`);
    }

    const data = await res.json();
    const text =
      data?.choices?.[0]?.message?.content ??
      data?.content?.[0]?.text ??
      data?.response ??
      JSON.stringify(data, null, 2);

    return {
      text,
      provider: this.config.provider,
      latencyMs: Date.now() - start,
    };
  }

  destroy(): void {
    // Nothing to clean up for an HTTP-based provider
  }
}
