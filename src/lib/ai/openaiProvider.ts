/**
 * OpenAI-compatible chat completion provider.
 *
 * Extracted from the inline fetch logic previously in AIWritingModal
 * and AISuggestionsPanel. Works with any endpoint that speaks the
 * OpenAI chat completions format (OpenAI, Anthropic via proxy,
 * Ollama, LM Studio, etc.).
 */

import type { AIProvider, AIProviderConfig, AIRequest, AIResponse } from './types';

export class OpenAIProvider implements AIProvider {
  readonly type = 'openai-compatible' as const;

  constructor(private config: AIProviderConfig) {}

  isAvailable(): boolean {
    return !!(this.config.endpoint?.trim() && this.config.apiKey?.trim());
  }

  async execute(request: AIRequest): Promise<AIResponse> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI provider is not configured. Set an API endpoint and key.');
    }

    const start = Date.now();

    const fullPrompt = request.context
      ? `Here is the current ${request.projectType === 'screenplay' ? 'scene' : 'chapter'} text for context:\n\n---\n${request.context}\n---\n\n${request.prompt}`
      : request.prompt;

    const res = await fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
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
      throw new Error(
        `API request failed (${res.status}): ${body || res.statusText}`,
      );
    }

    const data = await res.json();
    const text =
      data?.choices?.[0]?.message?.content ??
      data?.content?.[0]?.text ??
      data?.response ??
      JSON.stringify(data, null, 2);

    return {
      text,
      provider: 'openai-compatible',
      latencyMs: Date.now() - start,
    };
  }

  destroy(): void {
    // Nothing to clean up for an HTTP-based provider
  }
}
