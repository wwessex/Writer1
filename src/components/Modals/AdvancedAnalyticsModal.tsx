import { useState, useMemo } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import { editorToPlainText, countWords, findRepetitions } from '@/lib/utils';
import type { AdvancedAnalytics, SentenceDistribution, SentimentResult } from '@/types';
import styles from './Modals.module.css';

// ---------------------------------------------------------------------------
// Positive / Negative word lists for basic sentiment analysis
// ---------------------------------------------------------------------------

const POSITIVE_WORDS = new Set([
  'good', 'great', 'happy', 'joy', 'love', 'wonderful', 'beautiful', 'excellent',
  'amazing', 'fantastic', 'brilliant', 'perfect', 'delightful', 'cheerful', 'glad',
  'pleased', 'thrilled', 'excited', 'grateful', 'thankful', 'hopeful', 'bright',
  'warm', 'kind', 'gentle', 'peaceful', 'calm', 'comfort', 'smile', 'laugh',
  'triumph', 'victory', 'success', 'celebrate', 'admire', 'adore', 'bliss',
  'brave', 'charming', 'confident', 'creative', 'eager', 'elegant', 'enchant',
  'enjoy', 'faith', 'free', 'friend', 'fun', 'generous', 'glory', 'grace',
  'harmony', 'heal', 'hero', 'honest', 'honor', 'humble', 'inspire', 'jolly',
  'keen', 'lively', 'loyal', 'magic', 'mercy', 'merry', 'noble', 'nurture',
  'optimistic', 'paradise', 'passion', 'proud', 'pure', 'radiant', 'rejoice',
  'relief', 'resilient', 'safe', 'serene', 'sincere', 'strong', 'sweet',
  'tender', 'treasure', 'trust', 'uplift', 'valiant', 'vibrant', 'vigor',
  'virtue', 'vivid', 'welcome', 'wise', 'worthy', 'zeal', 'blessing',
  'courage', 'dream', 'embrace', 'flourish', 'forgive', 'glow', 'gratitude',
  'heaven', 'innocence', 'jubilant', 'kissed', 'light', 'miracle', 'overcome',
  'prosper', 'refresh', 'restore', 'shine', 'splendid', 'sunrise', 'thrive',
  'tranquil', 'united', 'warmth', 'wonder', 'yearn'
]);

const NEGATIVE_WORDS = new Set([
  'bad', 'terrible', 'horrible', 'awful', 'sad', 'angry', 'hate', 'fear',
  'pain', 'suffer', 'cruel', 'dark', 'gloomy', 'miserable', 'desperate',
  'hopeless', 'tragic', 'dread', 'bitter', 'harsh', 'violent', 'wicked',
  'evil', 'death', 'grief', 'sorrow', 'rage', 'fury', 'agony', 'anguish',
  'betray', 'blame', 'bleak', 'broken', 'burden', 'chaos', 'cold', 'conflict',
  'corrupt', 'coward', 'crush', 'curse', 'danger', 'decay', 'defeat', 'deny',
  'despair', 'destroy', 'disaster', 'disgust', 'doom', 'doubt', 'drown',
  'dull', 'enemy', 'envy', 'fail', 'fault', 'filth', 'fool', 'foul',
  'frighten', 'grave', 'guilt', 'harm', 'haunt', 'hell', 'helpless', 'horror',
  'hostile', 'hurt', 'ignore', 'ill', 'imprison', 'injure', 'insult',
  'jealous', 'kill', 'lonely', 'loss', 'malice', 'menace', 'mourn', 'murder',
  'neglect', 'nightmare', 'obscure', 'oppress', 'outrage', 'panic', 'peril',
  'plague', 'poison', 'poverty', 'prison', 'punish', 'regret', 'reject',
  'resent', 'ruin', 'ruthless', 'savage', 'scorn', 'selfish', 'shame',
  'shatter', 'sick', 'sin', 'slave', 'slay', 'sob', 'steal', 'storm',
  'struggle', 'terror', 'threat', 'torment', 'toxic', 'trap', 'trouble',
  'ugly', 'venom', 'victim', 'vile', 'war', 'weak', 'weary', 'weep',
  'wound', 'wrath', 'wrong'
]);

// ---------------------------------------------------------------------------
// Analytics computation helpers
// ---------------------------------------------------------------------------

