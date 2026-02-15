import { useState, useCallback, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { editorToPlainText } from '@/lib/utils';
import { recordTelemetryEvent, isTelemetryOptedIn } from '@/lib/telemetry';
import styles from './Panels.module.css';

interface AISuggestionsPanelProps {
  open: boolean;
  onClose: () => void;
}

interface Suggestion {
  id: string;
  type: 'continuation' | 'alternative' | 'grammar' | 'style';
  text: string;
  loading: boolean;
}

const AI_CONFIG_KEY = 'draftharbour_ai_config';

function getAIConfig(): { endpoint: string; apiKey: string } {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { endpoint: '', apiKey: '' };
}

const QUICK_ACTIONS = [
  { id: 'continue', label: 'Continue', icon: 'edit_note', prompt: 'Continue writing the next 2-3 sentences, matching the tone and style.' },
  { id: 'rephrase', label: 'Rephrase', icon: 'swap_horiz', prompt: 'Suggest 2 alternative ways to write the last paragraph.' },
  { id: 'strengthen', label: 'Strengthen', icon: 'bolt', prompt: 'Make the last paragraph more vivid with stronger verbs and sensory details.' },
  { id: 'shorten', label: 'Shorten', icon: 'compress', prompt: 'Tighten the last paragraph to half its length without losing meaning.' },
];

export function AISuggestionsPanel({ open, onClose }: AISuggestionsPanelProps) {
  const { activeChapter, state } = useApp();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const config = getAIConfig();
  const isConfigured = config.endpoint.trim() !== '' && config.apiKey.trim() !== '';

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      setLoading(false);
    }
  }, [open]);

  const fetchSuggestion = useCallback(async (prompt: string, type: Suggestion['type']) => {
    if (!isConfigured || !activeChapter) return;

    const chapterText = editorToPlainText(activeChapter.content);
    const contextSnippet = chapterText.slice(-2000); // Last 2000 chars for context

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const suggestionId = crypto.randomUUID();
    setSuggestions(prev => [...prev, { id: suggestionId, type, text: '', loading: true }]);
    setLoading(true);

    const startTime = Date.now();

    try {
      const res = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a concise creative writing assistant. Provide suggestions directly without preamble. Project type: ${state.projectType}.`,
            },
            {
              role: 'user',
              content: `Context (last part of the ${state.projectType === 'screenplay' ? 'scene' : 'chapter'}):\n\n${contextSnippet}\n\n---\n\n${prompt}`,
            },
          ],
          max_tokens: 512,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content ?? data?.response ?? '';

      setSuggestions(prev =>
        prev.map(s => s.id === suggestionId ? { ...s, text, loading: false } : s)
      );

      if (isTelemetryOptedIn()) {
        recordTelemetryEvent({
          action: `inline_${type}`,
          contextLengthChars: contextSnippet.length,
          promptLengthChars: prompt.length,
          responseLengthChars: text.length,
          latencyMs: Date.now() - startTime,
          success: true,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;

      setSuggestions(prev =>
        prev.map(s => s.id === suggestionId
          ? { ...s, text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`, loading: false }
          : s
        )
      );

      if (isTelemetryOptedIn()) {
        recordTelemetryEvent({
          action: `inline_${type}`,
          contextLengthChars: 0,
          promptLengthChars: prompt.length,
          responseLengthChars: 0,
          latencyMs: Date.now() - startTime,
          success: false,
          errorType: err instanceof Error ? err.message : 'unknown',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [isConfigured, activeChapter, config, state.projectType]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDismiss = (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  };

  const handleCustomSubmit = () => {
    if (customPrompt.trim()) {
      fetchSuggestion(customPrompt, 'style');
      setCustomPrompt('');
    }
  };

  if (!open) return null;

  return (
    <div ref={panelRef} className={styles.aiPanel}>
      <div className={styles.aiPanel__header}>
        <h4>
          <span className="material-symbols-rounded">auto_awesome</span>
          AI Suggestions
        </h4>
        <button className={styles.aiPanel__close} onClick={onClose} aria-label="Close panel">
          <span className="material-symbols-rounded">close</span>
        </button>
      </div>

      {!isConfigured ? (
        <div className={styles.aiPanel__notice}>
          <span className="material-symbols-rounded">info</span>
          <p>Configure your AI endpoint in <strong>AI Writing Tools</strong> to enable inline suggestions.</p>
        </div>
      ) : (
        <>
          {/* Quick action buttons */}
          <div className={styles.aiPanel__actions}>
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.id}
                className={styles.aiPanel__actionBtn}
                onClick={() => fetchSuggestion(action.prompt, action.id === 'continue' ? 'continuation' : action.id === 'rephrase' ? 'alternative' : 'style')}
                disabled={loading || !activeChapter}
              >
                <span className="material-symbols-rounded">{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>

          {/* Custom prompt */}
          <div className={styles.aiPanel__customPrompt}>
            <input
              className={styles.aiPanel__input}
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="Ask anything..."
              onKeyDown={e => { if (e.key === 'Enter') handleCustomSubmit(); }}
            />
            <button
              className={styles.aiPanel__sendBtn}
              onClick={handleCustomSubmit}
              disabled={loading || !customPrompt.trim()}
            >
              <span className="material-symbols-rounded">send</span>
            </button>
          </div>

          {/* Suggestions list */}
          <div className={styles.aiPanel__suggestions}>
            {suggestions.map(suggestion => (
              <div key={suggestion.id} className={styles.aiPanel__suggestion}>
                <div className={styles.aiPanel__suggestionHeader}>
                  <span className={styles.aiPanel__suggestionType}>{suggestion.type}</span>
                  <div className={styles.aiPanel__suggestionActions}>
                    {!suggestion.loading && suggestion.text && (
                      <button onClick={() => handleCopy(suggestion.text)} title="Copy">
                        <span className="material-symbols-rounded">content_copy</span>
                      </button>
                    )}
                    <button onClick={() => handleDismiss(suggestion.id)} title="Dismiss">
                      <span className="material-symbols-rounded">close</span>
                    </button>
                  </div>
                </div>
                {suggestion.loading ? (
                  <div className={styles.aiPanel__loading}>Generating...</div>
                ) : (
                  <div className={styles.aiPanel__suggestionText}>{suggestion.text}</div>
                )}
              </div>
            ))}

            {suggestions.length === 0 && (
              <p className={styles.aiPanel__empty}>
                Click a quick action above or type a custom prompt to get AI suggestions for your current {state.projectType === 'screenplay' ? 'scene' : 'chapter'}.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
