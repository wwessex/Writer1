import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dialog, Button, Input, Textarea } from '@/components/UI';
import { useToast } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { editorToPlainText } from '@/lib/utils';
import { formatContinuityContext, getContinuityMemorySnapshot } from '@/lib/continuityMemory';
import {
  loadAIConfig,
  saveAIConfig,
  createProvider,
  isChromeAIAvailable,
  checkChromeAIAvailability,
  detectBestProvider,
  isChromeBrowser,
  SERVER_PROXY_ENDPOINTS,
  SERVER_PROXY_MODELS,
  SERVER_PROXY_LABELS,
  CUSTOM_LLM_DEFAULTS,
  CUSTOM_LLM_BACKEND_LABELS,
  fetchOllamaModels,
  assembleStoryBibleContext,
  runEvalSuite,
  saveEvalResult,
} from '@/lib/ai';
import { getContinuityMemorySnapshot as getContinuitySnapshot } from '@/lib/continuityMemory';
import { getBrokerBaseUrl, getBrokerEndpoint } from '@/lib/featureFlags';
import { recordAIRevision } from '@/lib/aiRevisionLog';
import {
  AI_WRITING_PIPELINE_STAGES,
  applyInsertionMode,
  renderPipelinePrompt,
  type PipelineInsertionMode,
} from '@/lib/ai/pipelines';
import type { AIProviderConfig, AvailabilityStatus, EvalSuiteResult } from '@/lib/ai';
import type { ProjectType, StoryBlueprint } from '@/types';
import styles from '../Modals.module.css';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AIWritingModalProps {
  open: boolean;
  onClose: () => void;
}

interface PresetPrompt {
  id: string;
  label: string;
  icon: string;
  prompt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BOOK_PRESET_PROMPTS: PresetPrompt[] = [
  {
    id: 'continue',
    label: 'Continue Writing',
    icon: 'edit_note',
    prompt:
      'Continue writing from where the text left off. Match the tone, style, and pacing of the existing prose. Write the next few paragraphs.'
  },
  {
    id: 'alternatives',
    label: 'Suggest Alternatives',
    icon: 'swap_horiz',
    prompt:
      'Suggest three alternative ways to rewrite the last paragraph of the text. Keep the same meaning but vary the style, word choice, and sentence structure.'
  },
  {
    id: 'summarize',
    label: 'Summarise',
    icon: 'summarize',
    prompt:
      'Provide a concise summary of the chapter text. Highlight the key events, character developments, and themes.'
  },
  {
    id: 'expand',
    label: 'Expand',
    icon: 'unfold_more',
    prompt:
      'Expand on the last section of the text. Add more descriptive detail, sensory language, and internal character thought to deepen the scene.'
  },
  {
    id: 'grammar',
    label: 'Fix Grammar',
    icon: 'spellcheck',
    prompt:
      'Proofread and correct every grammar, spelling, and punctuation error in the text. Fix homophones (their/there/they\'re, its/it\'s, your/you\'re), subject-verb agreement, missing or incorrect apostrophes, and run-on sentences. List each correction as: "[original] \u2192 [corrected] (reason)". Do not change meaning or style.'
  }
];

const SCREENPLAY_PRESET_PROMPTS: PresetPrompt[] = [
  {
    id: 'dialogueAlternatives',
    label: 'Generate Dialogue Alternatives',
    icon: 'record_voice_over',
    prompt:
      'Generate scene dialogue alternatives for the latest dialogue exchange. Keep each option true to the character voices and scene tension.'
  },
  {
    id: 'tightenAction',
    label: 'Tighten Action Lines',
    icon: 'compress',
    prompt:
      'Tighten action lines in this scene for pace and clarity. Keep visual language concise, cinematic, and production-ready.'
  },
  {
    id: 'beatToDraft',
    label: 'Beat Outline to Scene Draft',
    icon: 'movie',
    prompt:
      'Turn this beat outline into a screenplay scene draft. Preserve the scene objective, escalate conflict, and include action + dialogue blocks.'
  },
  {
    id: 'continuityPass',
    label: 'Continuity Check',
    icon: 'rule',
    prompt:
      'Review this scene for screenplay continuity issues (character intent, props, entrances/exits, timing). List issues and propose fixes.'
  },
  {
    id: 'punchUp',
    label: 'Punch Up Scene',
    icon: 'bolt',
    prompt:
      'Punch up this scene with stronger subtext and sharper turns while preserving story intent and character objectives.'
  }
];

/* ------------------------------------------------------------------ */
/*  Well-known OpenAI-compatible endpoint presets                       */
/* ------------------------------------------------------------------ */

interface EndpointPreset {
  id: string;
  label: string;
  endpoint: string;
  defaultModel: string;
  keyPlaceholder: string;
  signupUrl: string;
}

const ENDPOINT_PRESETS: EndpointPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o',
    keyPlaceholder: 'sk-...',
    signupUrl: 'platform.openai.com',
  },
  {
    id: 'groq',
    label: 'Groq',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    keyPlaceholder: 'gsk_...',
    signupUrl: 'console.groq.com',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'google/gemini-2.0-flash-exp:free',
    keyPlaceholder: 'sk-or-...',
    signupUrl: 'openrouter.ai',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    defaultModel: 'mistral-large-latest',
    keyPlaceholder: 'api key',
    signupUrl: 'console.mistral.ai',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    keyPlaceholder: 'sk-...',
    signupUrl: 'platform.deepseek.com',
  },
  {
    id: 'together',
    label: 'Together AI',
    endpoint: 'https://api.together.xyz/v1/chat/completions',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    keyPlaceholder: 'api key',
    signupUrl: 'api.together.ai',
  },
];

