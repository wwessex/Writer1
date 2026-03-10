import type { Chapter, NarrativeClimateBand, NarrativeWeatherPoint } from '@/types';
import { clamp, editorToPlainText } from '@/lib/utils';

const POSITIVE_WORDS = new Set([
  'hope', 'joy', 'love', 'warm', 'bright', 'calm', 'safe', 'smile', 'relief', 'kind', 'gentle', 'glad', 'good', 'great', 'happy', 'wonder'
]);

const NEGATIVE_WORDS = new Set([
  'fear', 'dark', 'cold', 'anger', 'grief', 'pain', 'rage', 'storm', 'sad', 'alone', 'loss', 'threat', 'danger', 'hate', 'dread', 'wound'
]);

function tokenizeWords(text: string): string[] {
  return text.toLowerCase().match(/[a-z']+/g) || [];
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

export function getSentimentProxyScore(text: string): number {
  const words = tokenizeWords(text);
  if (words.length === 0) return 0;

  let positive = 0;
  let negative = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) positive += 1;
    if (NEGATIVE_WORDS.has(word)) negative += 1;
  }

  const signalWords = positive + negative;
  if (signalWords === 0) return 0;

  return Math.round(clamp(((positive - negative) / signalWords) * 100, -100, 100));
}

export function getPacingIntensity(text: string): number {
  const sentences = splitSentences(text);
  const sentenceLengths = sentences.map(sentence => tokenizeWords(sentence).length).filter(Boolean);
  const sentenceVariance = variance(sentenceLengths);
  const varianceScore = clamp((Math.sqrt(sentenceVariance) / 12) * 100, 0, 100);

  const wordCount = Math.max(tokenizeWords(text).length, 1);
  const punctuationSpikes = (text.match(/[!?]|\.\.\.|—/g) || []).length;
  const punctuationPer100Words = (punctuationSpikes / wordCount) * 100;
  const punctuationScore = clamp((punctuationPer100Words / 10) * 100, 0, 100);

  return Math.round((varianceScore * 0.65) + (punctuationScore * 0.35));
}

export function getDialogueDensity(text: string): number {
  const totalWords = tokenizeWords(text).length;
  if (totalWords === 0) return 0;

  const quotedDialogue = [
    ...(text.match(/"[^"]*"/g) || []),
    ...(text.match(/[“][^”]*[”]/g) || []),
  ];

  const dialogueWords = quotedDialogue.reduce((sum, chunk) => sum + tokenizeWords(chunk).length, 0);
  return Math.round(clamp((dialogueWords / totalWords) * 100, 0, 100));
}

function getBandLabel(score: number): NarrativeClimateBand['label'] {
  if (score < 34) return 'low';
  if (score < 67) return 'moderate';
  return 'high';
}

function aggregateBand(id: NarrativeClimateBand['id'], values: number[]): NarrativeClimateBand {
  const average = values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;

  return {
    id,
    average,
    label: getBandLabel(Math.abs(average)),
  };
}

export function buildNarrativeWeather(chapters: Chapter[]): { points: NarrativeWeatherPoint[]; climateBands: NarrativeClimateBand[] } {
  const points = chapters.map((chapter, index) => {
    const plainText = editorToPlainText(chapter.content);
    const chapterTitle = chapter.title?.trim() || `Chapter ${index + 1}`;

    const sentimentProxy = getSentimentProxyScore(plainText);
    const pacingIntensity = getPacingIntensity(plainText);
    const dialogueDensity = getDialogueDensity(plainText);

    return {
      chapterId: chapter.id,
      chapterOrder: chapter.order,
      chapterTitle,
      sentimentProxy,
      pacingIntensity,
      dialogueDensity,
    };
  }).sort((a, b) => a.chapterOrder - b.chapterOrder);

  return {
    points,
    climateBands: [
      aggregateBand('sentiment', points.map(point => point.sentimentProxy)),
      aggregateBand('pacing', points.map(point => point.pacingIntensity)),
      aggregateBand('dialogue', points.map(point => point.dialogueDensity)),
    ],
  };
}
