/**
 * Chrome Built-in AI provider (Gemini Nano, on-device).
 *
 * Routes preset writing actions to the most appropriate Chrome AI API
 * (Summarizer, Writer, Rewriter) and falls back to the general-purpose
 * Prompt API (LanguageModel) when a specialised API is unavailable.
 *
 * Sessions are created per-request and destroyed immediately after use
 * to avoid holding GPU/memory resources.
 */

import type { AIProvider, AIRequest, AIResponse } from './types';

/* ------------------------------------------------------------------ */
/*  Action → API routing                                               */
/* ------------------------------------------------------------------ */

type APIRoute = 'prompt' | 'summarizer' | 'writer' | 'rewriter';

const ACTION_ROUTES: Record<string, APIRoute> = {
  // Book presets
  continue: 'writer',
  alternatives: 'rewriter',
  summarize: 'summarizer',
  expand: 'writer',
  grammar: 'prompt',

  // Inline quick-actions
  continuation: 'writer',
  alternative: 'rewriter',
  rephrase: 'rewriter',
  strengthen: 'prompt',
  shorten: 'rewriter',
  style: 'prompt',

  // Screenplay presets
  dialogueAlternatives: 'prompt',
  tightenAction: 'rewriter',
  beatToDraft: 'writer',
  continuityPass: 'prompt',
  punchUp: 'prompt',
};

/** Maximum context length sent to Gemini Nano (chars). */
const MAX_CONTEXT_CHARS = 4000;

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export class ChromeAIProvider implements AIProvider {
  readonly type = 'chrome-ai' as const;

  isAvailable(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return typeof (globalThis as any).LanguageModel !== 'undefined';
  }

  async execute(request: AIRequest): Promise<AIResponse> {
    const start = Date.now();
    const route = ACTION_ROUTES[request.action] || 'prompt';

    // Truncate context for the smaller on-device model
    const trimmedContext = request.context.slice(-MAX_CONTEXT_CHARS);
    const req: AIRequest = { ...request, context: trimmedContext };

    let text: string;

    try {
      switch (route) {
        case 'summarizer':
          text = await this.useSummarizer(req);
          break;
        case 'writer':
          text = await this.useWriter(req);
          break;
        case 'rewriter':
          text = await this.useRewriter(req);
          break;
        default:
          text = await this.usePromptAPI(req);
      }
    } catch {
      // Fallback: if the specialised API fails, try the Prompt API
      text = await this.usePromptAPI(req);
    }

    return { text, provider: 'chrome-ai', latencyMs: Date.now() - start };
  }

  destroy(): void {
    // No persistent sessions held
  }

  /* ------ Prompt API (LanguageModel) -------------------------------- */

  private async usePromptAPI(request: AIRequest): Promise<string> {
    const systemPrompt = `You are a creative writing assistant for ${
      request.projectType === 'screenplay' ? 'screenplays' : 'books'
    }. Respond concisely with clear formatting.`;

    const session = await LanguageModel.create({ systemPrompt });
    try {
      const fullPrompt = request.context
        ? `Context:\n${request.context}\n\n---\n\n${request.prompt}`
        : request.prompt;
      return await session.prompt(fullPrompt, { signal: request.signal });
    } finally {
      session.destroy();
    }
  }

  /* ------ Summarizer ------------------------------------------------ */

  private async useSummarizer(request: AIRequest): Promise<string> {
    const summarizer = await Summarizer.create({
      type: 'key-points',
      format: 'markdown',
      length: 'medium',
    });
    try {
      return await summarizer.summarize(
        request.context || request.prompt,
        { signal: request.signal },
      );
    } finally {
      summarizer.destroy();
    }
  }

  /* ------ Writer ---------------------------------------------------- */

  private async useWriter(request: AIRequest): Promise<string> {
    const isShort = request.action === 'continue' || request.action === 'continuation';
    const writer = await Writer.create({
      tone: 'neutral',
      format: 'plain-text',
      length: isShort ? 'short' : 'medium',
    });
    try {
      const writingPrompt = request.context
        ? `${request.prompt}\n\nContext:\n${request.context}`
        : request.prompt;
      return await writer.write(writingPrompt, { signal: request.signal });
    } finally {
      writer.destroy();
    }
  }

  /* ------ Rewriter -------------------------------------------------- */

  private async useRewriter(request: AIRequest): Promise<string> {
    const length: 'shorter' | 'longer' | 'as-is' =
      request.action === 'shorten'
        ? 'shorter'
        : request.action === 'expand'
          ? 'longer'
          : 'as-is';

    const rewriter = await Rewriter.create({
      tone: 'as-is',
      format: 'plain-text',
      length,
    });
    try {
      // The Rewriter takes the text to rewrite as the first argument
      // and uses `context` for the instruction / guidance.
      const textToRewrite = request.context || request.prompt;
      return await rewriter.rewrite(textToRewrite, {
        signal: request.signal,
        context: request.prompt,
      });
    } finally {
      rewriter.destroy();
    }
  }
}
