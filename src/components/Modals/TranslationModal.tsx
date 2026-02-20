import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useToast } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { editorToPlainText } from '@/lib/utils';
import { loadAIConfig, createProvider } from '@/lib/ai';
import {
  TRANSLATION_LANGUAGES,
  getSortedLanguages,
  POPULAR_LANGUAGE_CODES,
  buildTranslationPrompt,
} from '@/lib/translation';
import type { TranslationLanguage } from '@/lib/translation';
import styles from './Modals.module.css';

interface TranslationModalProps {
  open: boolean;
  onClose: () => void;
}

export function TranslationModal({ open, onClose }: TranslationModalProps) {
  const { activeChapter, state } = useApp();
  const { showToast } = useToast();
  const sectionLabel = state.projectType === 'screenplay' ? 'scene' : 'chapter';

  const [targetLang, setTargetLang] = useState<string>('spa_Latn');
  const [filter, setFilter] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preserveFormatting, setPreserveFormatting] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const sortedLanguages = useMemo(() => getSortedLanguages(), []);

  const filteredLanguages = useMemo(() => {
    if (!filter.trim()) return sortedLanguages;
    const q = filter.toLowerCase();
    return sortedLanguages.filter(
      l => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
    );
  }, [filter, sortedLanguages]);

  const selectedLanguage = useMemo(
    () => TRANSLATION_LANGUAGES.find(l => l.code === targetLang),
    [targetLang]
  );

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setResult('');
      setError(null);
      setLoading(false);
      setFilter('');
    } else {
      abortRef.current?.abort();
    }
  }, [open]);

  // Scroll result area when new content arrives
  useEffect(() => {
    if (resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [result]);

  const handleTranslate = useCallback(async () => {
    if (!activeChapter || !selectedLanguage) return;

    const text = editorToPlainText(activeChapter.content);
    if (!text.trim()) {
      setError(`No text to translate. Write some content in your ${sectionLabel} first.`);
      return;
    }

    const config = loadAIConfig();
    const provider = createProvider(config);

    if (!provider.isAvailable()) {
      setError('AI is not configured. Set up an AI provider in AI Writing Tools first.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResult('');

    try {
      const prompt = buildTranslationPrompt(text, selectedLanguage, preserveFormatting);

      const response = await provider.execute({
        action: 'translate',
        prompt,
        context: '',
        projectType: state.projectType,
        sectionTitle: activeChapter.title,
        signal: controller.signal,
      });

      setResult(response.text);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Translation failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
      provider.destroy();
    }
  }, [activeChapter, selectedLanguage, preserveFormatting, state.projectType, sectionLabel]);

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result).then(() => {
        showToast('Translation copied to clipboard', 'success', 'content_copy');
      }).catch(() => {
        showToast('Failed to copy to clipboard', 'error');
      });
    }
  };

  if (!activeChapter) {
    return (
      <Dialog open={open} onClose={onClose} title="Translate" size="large">
        <div className={styles.analysisEmptyState}>
          <span className={`material-symbols-rounded ${styles.analysisEmptyState__icon}`}>translate</span>
          <p className={styles.emptyMessage}>Select a {sectionLabel} to translate</p>
          <p className={styles.analysisEmptyState__hint}>
            Choose a {sectionLabel} from the sidebar first. Translation uses your configured AI provider to translate the full text into your chosen language.
          </p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Translate - ${activeChapter.title}`}
      size="large"
      footer={
        <div className={styles.analysisFooter}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {result && (
              <Button variant="ghost" onClick={handleCopy}>
                <span className="material-symbols-rounded">content_copy</span>
                Copy
              </Button>
            )}
          </div>
          <Button
            variant="primary"
            onClick={handleTranslate}
            disabled={loading || !targetLang}
          >
            <span className="material-symbols-rounded">translate</span>
            {loading ? 'Translating...' : 'Translate'}
          </Button>
        </div>
      }
    >
      {/* Language selector */}
      <div className={styles.translationConfig}>
        <div className={styles.translationConfig__row}>
          <label className={styles.translationConfig__label}>
            Target Language
            <div className={styles.translationConfig__selectWrapper}>
              <input
                className={styles.translationConfig__filter}
                type="text"
                placeholder="Search languages..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              <select
                className={styles.translationConfig__select}
                value={targetLang}
                onChange={e => setTargetLang(e.target.value)}
                size={8}
              >
                {filter.trim() === '' && (
                  <optgroup label="Popular">
                    {sortedLanguages
                      .filter(l => POPULAR_LANGUAGE_CODES.has(l.code))
                      .map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} ({lang.code})
                        </option>
                      ))}
                  </optgroup>
                )}
                <optgroup label={filter.trim() ? 'Results' : 'All Languages'}>
                  {(filter.trim() ? filteredLanguages : sortedLanguages.filter(l => !POPULAR_LANGUAGE_CODES.has(l.code))).map(
                    (lang: TranslationLanguage) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name} ({lang.code})
                      </option>
                    )
                  )}
                </optgroup>
              </select>
            </div>
          </label>
        </div>

        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={preserveFormatting}
            onChange={e => setPreserveFormatting(e.target.checked)}
          />
          Preserve paragraph breaks and formatting
        </label>
      </div>

      {/* Translation result */}
      {(result || loading || error) && (
        <div className={styles.translationResult}>
          <h4>
            <span className="material-symbols-rounded">translate</span>
            {selectedLanguage?.name ?? 'Translation'}
          </h4>
          {loading && <p className={styles.loadingText}>Translating...</p>}
          {error && <p className={styles.aiError}>{error}</p>}
          {result && (
            <div ref={resultRef} className={styles.translationResult__text}>
              {result}
            </div>
          )}
        </div>
      )}

      {/* Info note */}
      {!result && !loading && !error && (
        <div className={styles.translationInfo}>
          <span className="material-symbols-rounded">info</span>
          <p>
            Translation uses your configured AI provider to translate the current {sectionLabel} content.
            For best results, ensure your AI provider is set up in AI Writing Tools.
            All {TRANSLATION_LANGUAGES.length} languages use validated NLLB-200 language codes.
          </p>
        </div>
      )}
    </Dialog>
  );
}
