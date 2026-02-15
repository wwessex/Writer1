import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dialog, Button, Input, Textarea } from '@/components/UI';
import { useToast } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { editorToPlainText } from '@/lib/utils';
import type { ProjectType } from '@/types';
import styles from './Modals.module.css';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AIWritingModalProps {
  open: boolean;
  onClose: () => void;
}

interface AIConfig {
  endpoint: string;
  apiKey: string;
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

const STORAGE_KEY = 'novelwriter_ai_config';

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
    label: 'Summarize',
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
      'Review the text for grammar, spelling, and punctuation errors. List each issue found with the original text, the correction, and a brief explanation.'
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

function getPresetPrompts(projectType: ProjectType): PresetPrompt[] {
  return projectType === 'screenplay' ? SCREENPLAY_PRESET_PROMPTS : BOOK_PRESET_PROMPTS;
}

function extractScreenplayContext(chapterText: string): {
  sceneHeading: string;
  characters: string[];
  previousDialogueTurn: string;
} {
  const lines = chapterText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const sceneHeading = lines.find(line => /^(INT\.?|EXT\.?|INT\/EXT\.?)/i.test(line)) || '';
  const characterSet = new Set<string>();

  for (const line of lines) {
    if (/^[A-Z0-9\s()'.-]{2,}$/.test(line) && !/^(INT|EXT|INT\/EXT)\b/.test(line)) {
      characterSet.add(line.replace(/\s+/g, ' ').trim());
    }
  }

  let previousDialogueTurn = '';
  for (let i = lines.length - 1; i >= 1; i -= 1) {
    const speaker = lines[i - 1];
    const dialogue = lines[i];
    if (/^[A-Z0-9\s()'.-]{2,}$/.test(speaker) && !/^(INT|EXT|INT\/EXT)\b/.test(speaker)) {
      previousDialogueTurn = `${speaker}: ${dialogue}`;
      break;
    }
  }

  return {
    sceneHeading,
    characters: Array.from(characterSet),
    previousDialogueTurn
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function loadConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AIConfig>;
      return {
        endpoint: parsed.endpoint || '',
        apiKey: parsed.apiKey || ''
      };
    }
  } catch {
    // Ignore corrupt data
  }
  return { endpoint: '', apiKey: '' };
}

function saveConfig(config: AIConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AIWritingModal({ open, onClose }: AIWritingModalProps) {
  const { activeChapter, state } = useApp();
  const { showToast } = useToast();
  const isScreenplay = state.projectType === 'screenplay';
  const presetPrompts = useMemo(() => getPresetPrompts(state.projectType), [state.projectType]);

  // AI configuration
  const [config, setConfig] = useState<AIConfig>(loadConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Prompt / response state
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref for aborting in-flight requests
  const abortRef = useRef<AbortController | null>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  // Persist config changes
  const updateConfig = useCallback((updates: Partial<AIConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...updates };
      saveConfig(next);
      return next;
    });
  }, []);

  // Reset transient state when the modal opens
  useEffect(() => {
    if (open) {
      setResponse('');
      setError(null);
      setPrompt('');
      setLoading(false);
      // Auto-open settings panel when AI is not configured
      if (!config.endpoint.trim() || !config.apiKey.trim()) {
        setShowSettings(true);
      }
    } else {
      // Cancel any in-flight request when modal closes
      abortRef.current?.abort();
    }
  }, [open]);

  // Scroll response area when new content arrives
  useEffect(() => {
    if (responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [response]);

  /* ----- API call ------------------------------------------------- */

  const isConfigured = config.endpoint.trim() !== '' && config.apiKey.trim() !== '';

  const sendPrompt = useCallback(
    async (promptText: string) => {
      if (!promptText.trim()) return;

      if (!isConfigured) {
        setError(
          'AI is not configured yet. Open Settings in this modal to set your API endpoint and API key.'
        );
        return;
      }

      // Build context from the active chapter
      const chapterText = activeChapter
        ? editorToPlainText(activeChapter.content)
        : '';

      const structuralContext = isScreenplay
        ? extractScreenplayContext(chapterText)
        : undefined;

      const fullPrompt = chapterText
        ? `Here is the current ${isScreenplay ? 'scene' : 'chapter'} text for context:\n\n---\n${chapterText}\n---\n\n${promptText}`
        : promptText;

      // Abort any previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setResponse('');

      try {
        const res = await fetch(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            context: {
              projectType: state.projectType,
              sectionTitle: activeChapter?.title || '',
              ...(structuralContext ? { screenplayStructure: structuralContext } : {})
            },
            messages: [
              {
                role: 'system',
                content:
                  `You are a helpful creative writing assistant for ${isScreenplay ? 'screenplays' : 'books'}. Respond in plain text with clear formatting.`
              },
              { role: 'user', content: fullPrompt }
            ],
            max_tokens: 2048
          }),
          signal: controller.signal
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(
            `API request failed (${res.status}): ${body || res.statusText}`
          );
        }

        const data = await res.json();

        // Handle OpenAI-compatible response shape
        const text =
          data?.choices?.[0]?.message?.content ??
          data?.content?.[0]?.text ??
          data?.response ??
          JSON.stringify(data, null, 2);

        setResponse(text);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // User cancelled; nothing to show
          return;
        }
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [activeChapter, config, isConfigured, isScreenplay, state.projectType]
  );

  const handleSubmit = () => {
    sendPrompt(prompt);
  };

  const handlePreset = (preset: PresetPrompt) => {
    setPrompt(preset.prompt);
    sendPrompt(preset.prompt);
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

  const handleTestConnection = async () => {
    if (!config.endpoint.trim() || !config.apiKey.trim()) {
      showToast('Enter both an API endpoint and API key first', 'warning');
      return;
    }
    setTestingConnection(true);
    try {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'user', content: 'Say "Connection successful" in exactly two words.' }
          ],
          max_tokens: 10
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (res.ok) {
        showToast('Connection successful', 'success', 'check_circle');
      } else {
        const body = await res.text().catch(() => '');
        showToast(`Connection failed (${res.status}): ${body.slice(0, 100) || res.statusText}`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Connection failed: ${message}`, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  /* ----- Render --------------------------------------------------- */

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="AI Writing Tools"
      size="large"
      footer={
        <div className={styles.aiFooter}>
          <Button
            variant="ghost"
            onClick={() => setShowSettings(s => !s)}
          >
            <span className="material-symbols-rounded">settings</span>
            {showSettings ? 'Hide Settings' : 'Settings'}
          </Button>
          <div className={styles.aiFooterRight}>
            {response && (
              <Button variant="ghost" onClick={handleCopyResponse}>
                <span className="material-symbols-rounded">content_copy</span>
                Copy
              </Button>
            )}
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
            API Configuration
          </h4>
          <div className={styles.aiSettingsFields}>
            <label className={styles.aiLabel}>
              API Endpoint
              <Input
                placeholder="https://api.openai.com/v1/chat/completions"
                value={config.endpoint}
                onChange={e => updateConfig({ endpoint: e.target.value })}
              />
            </label>
            <label className={styles.aiLabel}>
              API Key
              <Input
                type="password"
                placeholder="sk-..."
                value={config.apiKey}
                onChange={e => updateConfig({ apiKey: e.target.value })}
              />
            </label>
          </div>
          <div className={styles.aiSettingsActions}>
            <Button
              variant="default"
              size="small"
              onClick={handleTestConnection}
              disabled={testingConnection || !config.endpoint.trim() || !config.apiKey.trim()}
            >
              <span className="material-symbols-rounded">wifi_tethering</span>
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
          <p className={styles.aiSettingsHint}>
            Settings are stored locally in your browser. The endpoint should
            accept OpenAI-compatible chat completion requests.
          </p>
          <div className={styles.aiPrivacyNote}>
            <span className="material-symbols-rounded">shield</span>
            <span>Your API key is stored only in your browser&apos;s localStorage and is sent only to the endpoint you configure. No data is shared with NovelWriter servers.</span>
          </div>
        </div>
      )}

      {/* Unconfigured notice */}
      {!isConfigured && !showSettings && (
        <div className={styles.aiNotice}>
          <span className="material-symbols-rounded">info</span>
          <div>
            <strong>AI is not configured yet.</strong> Open{' '}
            <button className={styles.aiNoticeLink} onClick={() => setShowSettings(true)}>
              Settings
            </button>{' '}
            to enter your API endpoint and API key.
            <br /><br />
            <strong>Compatible services:</strong> OpenAI, Anthropic (via proxy), Ollama, LM Studio, or any OpenAI-compatible API.
            <br />
            <strong>Example endpoint:</strong>{' '}
            <code className={styles.aiCode}>https://api.openai.com/v1/chat/completions</code>
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
      </div>

      {/* Response area */}
      {(response || loading || error) && (
        <div className={styles.aiResponseArea}>
          <h4>
            <span className="material-symbols-rounded">smart_toy</span>
            Response
          </h4>
          {loading && (
            <p className={styles.loadingText}>Generating response...</p>
          )}
          {error && <p className={styles.aiError}>{error}</p>}
          {response && (
            <div ref={responseRef} className={styles.aiResponseContent}>
              {response}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