/** Match a config endpoint to a known preset (or return empty string). */
function matchPresetId(endpoint?: string): string {
  if (!endpoint?.trim()) return '';
  const normalized = endpoint.trim().replace(/\/$/, '');
  return ENDPOINT_PRESETS.find(p => p.endpoint === normalized)?.id ?? '';
}

const BOOK_CHAPTER_TEMPLATE = `# Chapter Title

## Scene Goal
- What changes by the end of this chapter?

## Opening Beat
Set the location, mood, and immediate conflict.

## Complication
Escalate pressure with a choice, reveal, or obstacle.

## Turning Point
Land the emotional or plot shift that propels the next section.`;

const SCREENPLAY_SCENE_TEMPLATE = `INT./EXT. LOCATION - DAY/NIGHT

Action: Describe only what is visible and audible on screen.

CHARACTER NAME
Dialogue line.

CHARACTER NAME
(optional parenthetical)
Response line.

Action: End on a visual turn, reveal, or decision.`;


function formatStoryBlueprintContext(storyBlueprint: StoryBlueprint | null): string {
  if (!storyBlueprint) return '';
  return [
    'Story Blueprint Constraints:',
    `- Genre/Subgenre: ${storyBlueprint.genre || 'Unspecified'} / ${storyBlueprint.subgenre || 'Unspecified'}`,
    `- Target audience / age band: ${storyBlueprint.targetAudience || 'Unspecified'} / ${storyBlueprint.ageBand || 'Unspecified'}`,
    `- Tone / voice: ${storyBlueprint.tone || 'Unspecified'} / ${storyBlueprint.voice || 'Unspecified'}`,
    `- Structure: ${storyBlueprint.structure}`,
    `- Target word count: ${storyBlueprint.targetWordCount || 0}`,
    `- Pacing profile: ${storyBlueprint.pacingProfile}`,
    'Apply these constraints consistently in all outputs unless explicitly overridden by user prompt.'
  ].join('\n');
}

