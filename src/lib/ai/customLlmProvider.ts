/**
 * Custom LLM provider for local/self-hosted inference.
 *
 * Supports:
 * - Ollama (http://localhost:11434)
 * - vLLM (OpenAI-compatible API)
 * - llama.cpp server (OpenAI-compatible API)
 * - Any generic OpenAI-compatible endpoint
 *
 * Features:
 * - Streaming (SSE) responses with chunk callbacks
 * - Cancellation via AbortSignal
 * - Automatic endpoint resolution per backend
 */

import { fetchWithPolicy } from '@/lib/integrations/providerClient';
import { mapAIConnectionFailureMessage } from '@/lib/validation/settingsValidation';
import type { AIProvider, AIProviderConfig, AIRequest, AIResponse, CustomLlmBackend } from './types';

/* ------------------------------------------------------------------ */
/*  Default endpoints per backend                                      */
/* ------------------------------------------------------------------ */

export const CUSTOM_LLM_DEFAULTS: Record<CustomLlmBackend, { baseUrl: string; model: string; label: string }> = {
  ollama: { baseUrl: 'http://localhost:11434', model: 'narratryx:latest', label: 'Ollama' },
  vllm: { baseUrl: 'http://localhost:8000', model: 'narratryx', label: 'vLLM' },
  'llama-cpp': { baseUrl: 'http://localhost:8080', model: 'default', label: 'llama.cpp' },
  'generic-openai': { baseUrl: 'http://localhost:8000', model: 'default', label: 'Custom Endpoint' },
};

export const CUSTOM_LLM_BACKEND_LABELS: Record<CustomLlmBackend, string> = {
  ollama: 'Ollama',
  vllm: 'vLLM',
  'llama-cpp': 'llama.cpp',
  'generic-openai': 'Custom Endpoint',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function resolveEndpoint(backend: CustomLlmBackend, baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '');

  switch (backend) {
    case 'ollama':
      return `${base}/api/chat`;
    case 'vllm':
    case 'llama-cpp':
    case 'generic-openai':
      return `${base}/v1/chat/completions`;
  }
}

function buildSystemPrompt(projectType: 'book' | 'screenplay', sectionTitle?: string, action?: string): string {
  const docType = projectType === 'screenplay' ? 'screenplay' : 'novel';
  const sectionLabel = projectType === 'screenplay' ? 'scene' : 'chapter';
  const titleNote = sectionTitle ? ` The current ${sectionLabel} is titled "${sectionTitle}".` : '';

  if (action === 'grammar' || action === 'pipeline-grammar') {
    return `You are Narratryx, a meticulous proofreader and copy-editor for ${docType} manuscripts.${titleNote} Your task is to fix every grammar, spelling, and punctuation error while preserving the author's voice, style, and intent. Never add new content or change meaning. Output only the corrected text.`;
  }

  return `You are Narratryx, a creative writing assistant specialised in ${docType} writing.${titleNote} Respond in plain text with clear formatting. Focus on vivid prose, consistent character voice, and strong narrative structure.`;
}

function buildFullPrompt(request: AIRequest): string {
  const parts: string[] = [];

  // Context (includes story bible, continuity, blueprint, and chapter text)
  if (request.context) {
    const label = request.projectType === 'screenplay' ? 'scene' : 'chapter';
    parts.push(`Here is the current ${label} text and context:\n\n---\n${request.context}\n---`);
  }

  parts.push(request.prompt);
  return parts.join('\n\n');
}

/* ------------------------------------------------------------------ */
/*  Streaming parser                                                   */
/* ------------------------------------------------------------------ */

