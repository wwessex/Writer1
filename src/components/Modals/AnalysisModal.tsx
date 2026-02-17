import { useState, useEffect, useCallback } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useToast } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { analyzeText, editorToPlainText } from '@/lib/utils';
import type { TextAnalysis, LanguageToolMatch } from '@/types';
import styles from './Modals.module.css';

interface AnalysisModalProps {
  open: boolean;
  onClose: () => void;
}

export function AnalysisModal({ open, onClose }: AnalysisModalProps) {
  const { activeChapter, state } = useApp();
  const { showToast } = useToast();
  const sectionLabel = state.projectType === 'screenplay' ? 'scene' : 'chapter';
  const [analysis, setAnalysis] = useState<TextAnalysis | null>(null);
  const [grammarResults, setGrammarResults] = useState<LanguageToolMatch[]>([]);
  const [loading, setLoading] = useState(false);

  const runAnalysis = useCallback(() => {
    if (!activeChapter) return;
    const text = editorToPlainText(activeChapter.content);
    setAnalysis(analyzeText(text));
  }, [activeChapter]);

  useEffect(() => {
    if (open && activeChapter) {
      runAnalysis();
      setGrammarResults([]);
    }
  }, [open, activeChapter, runAnalysis]);

  const runGrammarCheck = async () => {
    if (!activeChapter || !state.settings.assist.languageToolEnabled) return;

    const text = editorToPlainText(activeChapter.content);
    if (!text.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(state.settings.assist.languageToolUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          text,
          language: state.settings.assist.languageToolLanguage
        })
      });

      if (!response.ok) throw new Error('Grammar check failed');

      const data = await response.json();
      setGrammarResults(data.matches?.slice(0, 30) || []);
    } catch (error) {
      console.error('Grammar check error:', error);
      showToast('Grammar check failed. Check your LanguageTool settings.', 'error', 'spellcheck');
    } finally {
      setLoading(false);
    }
  };

  const getFleschLabel = (score: number) => {
    if (score >= 90) return 'Very Easy';
    if (score >= 80) return 'Easy';
    if (score >= 70) return 'Fairly Easy';
    if (score >= 60) return 'Standard';
    if (score >= 50) return 'Fairly Difficult';
    if (score >= 30) return 'Difficult';
    return 'Very Difficult';
  };

  if (!activeChapter) {
    return (
      <Dialog open={open} onClose={onClose} title="Writing Analysis" size="large">
        <div className={styles.analysisEmptyState}>
          <span className={`material-symbols-rounded ${styles.analysisEmptyState__icon}`}>analytics</span>
          <p className={styles.emptyMessage}>Select a {sectionLabel} to analyse</p>
          <p className={styles.analysisEmptyState__hint}>
            Choose a {sectionLabel} from the sidebar first. Analysis includes readability scores, repeated word detection, pacing checks, and optional grammar checking.
          </p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Analysis - ${activeChapter.title}`}
      size="large"
      footer={
        <div className={styles.analysisFooter}>
          <Button variant="ghost" onClick={runAnalysis}>
            <span className="material-symbols-rounded">refresh</span>
            Refresh
          </Button>
          {state.settings.assist.languageToolEnabled && (
            <Button variant="primary" onClick={runGrammarCheck} disabled={loading}>
              <span className="material-symbols-rounded">spellcheck</span>
              {loading ? 'Checking...' : 'Run Grammar Check'}
            </Button>
          )}
        </div>
      }
    >
      <div className={styles.analysisGrid}>
        {/* Readability Card */}
        <div className={styles.analysisCard}>
          <h4>
            <span className="material-symbols-rounded">analytics</span>
            Readability
          </h4>
          {analysis && (
            <div className={styles.analysisStats}>
              <div className={styles.stat}>
                <span className={styles.stat__value}>{analysis.wordCount.toLocaleString()}</span>
                <span className={styles.stat__label}>Words</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.stat__value}>{analysis.sentenceCount}</span>
                <span className={styles.stat__label}>Sentences</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.stat__value}>{analysis.avgSentenceLength}</span>
                <span className={styles.stat__label}>Avg Words/Sentence</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.stat__value}>{analysis.fleschScore}</span>
                <span className={styles.stat__label}>Flesch Score ({getFleschLabel(analysis.fleschScore)})</span>
              </div>
            </div>
          )}
        </div>

        {/* Repetitions Card */}
        <div className={styles.analysisCard}>
          <h4>
            <span className="material-symbols-rounded">repeat</span>
            Repeated Words
          </h4>
          {analysis && analysis.repetitions.size > 0 ? (
            <div className={styles.repetitionList}>
              {Array.from(analysis.repetitions.entries()).slice(0, 15).map(([word, count]) => (
                <span key={word} className={styles.repetitionTag}>
                  {word} <strong>{count}</strong>
                </span>
              ))}
            </div>
          ) : (
            <p className={styles.emptyMessage}>No notable repetitions found</p>
          )}
        </div>

        {/* Pacing Card */}
        <div className={styles.analysisCard}>
          <h4>
            <span className="material-symbols-rounded">speed</span>
            Pacing (Long Sentences)
          </h4>
          {analysis && analysis.longSentences.length > 0 ? (
            <div className={styles.longSentenceList}>
              {analysis.longSentences.slice(0, 5).map((sentence, idx) => (
                <p key={idx} className={styles.longSentence}>
                  {sentence.slice(0, 150)}...
                </p>
              ))}
            </div>
          ) : (
            <p className={styles.emptyMessage}>No overly long sentences (30+ words) found</p>
          )}
        </div>

        {/* Grammar Card */}
        <div className={styles.analysisCard}>
          <h4>
            <span className="material-symbols-rounded">spellcheck</span>
            Grammar & Style
          </h4>
          {!state.settings.assist.languageToolEnabled ? (
            <div className={styles.analysisGrammarSetup}>
              <span className="material-symbols-rounded">info</span>
              <div>
                <p className={styles.analysisGrammarSetup__text}>
                  Grammar checking requires LanguageTool. Enable it in <strong>Settings &gt; Writing Assistance</strong> to check for grammar, style, and spelling issues.
                </p>
                <p className={styles.analysisGrammarSetup__note}>
                  The free public API works out of the box -- no account required.
                </p>
              </div>
            </div>
          ) : grammarResults.length > 0 ? (
            <div className={styles.grammarList}>
              {grammarResults.map((match, idx) => (
                <div key={idx} className={styles.grammarItem}>
                  <p className={styles.grammarItem__message}>{match.message}</p>
                  <p className={styles.grammarItem__context}>
                    ...{match.context.text}...
                  </p>
                  {match.replacements.length > 0 && (
                    <p className={styles.grammarItem__suggestion}>
                      Suggestion: {match.replacements.slice(0, 3).map(r => r.value).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyMessage}>Click "Run Grammar Check" to analyse</p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