function getSentenceDistribution(text: string): SentenceDistribution[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const ranges: { range: string; min: number; max: number }[] = [
    { range: '1-5', min: 1, max: 5 },
    { range: '6-10', min: 6, max: 10 },
    { range: '11-15', min: 11, max: 15 },
    { range: '16-20', min: 16, max: 20 },
    { range: '21-25', min: 21, max: 25 },
    { range: '26-30', min: 26, max: 30 },
    { range: '31+', min: 31, max: Infinity }
  ];

  const distribution: SentenceDistribution[] = ranges.map(r => ({
    range: r.range,
    count: 0
  }));

  for (const sentence of sentences) {
    const wordCount = countWords(sentence);
    if (wordCount === 0) continue;
    for (let i = 0; i < ranges.length; i++) {
      if (wordCount >= ranges[i].min && wordCount <= ranges[i].max) {
        distribution[i].count++;
        break;
      }
    }
  }

  return distribution;
}

function getParagraphLengths(text: string): number[] {
  const paragraphs = text.split(/\n\s*\n|\n/).filter(p => p.trim().length > 0);
  return paragraphs.map(p => countWords(p));
}

function getDialoguePercentage(text: string): number {
  const totalWords = countWords(text);
  if (totalWords === 0) return 0;

  // Match text inside double quotes, single quotes used as dialogue, or
  // text following an em-dash that indicates dialogue
  const doubleQuoted = text.match(/"[^"]*"/g) || [];
  const singleQuoted = text.match(/\u2018[^\u2019]*\u2019/g) || [];
  const smartDoubleQuoted = text.match(/\u201C[^\u201D]*\u201D/g) || [];

  const allDialogue = [...doubleQuoted, ...singleQuoted, ...smartDoubleQuoted];
  const dialogueWords = allDialogue.reduce((sum, segment) => sum + countWords(segment), 0);

  return Math.min(100, Math.round((dialogueWords / totalWords) * 1000) / 10);
}