async function readStream(
  response: Response,
  backend: CustomLlmBackend,
  onChunk?: (chunk: string, accumulated: string) => void,
  signal?: AbortSignal,
): Promise<{ text: string; usage?: { promptTokens?: number; completionTokens?: number } }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const data = await response.json();
    return extractNonStreamResponse(data, backend);
  }

  const decoder = new TextDecoder();
  let accumulated = '';
  let usage: { promptTokens?: number; completionTokens?: number } | undefined;
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (backend === 'ollama') {
          // Ollama streams newline-delimited JSON
          if (!trimmed) continue;
          try {
            const parsed = JSON.parse(trimmed);
            const token = parsed.message?.content ?? '';
            if (token) {
              accumulated += token;
              onChunk?.(token, accumulated);
            }
            if (parsed.done && parsed.eval_count) {
              usage = { promptTokens: parsed.prompt_eval_count, completionTokens: parsed.eval_count };
            }
          } catch {
            // skip malformed lines
          }
        } else {
          // OpenAI-compatible SSE format (vLLM, llama.cpp, generic)
          if (!trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice('data: '.length);
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            const token = parsed.choices?.[0]?.delta?.content ?? '';
            if (token) {
              accumulated += token;
              onChunk?.(token, accumulated);
            }
            if (parsed.usage) {
              usage = {
                promptTokens: parsed.usage.prompt_tokens,
                completionTokens: parsed.usage.completion_tokens,
              };
            }
          } catch {
            // skip malformed SSE events
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { text: accumulated, usage };
}

function extractNonStreamResponse(
  data: Record<string, unknown>,
  backend: CustomLlmBackend,
): { text: string; usage?: { promptTokens?: number; completionTokens?: number } } {
  if (backend === 'ollama') {
    const msg = data as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
    const text = msg.message?.content;
    if (text === undefined || text === null) {
      throw new Error(`Unexpected response format from ${CUSTOM_LLM_BACKEND_LABELS[backend]}. Expected Ollama chat completion format with message.content field.`);
    }
    return {
      text,
      usage: msg.eval_count ? { promptTokens: msg.prompt_eval_count, completionTokens: msg.eval_count } : undefined,
    };
  }

  // OpenAI-compatible format
  const choices = data as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const text = choices.choices?.[0]?.message?.content;
  if (text === undefined || text === null) {
    throw new Error(`Unexpected response format from ${CUSTOM_LLM_BACKEND_LABELS[backend]}. Expected OpenAI-compatible chat completion format with choices[0].message.content field.`);
  }
  const usage = choices.usage
    ? { promptTokens: choices.usage.prompt_tokens, completionTokens: choices.usage.completion_tokens }
    : undefined;
  return { text, usage };
}

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fetch the list of available models from an Ollama server.
 * Returns an empty array on failure.
 */
export async function fetchOllamaModels(baseUrl: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}/api/tags`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    const models = data?.models;
    if (!Array.isArray(models)) return [];
    return models.map((m: { name?: string }) => m.name).filter(Boolean) as string[];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Test connectivity to a custom LLM backend.
 * Sends a minimal request and checks for a valid response.
 */
export async function testCustomLlmConnection(
  config: { backend: CustomLlmBackend; baseUrl: string; model: string; apiKey?: string },
): Promise<{ ok: boolean; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const endpoint = resolveEndpoint(config.backend, config.baseUrl);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey?.trim()) {
      headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    }

    let body: string;
    if (config.backend === 'ollama') {
      body = JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
        options: { num_predict: 4 },
      });
    } else {
      body = JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 4,
        stream: false,
      });
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const remediated = mapAIConnectionFailureMessage({
        status: res.status,
        errorText: errText || res.statusText,
      });
      return { ok: false, message: `${remediated} (HTTP ${res.status})` };
    }

    return { ok: true, message: `Connected to ${CUSTOM_LLM_BACKEND_LABELS[config.backend]} successfully.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const remediated = mapAIConnectionFailureMessage({ errorMessage: msg });
    if (msg.includes('abort')) {
      return { ok: false, message: `${remediated} (timed out after 15 seconds)` };
    }
    return { ok: false, message: remediated };
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------------------------------------------ */
/*  Provider class                                                     */
/* ------------------------------------------------------------------ */

export class CustomLlmProvider implements AIProvider {
  readonly type = 'custom-llm' as const;
  readonly supportsStreaming = true;

  constructor(private config: AIProviderConfig) {}

  isAvailable(): boolean {
    return !!(this.config.customLlm?.baseUrl?.trim() && this.config.customLlm?.model?.trim());
  }

  async execute(request: AIRequest): Promise<AIResponse> {
    const llmConfig = this.config.customLlm;
    if (!llmConfig?.baseUrl?.trim() || !llmConfig?.model?.trim()) {
      throw new Error('Custom LLM is not configured. Open Settings and configure your inference endpoint.');
    }

    const start = Date.now();
    const endpoint = resolveEndpoint(llmConfig.backend, llmConfig.baseUrl);
    const systemPrompt = buildSystemPrompt(request.projectType, request.sectionTitle, request.action);
    const fullPrompt = buildFullPrompt(request);
    const useStreaming = llmConfig.streaming !== false && !!request.onStreamChunk;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (llmConfig.apiKey?.trim()) {
      headers['Authorization'] = `Bearer ${llmConfig.apiKey.trim()}`;
    }

    let body: string;

    if (llmConfig.backend === 'ollama') {
      body = JSON.stringify({
        model: llmConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullPrompt },
        ],
        stream: useStreaming,
        options: {
          num_predict: llmConfig.maxTokens ?? 2048,
          temperature: llmConfig.temperature ?? 0.7,
        },
      });
    } else {
      body = JSON.stringify({
        model: llmConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: fullPrompt },
        ],
        max_tokens: llmConfig.maxTokens ?? 2048,
        temperature: llmConfig.temperature ?? 0.7,
        stream: useStreaming,
      });
    }

    const response = await fetchWithPolicy(endpoint, {
      method: 'POST',
      headers,
      body,
      signal: request.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      const backendLabel = CUSTOM_LLM_BACKEND_LABELS[llmConfig.backend];
      throw new Error(`${backendLabel} error (${response.status}): ${errorBody || response.statusText}`);
    }

    if (useStreaming) {
      const result = await readStream(response, llmConfig.backend, request.onStreamChunk, request.signal);
      return {
        text: result.text,
        provider: 'custom-llm',
        latencyMs: Date.now() - start,
        streamed: true,
        usage: result.usage,
      };
    }

    const data = await response.json();
    const result = extractNonStreamResponse(data, llmConfig.backend);

    return {
      text: result.text,
      provider: 'custom-llm',
      latencyMs: Date.now() - start,
      streamed: false,
      usage: result.usage,
    };
  }

  destroy(): void {
    // No resources to clean up
  }
}
