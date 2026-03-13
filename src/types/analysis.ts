import type { ValidationSeverity } from './export';

export interface TextAnalysis {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  fleschScore: number;
  repetitions: Map<string, number>;
  longSentences: string[];
}

export interface LanguageToolMatch {
  message: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  context: {
    text: string;
    offset: number;
    length: number;
  };
  rule: {
    id: string;
    description: string;
  };
}

export interface LanguageToolResponse {
  matches: LanguageToolMatch[];
}

export interface SentimentResult {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
}

export interface SentenceDistribution {
  range: string;
  count: number;
}

export interface AdvancedAnalytics {
  sentenceDistribution: SentenceDistribution[];
  paragraphLengths: number[];
  dialoguePercentage: number;
  avgParagraphLength: number;
  vocabularyRichness: number;
  sentimentByParagraph: SentimentResult[];
}

export interface NarrativeWeatherPoint {
  chapterId: string;
  chapterOrder: number;
  chapterTitle: string;
  sentimentProxy: number;
  pacingIntensity: number;
  dialogueDensity: number;
}

export interface NarrativeClimateBand {
  id: 'sentiment' | 'pacing' | 'dialogue';
  average: number;
  label: 'low' | 'moderate' | 'high';
}

export type TimelineParadoxSeverity = ValidationSeverity;

export type TimelineParadoxType =
  | 'prerequisite_order_violation'
  | 'overlap_conflict'
  | 'travel_time_violation'
  | 'age_regression'
  | 'state_transition_conflict'
  | 'missing_prerequisite'
  | 'continuity_conflict';

export interface TimelineParadoxFinding {
  id: string;
  severity: TimelineParadoxSeverity;
  type: TimelineParadoxType;
  involvedChapterIds: string[];
  involvedSceneIds: string[];
  explanation: string;
}