function getVocabularyRichness(text: string): number {
  const words = text.toLowerCase().match(/[a-z']+/g) || [];
  if (words.length === 0) return 0;
  const unique = new Set(words);
  return Math.round((unique.size / words.length) * 1000) / 10;
}

function analyzeSentiment(text: string): SentimentResult {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positiveCount++;
    if (NEGATIVE_WORDS.has(word)) negativeCount++;
  }

  const total = positiveCount + negativeCount;
  if (total === 0) return { score: 0, label: 'neutral' };

  // Score ranges from -1 (fully negative) to +1 (fully positive)
  const score = Math.round(((positiveCount - negativeCount) / total) * 100) / 100;

  let label: SentimentResult['label'] = 'neutral';
  if (score > 0.15) label = 'positive';
  else if (score < -0.15) label = 'negative';

  return { score, label };
}

function analyzeSentimentByParagraph(text: string): SentimentResult[] {
  const paragraphs = text.split(/\n\s*\n|\n/).filter(p => p.trim().length > 0);
  return paragraphs.map(p => analyzeSentiment(p));
}

function getWordFrequency(text: string): Map<string, number> {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'it', 'its', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me',
    'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'what',
    'which', 'who', 'whom', 'where', 'when', 'why', 'how', 'not', 'no', 'so',
    'if', 'then', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
    'there', 'said', 'like', 'even', 'still', 'well', 'back', 'been', 'being',
    'get', 'got', 'going', 'go', 'went', 'come', 'came', 'know', 'knew',
    'see', 'saw', 'seen', 'take', 'took', 'make', 'made', 'say', 'think',
    'thought', 'into', 'about', 'up', 'out', 'down', 'over', 'after', 'before',
    'between', 'through', 'during', 'each', 'some', 'own', 'same', 'only',
    'more', 'most', 'other', 'such', 'much', 'many', 'any', 'all', 'both',
    'few', 'again', 'once', 'while', 'until', 'because'
  ]);

  const words = text.toLowerCase().match(/[a-z']+/g) || [];
  const counts = new Map<string, number>();

  for (const word of words) {
    if (word.length < 3 || stopWords.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  return new Map(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
  );
}

function computeAdvancedAnalytics(text: string): AdvancedAnalytics {
  const paragraphLengths = getParagraphLengths(text);
  const avgParagraphLength = paragraphLengths.length > 0
    ? Math.round(paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length * 10) / 10
    : 0;

  return {
    sentenceDistribution: getSentenceDistribution(text),
    paragraphLengths,
    dialoguePercentage: getDialoguePercentage(text),
    avgParagraphLength,
    vocabularyRichness: getVocabularyRichness(text),
    sentimentByParagraph: analyzeSentimentByParagraph(text)
  };
}

// ---------------------------------------------------------------------------
// Sub-components for chart sections
// ---------------------------------------------------------------------------

function BarChart({
  data,
  labelKey,
  valueKey,
  maxValue,
  color = 'var(--accent)'
}: {
  data: { label: string; value: number }[];
  labelKey?: string;
  valueKey?: string;
  maxValue?: number;
  color?: string;
}) {
  const max = maxValue ?? Math.max(...data.map(d => d.value), 1);

  return (
    <div className={styles.barChart}>
      {data.map((item, idx) => {
        const widthPercent = max > 0 ? (item.value / max) * 100 : 0;
        return (
          <div key={idx} className={styles.barChart__row}>
            <span className={styles.barChart__label}>{item.label}</span>
            <div className={styles.barChart__track}>
              <div
                className={styles.barChart__fill}
                style={{ width: `${widthPercent}%`, background: color }}
              />
            </div>
            <span className={styles.barChart__value}>{item.value}</span>
          </div>
        );
      })}
      {labelKey && valueKey && (
        <div className={styles.barChart__legend}>
          <span>{labelKey}</span>
          <span>{valueKey}</span>
        </div>
      )}
    </div>
  );
}

function SentimentIndicator({ result }: { result: SentimentResult }) {
  const colorMap: Record<SentimentResult['label'], string> = {
    positive: 'var(--success, #22c55e)',
    negative: 'var(--danger, #ef4444)',
    neutral: 'var(--text-muted)'
  };

  const iconMap: Record<SentimentResult['label'], string> = {
    positive: 'sentiment_satisfied',
    negative: 'sentiment_dissatisfied',
    neutral: 'sentiment_neutral'
  };

  return (
    <div className={styles.sentimentIndicator}>
      <span
        className="material-symbols-rounded"
        style={{ color: colorMap[result.label], fontSize: '2rem' }}
      >
        {iconMap[result.label]}
      </span>
      <div className={styles.sentimentIndicator__info}>
        <span className={styles.sentimentIndicator__label}>
          {result.label.charAt(0).toUpperCase() + result.label.slice(1)}
        </span>
        <span className={styles.sentimentIndicator__score}>
          Score: {result.score > 0 ? '+' : ''}{result.score}
        </span>
      </div>
    </div>
  );
}

function SentimentTimeline({ results }: { results: SentimentResult[] }) {
  if (results.length === 0) return null;

  const colorMap: Record<SentimentResult['label'], string> = {
    positive: 'var(--success, #22c55e)',
    negative: 'var(--danger, #ef4444)',
    neutral: 'var(--text-muted)'
  };

  return (
    <div className={styles.sentimentTimeline}>
      <div className={styles.sentimentTimeline__bars}>
        {results.map((r, idx) => (
          <div
            key={idx}
            className={styles.sentimentTimeline__bar}
            title={`Paragraph ${idx + 1}: ${r.label} (${r.score > 0 ? '+' : ''}${r.score})`}
            style={{
              background: colorMap[r.label],
              opacity: 0.3 + Math.abs(r.score) * 0.7
            }}
          />
        ))}
      </div>
      <div className={styles.sentimentTimeline__legend}>
        <span>Start</span>
        <span>End</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface AdvancedAnalyticsModalProps {
  open: boolean;
  onClose: () => void;
}

export function AdvancedAnalyticsModal({ open, onClose }: AdvancedAnalyticsModalProps) {
  const { activeChapter, state } = useApp();
  const [activeTab, setActiveTab] = useState<
    'distribution' | 'vocabulary' | 'sentiment' | 'frequency' | 'pacing' | 'repetition'
  >('distribution');

  const text = useMemo(() => {
    if (!activeChapter) return '';
    return editorToPlainText(activeChapter.content);
  }, [activeChapter]);

  const analytics = useMemo(() => {
    if (!text.trim()) return null;
    return computeAdvancedAnalytics(text);
  }, [text]);

  const overallSentiment = useMemo(() => {
    if (!text.trim()) return null;
    return analyzeSentiment(text);
  }, [text]);

  const wordFrequency = useMemo(() => {
    if (!text.trim()) return new Map<string, number>();
    return getWordFrequency(text);
  }, [text]);

  // Pacing analysis across all chapters
  const pacingData = useMemo(() => {
    return state.chapters.map(ch => {
      const chText = editorToPlainText(ch.content);
      const words = countWords(chText);
      const sentences = chText.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const avgSentenceLen = sentences.length > 0
        ? Math.round(sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length)
        : 0;

      // Dialogue ratio
      const dialogueMatches = chText.match(/[""\u201C\u201D][^""\u201C\u201D]+[""\u201C\u201D]/g) || [];
      const dialogueWords = dialogueMatches.join(' ').split(/\s+/).length;
      const dialogueRatio = words > 0 ? Math.round((dialogueWords / words) * 100) : 0;

      // Sentiment
      const sentiment = chText.trim() ? analyzeSentiment(chText) : { label: 'neutral' as const, score: 0 };

      return {
        id: ch.id,
        title: ch.title,
        words,
        avgSentenceLen,
        dialogueRatio,
        sentiment,
      };
    });
  }, [state.chapters]);

  // Word repetition detection
  const repetitions = useMemo(() => {
    if (!text.trim()) return [];
    return findRepetitions(text, 3);
  }, [text]);

  const totalWords = useMemo(() => countWords(text), [text]);

  const uniqueWords = useMemo(() => {
    const words = text.toLowerCase().match(/[a-z']+/g) || [];
    return new Set(words).size;
  }, [text]);

  if (!activeChapter) {
    return (
      <Dialog open={open} onClose={onClose} title="Advanced Analytics" size="large">
        <p className={styles.emptyMessage}>Select a chapter to analyze</p>
      </Dialog>
    );
  }

  if (!analytics) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title={`Advanced Analytics - ${activeChapter.title}`}
        size="large"
      >
        <p className={styles.emptyMessage}>No text to analyze. Start writing to see analytics.</p>
      </Dialog>
    );
  }

  const paragraphDistributionData = (() => {
    const ranges = [
      { range: '1-25', min: 1, max: 25 },
      { range: '26-50', min: 26, max: 50 },
      { range: '51-100', min: 51, max: 100 },
      { range: '101-150', min: 101, max: 150 },
      { range: '151-200', min: 151, max: 200 },
      { range: '201+', min: 201, max: Infinity }
    ];

    return ranges.map(r => ({
      label: `${r.range} words`,
      value: analytics.paragraphLengths.filter(
        (len: number) => len >= r.min && len <= r.max
      ).length
    }));
  })();

  const frequencyData = [...wordFrequency.entries()].slice(0, 20).map(([word, count]) => ({
    label: word,
    value: count
  }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Advanced Analytics - ${activeChapter.title}`}
      size="large"
      footer={
        <div className={styles.analysisFooter}>
          <span className={styles.advancedAnalytics__wordCount}>
            {totalWords.toLocaleString()} words | {uniqueWords.toLocaleString()} unique
          </span>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {/* Overview stats row */}
      <div className={styles.advancedAnalytics__overview}>
        <div className={styles.advancedAnalytics__stat}>
          <span className={styles.advancedAnalytics__statValue}>
            {analytics.dialoguePercentage}%
          </span>
          <span className={styles.advancedAnalytics__statLabel}>Dialogue</span>
        </div>
        <div className={styles.advancedAnalytics__stat}>
          <span className={styles.advancedAnalytics__statValue}>
            {analytics.vocabularyRichness}%
          </span>
          <span className={styles.advancedAnalytics__statLabel}>Vocabulary Richness</span>
        </div>
        <div className={styles.advancedAnalytics__stat}>
          <span className={styles.advancedAnalytics__statValue}>
            {analytics.avgParagraphLength}
          </span>
          <span className={styles.advancedAnalytics__statLabel}>Avg Words/Paragraph</span>
        </div>
        <div className={styles.advancedAnalytics__stat}>
          {overallSentiment && (
            <SentimentIndicator result={overallSentiment} />
          )}
          <span className={styles.advancedAnalytics__statLabel}>Overall Tone</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.advancedAnalytics__tabs}>
        <button
          className={`${styles.advancedAnalytics__tab} ${activeTab === 'distribution' ? styles['advancedAnalytics__tab--active'] : ''}`}
          onClick={() => setActiveTab('distribution')}
        >
          <span className="material-symbols-rounded">bar_chart</span>
          Distribution
        </button>
        <button
          className={`${styles.advancedAnalytics__tab} ${activeTab === 'vocabulary' ? styles['advancedAnalytics__tab--active'] : ''}`}
          onClick={() => setActiveTab('vocabulary')}
        >
          <span className="material-symbols-rounded">dictionary</span>
          Vocabulary
        </button>
        <button
          className={`${styles.advancedAnalytics__tab} ${activeTab === 'sentiment' ? styles['advancedAnalytics__tab--active'] : ''}`}
          onClick={() => setActiveTab('sentiment')}
        >
          <span className="material-symbols-rounded">mood</span>
          Sentiment
        </button>
        <button
          className={`${styles.advancedAnalytics__tab} ${activeTab === 'frequency' ? styles['advancedAnalytics__tab--active'] : ''}`}
          onClick={() => setActiveTab('frequency')}
        >
          <span className="material-symbols-rounded">format_list_numbered</span>
          Word Frequency
        </button>
        <button
          className={`${styles.advancedAnalytics__tab} ${activeTab === 'pacing' ? styles['advancedAnalytics__tab--active'] : ''}`}
          onClick={() => setActiveTab('pacing')}
        >
          <span className="material-symbols-rounded">speed</span>
          Pacing
        </button>
        <button
          className={`${styles.advancedAnalytics__tab} ${activeTab === 'repetition' ? styles['advancedAnalytics__tab--active'] : ''}`}
          onClick={() => setActiveTab('repetition')}
        >
          <span className="material-symbols-rounded">repeat</span>
          Repetition
        </button>
      </div>

      {/* Tab content */}
      <div className={styles.advancedAnalytics__content}>
        {activeTab === 'distribution' && (
          <div className={styles.advancedAnalytics__section}>
            {/* Sentence length distribution */}
            <div className={styles.analysisCard}>
              <h4>
                <span className="material-symbols-rounded">stacked_bar_chart</span>
                Sentence Length Distribution
              </h4>
              <p className={styles.advancedAnalytics__hint}>
                Words per sentence -- varied lengths create better rhythm and pacing.
              </p>
              <BarChart
                data={analytics.sentenceDistribution.map((d: SentenceDistribution) => ({
                  label: `${d.range} words`,
                  value: d.count
                }))}
                labelKey="Sentence Length"
                valueKey="Count"
              />
            </div>

            {/* Paragraph length distribution */}
            <div className={styles.analysisCard}>
              <h4>
                <span className="material-symbols-rounded">view_day</span>
                Paragraph Length Distribution
              </h4>
              <p className={styles.advancedAnalytics__hint}>
                Paragraph variety keeps readers engaged. Mix short and long paragraphs for impact.
              </p>
              <BarChart
                data={paragraphDistributionData}
                labelKey="Paragraph Length"
                valueKey="Count"
                color="var(--accent)"
              />
            </div>
          </div>
        )}

        {activeTab === 'vocabulary' && (
          <div className={styles.advancedAnalytics__section}>
            <div className={styles.analysisCard}>
              <h4>
                <span className="material-symbols-rounded">abc</span>
                Vocabulary Richness
              </h4>
              <div className={styles.advancedAnalytics__richness}>
                <div className={styles.advancedAnalytics__richnessGauge}>
                  <div className={styles.advancedAnalytics__richnessMeter}>
                    <div
                      className={styles.advancedAnalytics__richnessFill}
                      style={{ width: `${Math.min(100, analytics.vocabularyRichness)}%` }}
                    />
                  </div>
                  <div className={styles.advancedAnalytics__richnessScale}>
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
                <div className={styles.advancedAnalytics__richnessStats}>
                  <div className={styles.stat}>
                    <span className={styles.stat__value}>{totalWords.toLocaleString()}</span>
                    <span className={styles.stat__label}>Total Words</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.stat__value}>{uniqueWords.toLocaleString()}</span>
                    <span className={styles.stat__label}>Unique Words</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.stat__value}>{analytics.vocabularyRichness}%</span>
                    <span className={styles.stat__label}>Uniqueness Ratio</span>
                  </div>
                </div>
                <p className={styles.advancedAnalytics__hint}>
                  {analytics.vocabularyRichness >= 70
                    ? 'Excellent vocabulary diversity. Your writing uses a wide range of words.'
                    : analytics.vocabularyRichness >= 50
                      ? 'Good vocabulary diversity. Consider introducing more varied word choices in key passages.'
                      : analytics.vocabularyRichness >= 30
                        ? 'Moderate vocabulary diversity. Try substituting repeated words with synonyms.'
                        : 'Low vocabulary diversity. This may indicate heavy repetition -- consider revising with a thesaurus.'}
                </p>
              </div>
            </div>

            <div className={styles.analysisCard}>
              <h4>
                <span className="material-symbols-rounded">chat_bubble</span>
                Dialogue Analysis
              </h4>
              <div className={styles.advancedAnalytics__dialogue}>
                <div className={styles.advancedAnalytics__dialogueBar}>
                  <div
                    className={styles.advancedAnalytics__dialogueFill}
                    style={{ width: `${analytics.dialoguePercentage}%` }}
                  />
                  <div
                    className={styles.advancedAnalytics__narrativeFill}
                    style={{ width: `${100 - analytics.dialoguePercentage}%` }}
                  />
                </div>
                <div className={styles.advancedAnalytics__dialogueLegend}>
                  <span className={styles.advancedAnalytics__dialogueLegendItem}>
                    <span
                      className={styles.advancedAnalytics__legendSwatch}
                      style={{ background: 'var(--accent)' }}
                    />
                    Dialogue: {analytics.dialoguePercentage}%
                  </span>
                  <span className={styles.advancedAnalytics__dialogueLegendItem}>
                    <span
                      className={styles.advancedAnalytics__legendSwatch}
                      style={{ background: 'var(--btn-bg)' }}
                    />
                    Narrative: {(100 - analytics.dialoguePercentage).toFixed(1)}%
                  </span>
                </div>
                <p className={styles.advancedAnalytics__hint}>
                  {analytics.dialoguePercentage >= 50
                    ? 'Dialogue-heavy chapter. Great for character interaction and fast pacing.'
                    : analytics.dialoguePercentage >= 25
                      ? 'Balanced mix of dialogue and narrative. Good for most fiction scenes.'
                      : analytics.dialoguePercentage >= 10
                        ? 'Narrative-heavy chapter. Works well for exposition and introspection.'
                        : 'Very little dialogue detected. Consider adding character conversations to vary the texture.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sentiment' && (
          <div className={styles.advancedAnalytics__section}>
            <div className={styles.analysisCard}>
              <h4>
                <span className="material-symbols-rounded">mood</span>
                Overall Sentiment
              </h4>
              {overallSentiment && (
                <div className={styles.advancedAnalytics__overallSentiment}>
                  <SentimentIndicator result={overallSentiment} />
                  <p className={styles.advancedAnalytics__hint}>
                    {overallSentiment.label === 'positive'
                      ? 'The overall tone of this chapter leans positive, with uplifting or hopeful language.'
                      : overallSentiment.label === 'negative'
                        ? 'The overall tone of this chapter leans negative, with tension, conflict, or darker themes.'
                        : 'The overall tone is balanced between positive and negative elements.'}
                  </p>
                </div>
              )}
            </div>

            <div className={styles.analysisCard}>
              <h4>
                <span className="material-symbols-rounded">timeline</span>
                Sentiment Flow
              </h4>
              <p className={styles.advancedAnalytics__hint}>
                How the emotional tone shifts across paragraphs, from start to end.
              </p>
              <SentimentTimeline results={analytics.sentimentByParagraph} />
              {analytics.sentimentByParagraph.length > 0 && (
                <div className={styles.advancedAnalytics__sentimentBreakdown}>
                  <span className={styles.advancedAnalytics__sentimentCount} style={{ color: 'var(--success, #22c55e)' }}>
                    {analytics.sentimentByParagraph.filter((r: SentimentResult) => r.label === 'positive').length} positive
                  </span>
                  <span className={styles.advancedAnalytics__sentimentCount} style={{ color: 'var(--text-muted)' }}>
                    {analytics.sentimentByParagraph.filter((r: SentimentResult) => r.label === 'neutral').length} neutral
                  </span>
                  <span className={styles.advancedAnalytics__sentimentCount} style={{ color: 'var(--danger, #ef4444)' }}>
                    {analytics.sentimentByParagraph.filter((r: SentimentResult) => r.label === 'negative').length} negative
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'frequency' && (
          <div className={styles.advancedAnalytics__section}>
            <div className={styles.analysisCard}>
              <h4>
                <span className="material-symbols-rounded">format_list_numbered</span>
                Top Words (excluding common stop words)
              </h4>
              <p className={styles.advancedAnalytics__hint}>
                Most frequently used meaningful words. Look for unintentional repetition.
              </p>
              {frequencyData.length > 0 ? (
                <BarChart
                  data={frequencyData}
                  labelKey="Word"
                  valueKey="Occurrences"
                  color="var(--accent)"
                />
              ) : (
                <p className={styles.emptyMessage}>Not enough text for word frequency analysis</p>
              )}
            </div>
          </div>
        )}

        {/* Pacing Heatmap Tab */}
        {activeTab === 'pacing' && (
          <div className={styles.advancedAnalytics__section}>
            <div className={styles.analysisCard}>
              <h4>
                <span className="material-symbols-rounded">speed</span>
                Pacing Heatmap
              </h4>
              <p className={styles.advancedAnalytics__hint}>
                Visualizes pacing across all chapters. Short sentences and high dialogue create faster pacing.
                Long sentences and low dialogue create slower, more contemplative sections.
              </p>
              {pacingData.length > 0 ? (
                <div className={styles.pacingHeatmap}>
                  <div className={styles.pacingHeatmap__header}>
                    <span>Chapter</span>
                    <span>Words</span>
                    <span>Avg Sentence</span>
                    <span>Dialogue %</span>
                    <span>Tone</span>
                    <span>Pace</span>
                  </div>
                  {pacingData.map((ch, idx) => {
                    // Pace score: shorter sentences + more dialogue = faster
                    const paceScore = Math.min(100, Math.max(0,
                      (ch.dialogueRatio * 0.5) + Math.max(0, (25 - ch.avgSentenceLen)) * 3
                    ));
                    const paceLabel = paceScore > 60 ? 'Fast' : paceScore > 35 ? 'Medium' : 'Slow';
                    const paceColor = paceScore > 60 ? 'var(--danger, #ef4444)' : paceScore > 35 ? 'var(--warning, #f59e0b)' : 'var(--accent)';
                    return (
                      <div key={ch.id} className={styles.pacingHeatmap__row}>
                        <span className={styles.pacingHeatmap__title} title={ch.title}>
                          {idx + 1}. {ch.title.length > 20 ? ch.title.slice(0, 20) + '...' : ch.title}
                        </span>
                        <span>{ch.words.toLocaleString()}</span>
                        <span>{ch.avgSentenceLen}w</span>
                        <span>{ch.dialogueRatio}%</span>
                        <span className={styles.pacingHeatmap__sentiment}>
                          {ch.sentiment.label === 'positive' ? '+' : ch.sentiment.label === 'negative' ? '-' : '~'}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <div className={styles.pacingHeatmap__bar}>
                            <div
                              className={styles.pacingHeatmap__barFill}
                              style={{ width: `${paceScore}%`, background: paceColor }}
                            />
                          </div>
                          <span style={{ fontSize: '0.6875rem', color: paceColor }}>{paceLabel}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.emptyMessage}>Add chapters to see pacing analysis</p>
              )}
            </div>
          </div>
        )}

        {/* Repetition Detection Tab */}
        {activeTab === 'repetition' && (
          <div className={styles.advancedAnalytics__section}>
            <div className={styles.analysisCard}>
              <h4>
                <span className="material-symbols-rounded">repeat</span>
                Word Repetition Detection
              </h4>
              <p className={styles.advancedAnalytics__hint}>
                Words used 3+ times in the current chapter. Frequent repetition may indicate
                areas where synonyms or restructuring would improve prose quality.
              </p>
              {repetitions.length > 0 ? (
                <div className={styles.repetitionList}>
                  {repetitions.slice(0, 30).map(({ word, count }) => (
                    <div key={word} className={styles.repetitionItem}>
                      <span className={styles.repetitionItem__word}>{word}</span>
                      <div className={styles.repetitionItem__bar}>
                        <div
                          className={styles.repetitionItem__barFill}
                          style={{
                            width: `${Math.min(100, (count / Math.max(...repetitions.map(r => r.count))) * 100)}%`,
                            background: count > 10 ? 'var(--danger, #ef4444)' : count > 5 ? 'var(--warning, #f59e0b)' : 'var(--accent)',
                          }}
                        />
                      </div>
                      <span className={styles.repetitionItem__count}>{count}x</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyMessage}>No significant word repetitions detected</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