function getPresetPrompts(projectType: ProjectType): PresetPrompt[] {
  return projectType === 'screenplay' ? SCREENPLAY_PRESET_PROMPTS : BOOK_PRESET_PROMPTS;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AIWritingModal({ open, onClose }: AIWritingModalProps) {
  const { activeChapter, state, updateChapter } = useApp();
  const { showToast } = useToast();
  const isScreenplay = state.projectType === 'screenplay';
  const presetPrompts = useMemo(() => getPresetPrompts(state.projectType), [state.projectType]);

  // AI configuration (provider-aware)
  const [config, setConfig] = useState<AIProviderConfig>(loadAIConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [showCustomProvider, setShowCustomProvider] = useState(false);
  const [ollamaModelList, setOllamaModelList] = useState<string[]>([]);

  // Fetch Ollama models when backend is ollama and baseUrl is set
  useEffect(() => {
    if (config.provider === 'custom-llm' && config.customLlm?.backend === 'ollama' && config.customLlm.baseUrl?.trim()) {
      fetchOllamaModels(config.customLlm.baseUrl).then(setOllamaModelList).catch(() => setOllamaModelList([]));
    } else {
      setOllamaModelList([]);
    }
  }, [config.provider, config.customLlm?.backend, config.customLlm?.baseUrl]);

  // Chrome AI availability
  const [chromeAIAvailable, setChromeAIAvailable] = useState(false);
  const [chromeAIStatus, setChromeAIStatus] = useState<AvailabilityStatus>('unknown');

  // Prompt / response state
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeToneMatchPass, setIncludeToneMatchPass] = useState(false);
  const [pipelineModes, setPipelineModes] = useState<Record<string, PipelineInsertionMode>>({
    'beat-to-scene': 'replace',
    expansion: 'replace',
    dialogue: 'replace',
    grammar: 'replace',
    tone: 'replace',
  });

  // Streaming state
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Eval state
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalResult, setEvalResult] = useState<EvalSuiteResult | null>(null);

  // Ref for aborting in-flight requests
  const abortRef = useRef<AbortController | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  // Persist config changes
  const updateConfig = useCallback((updates: Partial<AIProviderConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      // Auto-switch to openai-compatible when both endpoint and key are provided
      if (next.endpoint?.trim() && next.sessionToken?.trim() && next.provider !== 'server-proxy') {
        next.provider = 'openai-compatible';
      }
      saveAIConfig(next);
      return next;
    });
    setConnectionResult(null);
  }, []);

  // Detect Chrome AI availability on mount
  useEffect(() => {
    isChromeAIAvailable().then(available => {
      setChromeAIAvailable(available);
      if (available) {
        checkChromeAIAvailability().then(result => {
          // Use the best status across all APIs
          const statuses = Object.values(result);
          if (statuses.includes('available')) setChromeAIStatus('available');
          else if (statuses.includes('downloading')) setChromeAIStatus('downloading');
          else if (statuses.includes('downloadable')) setChromeAIStatus('downloadable');
          else setChromeAIStatus('unavailable');
        });
      } else {
        setChromeAIStatus('unavailable');
      }
    });
  }, []);

  /* ----- Provider logic --------------------------------------------- */

  const isConfigured =
    config.provider === 'custom-llm'
      ? !!(config.customLlm?.baseUrl?.trim() && config.customLlm?.model?.trim())
      : config.provider === 'server-proxy'
        ? !!(config.serverProxy?.serverProvider && config.serverProxy?.model &&
             (config.serverProxy.userApiKey?.trim() || getBrokerBaseUrl()))
        : config.provider === 'openai-compatible'
          ? !!(config.endpoint?.trim() && config.sessionToken?.trim())
          : config.provider === 'chrome-ai'
            ? chromeAIAvailable
            : /* managed-cloud */ !!getBrokerBaseUrl();

  // Reset transient state when the modal opens/closes
  useEffect(() => {
    if (open) {
      // Reload config from localStorage (may have been updated in Settings)
      const freshConfig = loadAIConfig();
      setConfig(freshConfig);
      setResponse('');
      setError(null);
      setPrompt('');
      setLoading(false);
    } else {
      abortRef.current?.abort();
    }
  }, [open]);


  useEffect(() => {
    if (config.provider === 'openai-compatible' || config.provider === 'server-proxy') {
      return;
    }

    detectBestProvider().then(bestProvider => {
      setConfig(prev => {
        if (prev.provider === 'openai-compatible' || prev.provider === 'server-proxy' || prev.provider === bestProvider) {
          return prev;
        }
        const next = { ...prev, provider: bestProvider };
        saveAIConfig(next);
        return next;
      });
    });
  }, [chromeAIAvailable, config.provider]);

  // Scroll response area when new content arrives
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  const sendPrompt = useCallback(
    async (promptText: string, presetId?: string) => {
      if (!promptText.trim()) return;

      if (!isConfigured) {
        if (config.provider === 'server-proxy') {
          const providerName = SERVER_PROXY_LABELS[config.serverProxy?.serverProvider ?? 'groq'];
          setError(`${providerName} is not configured yet. Open Settings below, select ${providerName}, and paste your API key.`);
        } else if (config.provider === 'openai-compatible' && config.endpoint?.trim() && !config.sessionToken?.trim()) {
          setError('API key is missing. Open Settings below and paste your API key in the Custom provider section.');
        } else {
          setError('AI is not configured yet. Open Settings below, pick a provider, and paste your API key.');
        }
        return;
      }

      const chapterText = activeChapter
        ? editorToPlainText(activeChapter.content)
        : '';
      const continuitySnapshot = getContinuityMemorySnapshot(state.novelId, state.chapters);
      const continuityContext = formatContinuityContext(continuitySnapshot);
      const blueprintContext = formatStoryBlueprintContext(state.storyBlueprint);
      const enrichedContext = [blueprintContext, continuityContext, chapterText].filter(Boolean).join('\n\n');

      // Build Story Bible context for custom LLM
      const storyBibleContext = config.provider === 'custom-llm'
        ? assembleStoryBibleContext(
            state.novelId,
            state.chapters,
            state.activeChapterId,
            getContinuitySnapshot(state.novelId, state.chapters),
          )
        : undefined;

      // Abort any previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setResponse('');
      setStreamingText('');
      setIsStreaming(false);

      const provider = createProvider(config);
      const useStreaming = config.provider === 'custom-llm' && config.customLlm?.streaming !== false;

      try {
        const result = await provider.execute({
          action: presetId || 'custom',
          prompt: promptText,
          context: enrichedContext,
          projectType: state.projectType,
          sectionTitle: activeChapter?.title,
          signal: controller.signal,
          storyBibleContext,
          onStreamChunk: useStreaming
            ? (_chunk, accumulated) => {
                setIsStreaming(true);
                setStreamingText(accumulated);
              }
            : undefined,
        });

        setIsStreaming(false);
        setStreamingText('');
        setResponse(result.text);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred.';
        setError(message);
      } finally {
        setLoading(false);
        setIsStreaming(false);
        provider.destroy();
      }
    },
    [activeChapter, config, isConfigured, state.projectType, state.chapters, state.novelId, state.storyBlueprint, state.activeChapterId]
  );


  const handleRunPipeline = useCallback(async () => {
    if (!isConfigured) {
      setError('Configure AI first before running the writing pipeline.');
      return;
    }

    const chapterText = activeChapter ? editorToPlainText(activeChapter.content) : '';
    const continuitySnapshot = getContinuityMemorySnapshot(state.novelId, state.chapters);
    const continuityContext = formatContinuityContext(continuitySnapshot);
    const blueprintContext = formatStoryBlueprintContext(state.storyBlueprint);
    const enrichedContext = [blueprintContext, continuityContext, chapterText].filter(Boolean).join('\n\n');

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResponse('');

    const provider = createProvider(config);
    const stages = AI_WRITING_PIPELINE_STAGES.filter(stage => includeToneMatchPass || !stage.optional);
    const stageLogs: Array<{ stageId: string; label: string; action: string; insertionMode: PipelineInsertionMode }> = [];

    try {
      let workingDraft = chapterText;
      for (const stage of stages) {
        const stagePrompt = renderPipelinePrompt(stage.promptTemplate, {
          chapterText,
          currentDraft: workingDraft,
          userPrompt: prompt,
          toneReference: state.storyBlueprint?.tone || state.storyBlueprint?.voice || '',
        });

        const result = await provider.execute({
          action: stage.action,
          prompt: stagePrompt,
          context: enrichedContext,
          projectType: state.projectType,
          sectionTitle: activeChapter?.title,
          signal: controller.signal,
        });

        const insertionMode = pipelineModes[stage.id] || 'replace';
        workingDraft = applyInsertionMode(workingDraft, result.text, insertionMode);
        stageLogs.push({
          stageId: stage.id,
          label: stage.label,
          action: stage.action,
          insertionMode,
        });
      }

      setResponse(workingDraft);
      if (activeChapter) {
        recordAIRevision({
          novelId: state.novelId,
          chapterId: activeChapter.id,
          chapterTitle: activeChapter.title,
          pipelineLabel: 'AI Writing Pipeline',
          beforeText: chapterText,
          afterText: workingDraft,
          stages: stageLogs,
        });
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof Error ? err.message : 'Pipeline run failed.';
      setError(message);
    } finally {
      setLoading(false);
      provider.destroy();
    }
  }, [activeChapter, config, includeToneMatchPass, isConfigured, pipelineModes, prompt, state.chapters, state.novelId, state.projectType, state.storyBlueprint]);

  const handleSubmit = () => {
    sendPrompt(prompt);
  };

  const handlePreset = (preset: PresetPrompt) => {
    setPrompt(preset.prompt);
    sendPrompt(preset.prompt, preset.id);
  };

  const handleCopyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(response).then(() => {
        showToast('Response copied to clipboard', 'success', 'content_copy');
      }).catch(() => {
        showToast('Failed to copy to clipboard', 'error');
      });
    }
  };

  const handleInsertResponse = () => {
    if (!activeChapter || !response.trim()) return;
    const chapterText = editorToPlainText(activeChapter.content);
    updateChapter(activeChapter.id, { content: response });
    recordAIRevision({
      novelId: state.novelId,
      chapterId: activeChapter.id,
      chapterTitle: activeChapter.title,
      pipelineLabel: 'AI Insert Response',
      beforeText: chapterText,
      afterText: response,
      stages: [],
    });
    showToast('AI output inserted into chapter', 'success', 'check');
  };

  const handleTestConnection = async () => {
    if (!config.endpoint?.trim() || !config.sessionToken?.trim()) {
      setConnectionResult({ type: 'warning', message: 'Enter both an API endpoint and API key first' });
      return;
    }
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const res = await fetch(config.endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.sessionToken!.trim()}`
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o',
          messages: [
            { role: 'user', content: 'Say "Connection successful" in exactly two words.' }
          ],
          max_tokens: 10
        }),
        signal: (() => {
          const controller = new AbortController();
          setTimeout(() => controller.abort(), 10000);
          return controller.signal;
        })()
      });

      if (res.ok) {
        setConnectionResult({ type: 'success', message: 'Connection successful' });
      } else {
        const body = await res.text().catch(() => '');
        setConnectionResult({ type: 'error', message: `Connection failed (${res.status}): ${body.slice(0, 100) || res.statusText}` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setConnectionResult({ type: 'error', message: `Connection failed: ${message}` });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestServerProxy = async () => {
    if (!config.serverProxy?.model || !config.serverProxy?.serverProvider) {
      setConnectionResult({ type: 'warning', message: 'Select a provider and model first' });
      return;
    }
    setTestingConnection(true);
    setConnectionResult(null);

    const { serverProvider, model, userApiKey } = config.serverProxy;
    const hasUserKey = !!userApiKey?.trim();
    const hasBroker = !!getBrokerBaseUrl();

    const abortSignal = (() => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 15000);
      return controller.signal;
    })();

    try {
      // Direct API call when user provides their own key
      if (hasUserKey) {
        let res: Response;

        if (serverProvider === 'gemini') {
          const endpoint = `${SERVER_PROXY_ENDPOINTS.gemini}/${model}:generateContent?key=${encodeURIComponent(userApiKey!.trim())}`;
          res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Say "Connection successful" in exactly two words.' }] }],
              generationConfig: { maxOutputTokens: 10 },
            }),
            signal: abortSignal,
          });
        } else {
          const endpoint = SERVER_PROXY_ENDPOINTS[serverProvider];
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userApiKey!.trim()}`,
          };
          if (serverProvider === 'openrouter') {
            headers['HTTP-Referer'] = window.location.origin;
            headers['X-Title'] = 'DraftHarbour Studio';
          }
          res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'Say "Connection successful" in exactly two words.' }],
              max_tokens: 10,
            }),
            signal: abortSignal,
          });
        }

        if (res.ok) {
          setConnectionResult({ type: 'success', message: `Direct connection to ${SERVER_PROXY_LABELS[serverProvider]} successful` });
        } else {
          const body = await res.text().catch(() => '');
          setConnectionResult({ type: 'error', message: `Connection failed (${res.status}): ${(body || res.statusText).slice(0, 100)}` });
        }
        return;
      }

      // Fall back to broker proxy
      if (!hasBroker) {
        setConnectionResult({ type: 'warning', message: 'Enter your API key to connect directly, or configure a broker URL.' });
        return;
      }

      const body: Record<string, unknown> = {
        provider: serverProvider,
        model,
        prompt: 'Say "Connection successful" in exactly two words.',
        projectType: 'book',
      };
      const res = await fetch(getBrokerEndpoint('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: abortSignal,
      });
      if (res.ok) {
        setConnectionResult({ type: 'success', message: 'Connection successful' });
      } else {
        const errBody = await res.json().catch(() => ({})) as { message?: string; error?: string };
        const detail = errBody.message || errBody.error || res.statusText;
        if (res.status === 404) {
          setConnectionResult({ type: 'error', message: 'Proxy not found (404). Enter your own API key above to connect directly.' });
          return;
        }
        setConnectionResult({ type: 'error', message: `Connection failed (${res.status}): ${detail.slice(0, 100)}` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setConnectionResult({ type: 'error', message: `Connection failed: ${message}` });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRunEval = useCallback(async () => {
    if (!isConfigured) {
      setError('Configure AI first before running evaluation.');
      return;
    }
    setEvalRunning(true);
    setEvalResult(null);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    const provider = createProvider(config);

    try {
      const result = await runEvalSuite(
        provider,
        config.customLlm?.model || config.model || 'unknown',
        undefined,
        undefined,
        controller.signal,
      );
      setEvalResult(result);
      saveEvalResult(result);
      showToast(
        `Eval complete: ${(result.overallScore * 100).toFixed(0)}% score, ${result.recommendation}`,
        result.recommendation === 'ready' ? 'success' : 'info',
      );
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Evaluation failed.');
    } finally {
      setEvalRunning(false);
      provider.destroy();
    }
  }, [config, isConfigured, showToast]);

  const handleTestCustomLlm = async () => {
    if (!config.customLlm?.baseUrl?.trim() || !config.customLlm?.model?.trim()) {
      setConnectionResult({ type: 'warning', message: 'Enter both a base URL and model name first' });
      return;
    }
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const provider = createProvider(config);
      const result = await provider.execute({
        action: 'custom',
        prompt: 'Say "Connection successful" in exactly two words.',
        context: '',
        projectType: 'book',
        signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 15000); return c.signal; })(),
      });
      if (result.text) {
        setConnectionResult({ type: 'success', message: `Connected to ${CUSTOM_LLM_BACKEND_LABELS[config.customLlm.backend]} (${result.latencyMs}ms)` });
      } else {
        setConnectionResult({ type: 'error', message: 'Empty response from model' });
      }
      provider.destroy();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setConnectionResult({ type: 'error', message: `Connection failed: ${message}` });
    } finally {
      setTestingConnection(false);
    }
  };

  /* ----- Helpers ---------------------------------------------------- */

  const providerModeLabel =
    config.provider === 'chrome-ai' ? 'Using local AI'
    : config.provider === 'custom-llm'
      ? `Using ${CUSTOM_LLM_BACKEND_LABELS[config.customLlm?.backend ?? 'ollama']}`
      : config.provider === 'server-proxy'
        ? `Using ${SERVER_PROXY_LABELS[config.serverProxy?.serverProvider ?? 'groq']}`
        : config.provider === 'openai-compatible'
          ? 'Using custom provider'
          : 'Using cloud AI';
  const providerLabel = `AI ready · ${providerModeLabel}`;
  const providerIcon =
    config.provider === 'chrome-ai' ? 'memory'
    : config.provider === 'custom-llm' ? 'smart_toy'
    : config.provider === 'server-proxy' ? 'dns'
    : 'cloud';

  /* ----- Render ----------------------------------------------------- */

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="AI Writing Tools"
      size="large"
      footer={
        <div className={styles.aiFooter}>
          <div className={styles.aiFooterLeft}>
            <Button
              variant="ghost"
              onClick={() => setShowSettings(s => !s)}
            >
              <span className="material-symbols-rounded">settings</span>
              {showSettings ? 'Hide Settings' : 'Settings'}
            </Button>
            <span className={styles.aiProviderIndicator}>
              <span className="material-symbols-rounded">{providerIcon}</span>
              {providerLabel}
            </span>
          </div>
          <div className={styles.aiFooterRight}>
            {response && (
              <>
                <Button variant="ghost" onClick={handleCopyResponse}>
                  <span className="material-symbols-rounded">content_copy</span>
                  Copy
                </Button>
                <Button variant="ghost" onClick={handleInsertResponse}>
                  <span className="material-symbols-rounded">edit_document</span>
                  Insert to Chapter
                </Button>
              </>
            )}
            <Button
              variant="default"
              onClick={handleRunPipeline}
              disabled={loading}
            >
              <span className="material-symbols-rounded">pipeline</span>
              {loading ? 'Running pipeline...' : 'Run Pipeline'}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={loading || !prompt.trim()}
            >
              <span className="material-symbols-rounded">send</span>
              {loading ? 'Generating...' : 'Send'}
            </Button>
          </div>
        </div>
      }
    >
      {/* Settings panel (collapsible) */}
      {showSettings && (
        <div className={styles.aiSettings}>
          <h4>
            <span className="material-symbols-rounded">tune</span>
            AI Configuration
          </h4>

          <div className={styles.aiPrivacyNote}>
            <span className="material-symbols-rounded">auto_awesome</span>
            <span>
              {config.provider === 'chrome-ai'
                ? 'Using local AI. Chrome built-in models run directly on your device when available.'
                : config.provider === 'server-proxy'
                  ? config.serverProxy?.userApiKey?.trim()
                    ? `Using ${SERVER_PROXY_LABELS[config.serverProxy?.serverProvider ?? 'groq']}. Requests are sent directly to the provider API with your key.`
                    : `Using ${SERVER_PROXY_LABELS[config.serverProxy?.serverProvider ?? 'groq']}. Requests are routed through the DraftHarbour server proxy.`
                  : config.provider === 'openai-compatible'
                    ? 'Using a custom OpenAI-compatible provider. Requests are sent directly to your configured API endpoint.'
                    : 'Using cloud AI. Requests are routed through the managed DraftHarbour cloud endpoint.'}
            </span>
          </div>

          <div className={styles.aiPrivacyNote}>
            <span className="material-symbols-rounded">shield</span>
            <span>
              {chromeAIAvailable
                ? 'Chrome AI detected. Writer will prefer local AI automatically.'
                : isChromeBrowser()
                  ? 'Chrome AI is not yet available on this device. Enable "Optimization Guide On Device Model" in chrome://flags and restart Chrome.'
                  : 'Chrome AI requires Google Chrome. To use AI features in this browser, set up a server provider or custom provider below.'}
            </span>
          </div>

          {/* Server AI providers (Groq / OpenRouter / Gemini) */}
          <div className={styles.aiProviderSelector}>
            <h5>Server AI Providers</h5>
            <p className={styles.aiSettingsHint}>
              Enter your API key to connect directly, or leave blank to use the server proxy if available.
            </p>
            <div className={styles.aiProviderOptions}>
              {(['groq', 'openrouter', 'gemini'] as const).map(sp => (
                <button
                  key={sp}
                  className={`${styles.aiProviderOption} ${
                    config.provider === 'server-proxy' && config.serverProxy?.serverProvider === sp
                      ? styles['aiProviderOption--active'] : ''
                  }`}
                  onClick={() => {
                    const defaultModel = SERVER_PROXY_MODELS[sp][0].id;
                    updateConfig({
                      provider: 'server-proxy',
                      serverProxy: {
                        serverProvider: sp,
                        model: config.serverProxy?.serverProvider === sp
                          ? (config.serverProxy.model || defaultModel)
                          : defaultModel,
                        userApiKey: config.serverProxy?.userApiKey,
                      },
                    });
                  }}
                >
                  <span className="material-symbols-rounded">dns</span>
                  <div className={styles.aiProviderOptionText}>
                    <strong>{SERVER_PROXY_LABELS[sp]}</strong>
                    <small>Server-managed</small>
                  </div>
                </button>
              ))}
            </div>

            {config.provider === 'server-proxy' && config.serverProxy && (
              <div className={styles.aiSettingsFields}>
                <label className={styles.aiLabel}>
                  Model
                  <select
                    value={config.serverProxy.model}
                    onChange={e => updateConfig({
                      serverProxy: { ...config.serverProxy!, model: e.target.value },
                    })}
                    className={styles.aiSelect}
                  >
                    {SERVER_PROXY_MODELS[config.serverProxy.serverProvider].map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.aiLabel}>
                  Your API Key
                  <Input
                    type="password"
                    placeholder="Enter your API key to connect directly..."
                    value={config.serverProxy.userApiKey || ''}
                    onChange={e => updateConfig({
                      serverProxy: { ...config.serverProxy!, userApiKey: e.target.value },
                    })}
                  />
                </label>
              </div>
            )}

            {config.provider === 'server-proxy' && (
              <>
                <div className={styles.aiSettingsActions}>
                  <Button
                    variant="default"
                    size="small"
                    onClick={() => handleTestServerProxy()}
                    disabled={testingConnection || !config.serverProxy?.model}
                  >
                    <span className="material-symbols-rounded">wifi_tethering</span>
                    {testingConnection ? 'Testing...' : 'Test Connection'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="small"
                    onClick={() => updateConfig({ provider: chromeAIAvailable ? 'chrome-ai' : 'managed-cloud' })}
                  >
                    Use Automatic Mode
                  </Button>
                </div>
                {connectionResult && (
                  <div className={`${styles.aiConnectionResult} ${styles[`aiConnectionResult--${connectionResult.type}`]}`}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                      {connectionResult.type === 'success' ? 'check_circle' : connectionResult.type === 'error' ? 'error' : 'warning'}
                    </span>
                    {connectionResult.message}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Custom LLM (Ollama / vLLM / llama.cpp) */}
          <div className={styles.aiProviderSelector}>
            <h5>Custom LLM (Local / Self-hosted)</h5>
            <p className={styles.aiSettingsHint}>
              Connect to your own model running via Ollama, vLLM, llama.cpp, or any OpenAI-compatible server.
            </p>
            <div className={styles.aiProviderOptions}>
              {(['ollama', 'vllm', 'llama-cpp', 'generic-openai'] as const).map(backend => (
                <button
                  key={backend}
                  className={`${styles.aiProviderOption} ${
                    config.provider === 'custom-llm' && config.customLlm?.backend === backend
                      ? styles['aiProviderOption--active'] : ''
                  }`}
                  onClick={() => {
                    const defaults = CUSTOM_LLM_DEFAULTS[backend];
                    updateConfig({
                      provider: 'custom-llm',
                      customLlm: {
                        backend,
                        baseUrl: config.customLlm?.backend === backend
                          ? (config.customLlm.baseUrl || defaults.baseUrl)
                          : defaults.baseUrl,
                        model: config.customLlm?.backend === backend
                          ? (config.customLlm.model || defaults.model)
                          : defaults.model,
                        apiKey: config.customLlm?.apiKey,
                        streaming: config.customLlm?.streaming ?? true,
                        maxTokens: config.customLlm?.maxTokens ?? 2048,
                        temperature: config.customLlm?.temperature ?? 0.7,
                        fallbackProvider: config.customLlm?.fallbackProvider,
                      },
                    });
                  }}
                >
                  <span className="material-symbols-rounded">smart_toy</span>
                  <div className={styles.aiProviderOptionText}>
                    <strong>{CUSTOM_LLM_BACKEND_LABELS[backend]}</strong>
                    <small>{CUSTOM_LLM_DEFAULTS[backend].baseUrl}</small>
                  </div>
                </button>
              ))}
            </div>

            {config.provider === 'custom-llm' && config.customLlm && (
              <div className={styles.aiSettingsFields}>
                <label className={styles.aiLabel}>
                  Base URL
                  <Input
                    placeholder={CUSTOM_LLM_DEFAULTS[config.customLlm.backend].baseUrl}
                    value={config.customLlm.baseUrl || ''}
                    onChange={e => updateConfig({
                      customLlm: { ...config.customLlm!, baseUrl: e.target.value },
                    })}
                  />
                </label>
                <label className={styles.aiLabel}>
                  Model
                  {ollamaModelList.length > 0 ? (
                    <select
                      value={ollamaModelList.includes(config.customLlm.model || '') ? config.customLlm.model : '__custom__'}
                      onChange={e => {
                        if (e.target.value !== '__custom__') {
                          updateConfig({ customLlm: { ...config.customLlm!, model: e.target.value } });
                        }
                      }}
                      className={styles.aiSelect}
                    >
                      {ollamaModelList.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                      <option value="__custom__">Custom...</option>
                    </select>
                  ) : (
                    <Input
                      placeholder={CUSTOM_LLM_DEFAULTS[config.customLlm.backend].model}
                      value={config.customLlm.model || ''}
                      onChange={e => updateConfig({
                        customLlm: { ...config.customLlm!, model: e.target.value },
                      })}
                    />
                  )}
                </label>
                <label className={styles.aiLabel}>
                  API Key (optional)
                  <Input
                    type="password"
                    placeholder="Leave blank if not required"
                    value={config.customLlm.apiKey || ''}
                    onChange={e => updateConfig({
                      customLlm: { ...config.customLlm!, apiKey: e.target.value },
                    })}
                  />
                </label>
                <label className={styles.aiLabel}>
                  <input
                    type="checkbox"
                    checked={config.customLlm.streaming !== false}
                    onChange={e => updateConfig({
                      customLlm: { ...config.customLlm!, streaming: e.target.checked },
                    })}
                  />
                  {' '}Enable streaming responses
                </label>
                <label className={styles.aiLabel}>
                  Max tokens
                  <Input
                    type="number"
                    placeholder="2048"
                    value={String(config.customLlm.maxTokens ?? 2048)}
                    onChange={e => updateConfig({
                      customLlm: { ...config.customLlm!, maxTokens: Number(e.target.value) || 2048 },
                    })}
                  />
                </label>
                <label className={styles.aiLabel}>
                  Temperature
                  <Input
                    type="number"
                    placeholder="0.7"
                    value={String(config.customLlm.temperature ?? 0.7)}
                    onChange={e => updateConfig({
                      customLlm: { ...config.customLlm!, temperature: Number(e.target.value) || 0.7 },
                    })}
                  />
                </label>
                <label className={styles.aiLabel}>
                  Fallback provider (if model fails)
                  <select
                    value={config.customLlm.fallbackProvider || ''}
                    onChange={e => updateConfig({
                      customLlm: { ...config.customLlm!, fallbackProvider: (e.target.value || undefined) as AIProviderConfig['provider'] | undefined },
                    })}
                    className={styles.aiSelect}
                  >
                    <option value="">None</option>
                    <option value="managed-cloud">Cloud AI</option>
                    <option value="chrome-ai">Chrome AI</option>
                    <option value="openai-compatible">Custom Provider</option>
                    <option value="server-proxy">Server Proxy</option>
                    <option value="custom-llm">Custom LLM</option>
                  </select>
                </label>
              </div>
            )}

            {config.provider === 'custom-llm' && (
              <div className={styles.aiSettingsActions}>
                <Button
                  variant="default"
                  size="small"
                  onClick={() => handleTestCustomLlm()}
                  disabled={testingConnection || !config.customLlm?.baseUrl?.trim()}
                >
                  <span className="material-symbols-rounded">wifi_tethering</span>
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button
                  variant="default"
                  size="small"
                  onClick={() => handleRunEval()}
                  disabled={evalRunning || !isConfigured}
                >
                  <span className="material-symbols-rounded">science</span>
                  {evalRunning ? 'Evaluating...' : 'Run Quality Eval'}
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => updateConfig({ provider: chromeAIAvailable ? 'chrome-ai' : 'managed-cloud' })}
                >
                  Use Automatic Mode
                </Button>
              </div>
            )}

            {config.provider === 'custom-llm' && connectionResult && (
              <div className={`${styles.aiConnectionResult} ${styles[`aiConnectionResult--${connectionResult.type}`]}`}>
                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                  {connectionResult.type === 'success' ? 'check_circle' : connectionResult.type === 'error' ? 'error' : 'warning'}
                </span>
                {connectionResult.message}
              </div>
            )}

            {evalResult && (
              <div className={styles.aiSettingsFields}>
                <h5>Evaluation Results</h5>
                <p className={styles.aiSettingsHint}>
                  Overall: {(evalResult.overallScore * 100).toFixed(0)}% | Pass rate: {(evalResult.passRate * 100).toFixed(0)}% | Avg latency: {evalResult.averageLatencyMs.toFixed(0)}ms
                </p>
                <p className={styles.aiSettingsHint}>
                  Recommendation: <strong>{evalResult.recommendation === 'ready' ? 'Ready for production' : evalResult.recommendation === 'needs-work' ? 'Needs improvement' : 'Not ready — use hosted model as primary'}</strong>
                </p>
                {evalResult.results.map(r => (
                  <div key={r.promptId} className={styles.aiSettingsHint}>
                    {r.passed ? '\u2713' : '\u2717'} {r.label}: {(r.weightedScore * 100).toFixed(0)}% ({r.latencyMs}ms)
                    {r.errors.length > 0 && <span style={{ color: 'var(--color-error)' }}> — {r.errors[0]}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <details open={showCustomProvider} onToggle={e => setShowCustomProvider((e.target as HTMLDetailsElement).open)}>
            <summary className={styles.aiNoticeLink}>Custom provider (advanced)</summary>

            <div className={styles.aiSetupGuide}>
              <span className="material-symbols-rounded">help_outline</span>
              <div>
                <strong>Quick setup:</strong> Pick a provider below, paste your API key, and you&apos;re ready to go.
                <p className={styles.aiSetupNote}>Your API key is stored locally in your browser and is never sent anywhere except the endpoint you specify.</p>
              </div>
            </div>

            {/* Endpoint presets */}
            <div className={styles.aiEndpointPresets}>
              {ENDPOINT_PRESETS.map(preset => {
                const isActive = matchPresetId(config.endpoint) === preset.id;
                return (
                  <button
                    key={preset.id}
                    className={`${styles.aiEndpointPreset} ${isActive ? styles['aiEndpointPreset--active'] : ''}`}
                    onClick={() => {
                      updateConfig({
                        endpoint: preset.endpoint,
                        model: config.model?.trim() ? config.model : preset.defaultModel,
                      });
                    }}
                  >
                    <strong>{preset.label}</strong>
                    <small>{preset.signupUrl}</small>
                  </button>
                );
              })}
            </div>

            <div className={styles.aiSettingsFields}>
              <label className={styles.aiLabel}>
                API Endpoint
                <Input
                  placeholder="https://api.openai.com/v1/chat/completions"
                  value={config.endpoint || ''}
                  onChange={e => updateConfig({ endpoint: e.target.value })}
                />
              </label>
              <label className={styles.aiLabel}>
                API Key
                <Input
                  type="password"
                  placeholder={ENDPOINT_PRESETS.find(p => p.id === matchPresetId(config.endpoint))?.keyPlaceholder ?? 'sk-...'}
                  value={config.sessionToken || ''}
                  onChange={e => updateConfig({ sessionToken: e.target.value })}
                />
              </label>
              <label className={styles.aiLabel}>
                Model
                <Input
                  placeholder={ENDPOINT_PRESETS.find(p => p.id === matchPresetId(config.endpoint))?.defaultModel ?? 'gpt-4o'}
                  value={config.model || ''}
                  onChange={e => updateConfig({ model: e.target.value })}
                />
              </label>
            </div>
            <div className={styles.aiSettingsActions}>
              <Button
                variant="default"
                size="small"
                onClick={handleTestConnection}
                disabled={testingConnection || !config.endpoint?.trim() || !config.sessionToken?.trim()}
              >
                <span className="material-symbols-rounded">wifi_tethering</span>
                {testingConnection ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button
                variant="ghost"
                size="small"
                onClick={() => updateConfig({ provider: chromeAIAvailable ? 'chrome-ai' : 'managed-cloud' })}
              >
                Use Automatic Mode
              </Button>
            </div>
            {connectionResult && (
              <div className={`${styles.aiConnectionResult} ${styles[`aiConnectionResult--${connectionResult.type}`]}`}>
                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                  {connectionResult.type === 'success' ? 'check_circle' : connectionResult.type === 'error' ? 'error' : 'warning'}
                </span>
                {connectionResult.message}
              </div>
            )}
          </details>

          <p className={styles.aiSettingsHint}>
            Settings are stored locally in your browser.
          </p>
        </div>
      )}

      {/* Unconfigured notice */}
      {!isConfigured && !showSettings && (
        <div className={styles.aiNotice}>
          <span className="material-symbols-rounded">info</span>
          <div>
            <strong>AI is not configured yet.</strong> Click{' '}
            <button className={styles.aiNoticeLink} onClick={() => { setShowSettings(true); setShowCustomProvider(true); }}>
              Settings
            </button>{' '}
            below, pick a provider (e.g. OpenAI, Groq, OpenRouter), and paste your API key.
            You can also connect a local model via Ollama or vLLM in the Custom LLM section.
            {!isChromeBrowser() && ' Alternatively, use Google Chrome for free on-device AI.'}
          </div>
        </div>
      )}

      {/* Preset prompts */}
      <div className={styles.aiPresets}>
        {presetPrompts.map(preset => (
          <button
            key={preset.id}
            className={styles.aiPresetBtn}
            onClick={() => handlePreset(preset)}
            disabled={loading}
          >
            <span className="material-symbols-rounded">{preset.icon}</span>
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom prompt input */}
      <div className={styles.aiPromptArea}>
        <Textarea
          placeholder={
            isScreenplay
              ? "Enter a custom prompt... (e.g. 'Punch up the subtext in this exchange')"
              : "Enter a custom prompt... (e.g. 'Rewrite this scene from a different POV')"
          }
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={3}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        {activeChapter && (
          <p className={styles.aiContextHint}>
            <span className="material-symbols-rounded">auto_awesome</span>
            Context: {activeChapter.title} and relevant {isScreenplay ? 'scene structure' : 'chapter details'} will be sent with your prompt.
          </p>
        )}
        <div className={styles.aiPresets}>
          <button
            className={styles.aiPresetBtn}
            onClick={() => setPrompt(BOOK_CHAPTER_TEMPLATE)}
            disabled={loading}
          >
            <span className="material-symbols-rounded">auto_stories</span>
            Insert Book Chapter Template
          </button>
          <button
            className={styles.aiPresetBtn}
            onClick={() => setPrompt(SCREENPLAY_SCENE_TEMPLATE)}
            disabled={loading}
          >
            <span className="material-symbols-rounded">theaters</span>
            Insert Screenplay Scene Template
          </button>
        </div>

        <div className={styles.aiPipelinePanel}>
          <h4>
            <span className="material-symbols-rounded">pipeline</span>
            Sequential pipeline
          </h4>
          <label className={styles.aiPipelineToneToggle}>
            <input
              type="checkbox"
              checked={includeToneMatchPass}
              onChange={e => setIncludeToneMatchPass(e.target.checked)}
            />
            Include optional tone-matching pass
          </label>
          <div className={styles.aiPipelineGrid}>
            {AI_WRITING_PIPELINE_STAGES.map(stage => (
              <label key={stage.id} className={styles.aiPipelineStageRow}>
                <span>{stage.label}</span>
                <select
                  value={pipelineModes[stage.id] || 'replace'}
                  onChange={e => setPipelineModes(prev => ({ ...prev, [stage.id]: e.target.value as PipelineInsertionMode }))}
                  disabled={stage.optional && !includeToneMatchPass}
                  className={styles.aiSelect}
                >
                  <option value="replace">Replace</option>
                  <option value="append">Append</option>
                  <option value="side-by-side">Side-by-side compare</option>
                </select>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Response area */}
      {(response || loading || error || isStreaming) && (
        <div className={styles.aiResponseArea}>
          <h4>
            <span className="material-symbols-rounded">smart_toy</span>
            Response
            {isStreaming && <span className={styles.aiStreamingIndicator}> (streaming...)</span>}
          </h4>
          {loading && !isStreaming && (
            <p className={styles.loadingText}>
              {config.provider === 'chrome-ai' && (chromeAIStatus === 'downloadable' || chromeAIStatus === 'downloading')
                ? 'Downloading AI model...'
                : config.provider === 'custom-llm'
                  ? `Waiting for ${CUSTOM_LLM_BACKEND_LABELS[config.customLlm?.backend ?? 'ollama']}...`
                  : 'Generating response...'}
            </p>
          )}
          {error && <p className={styles.aiError}>{error}</p>}
          {(response || isStreaming) && (
            <div ref={responseRef} className={styles.aiResponseContent}>
              {isStreaming ? streamingText : response}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
