import type { Chapter, CharacterEntity, CharacterVoiceProfile } from '@/types';
import { getContinuityMemorySnapshot } from '@/lib/continuityMemory';
import { extractDialogueBySpeaker as extractDialogueFromMarkdown } from '@/lib/editor/markdownParser';

const WORD_REGEX = /[A-Za-zÀ-ÖØ-öø-ÿ0-9']+/g;
const SENTENCE_SPLIT_REGEX = /[.!?]+/;

export interface VoiceStyleFeatures {
  sampleTokens: number;
  sentenceCount: number;
  avgSentenceLength: number;
  uniqueTokenRatio: number;
  repeatedPhrases: Record<string, number>;
  punctuationPattern: Record<string, number>;
}

export interface VoiceFingerprint {
  speaker: string;
  utteranceCount: number;
  combinedText: string;
  features: VoiceStyleFeatures;
}

export interface VoiceSimilarityAlert {
  activeSpeaker: string;
  comparedSpeaker: string;
  similarity: number;
  threshold: number;
  activeSampleTokens: number;
  comparedSampleTokens: number;
}

export interface VoiceSimilarityConfig {
  similarityThreshold: number;
  minSampleTokens: number;
}

export const DEFAULT_VOICE_SIMILARITY_CONFIG: VoiceSimilarityConfig = {
  similarityThreshold: 0.82,
  minSampleTokens: 25,
};

function normalizeSpeakerLabel(label: string): string {
  return label
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\(.*?\)/g, '')
    .trim()
    .toUpperCase();
}

export function extractDialogueBySpeaker(content: string | null): Record<string, string[]> {
  return extractDialogueFromMarkdown(content);
}

export function computeStyleFeatures(dialogueLines: string[]): VoiceStyleFeatures {
  const combinedText = dialogueLines.join(' ').trim();
  const tokens = (combinedText.toLowerCase().match(WORD_REGEX) || []);
  const uniqueTokens = new Set(tokens);
  const sentenceFragments = combinedText
    .split(SENTENCE_SPLIT_REGEX)
    .map(fragment => fragment.trim())
    .filter(Boolean);

  const sentenceCount = sentenceFragments.length || (combinedText ? 1 : 0);
  const avgSentenceLength = sentenceCount ? tokens.length / sentenceCount : 0;

  const repeatedPhrases: Record<string, number> = {};
  for (const n of [2, 3]) {
    for (let i = 0; i <= tokens.length - n; i += 1) {
      const gram = tokens.slice(i, i + n).join(' ');
      repeatedPhrases[gram] = (repeatedPhrases[gram] || 0) + 1;
    }
  }

  const repeatedOnly = Object.fromEntries(
    Object.entries(repeatedPhrases).filter(([, count]) => count >= 2)
  );

  const punctuationPattern = {
    exclamation: (combinedText.match(/!/g) || []).length,
    question: (combinedText.match(/\?/g) || []).length,
    ellipsis: (combinedText.match(/\.\.\./g) || []).length,
    emDash: (combinedText.match(/[—–]/g) || []).length,
    semicolon: (combinedText.match(/;/g) || []).length,
  };

  return {
    sampleTokens: tokens.length,
    sentenceCount,
    avgSentenceLength,
    uniqueTokenRatio: tokens.length ? uniqueTokens.size / tokens.length : 0,
    repeatedPhrases: repeatedOnly,
    punctuationPattern,
  };
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = [...setA].filter(value => setB.has(value)).length;
  const union = new Set([...setA, ...setB]).size;
  return union ? intersection / union : 0;
}

export function computeFingerprint(speaker: string, dialogueLines: string[]): VoiceFingerprint {
  return {
    speaker,
    utteranceCount: dialogueLines.length,
    combinedText: dialogueLines.join(' '),
    features: computeStyleFeatures(dialogueLines),
  };
}

export function similarityScore(active: VoiceFingerprint, baseline: VoiceFingerprint): number {
  const a = active.features;
  const b = baseline.features;
  const numericA = [
    a.avgSentenceLength,
    a.uniqueTokenRatio,
    a.punctuationPattern.exclamation,
    a.punctuationPattern.question,
    a.punctuationPattern.ellipsis,
    a.punctuationPattern.emDash,
    a.punctuationPattern.semicolon,
  ];
  const numericB = [
    b.avgSentenceLength,
    b.uniqueTokenRatio,
    b.punctuationPattern.exclamation,
    b.punctuationPattern.question,
    b.punctuationPattern.ellipsis,
    b.punctuationPattern.emDash,
    b.punctuationPattern.semicolon,
  ];

  const cosine = cosineSimilarity(numericA, numericB);
  const jaccard = jaccardSimilarity(
    new Set(Object.keys(a.repeatedPhrases)),
    new Set(Object.keys(b.repeatedPhrases))
  );

  return 0.65 * cosine + 0.35 * jaccard;
}

function matchDialogueToCharacter(dialogueBySpeaker: Record<string, string[]>, character: CharacterEntity): string[] {
  const lookup = new Set([character.name, ...character.aliases].map(normalizeSpeakerLabel));
  return Object.entries(dialogueBySpeaker)
    .filter(([speaker]) => lookup.has(normalizeSpeakerLabel(speaker)))
    .flatMap(([, lines]) => lines);
}

export function buildCharacterVoiceProfiles(
  chapters: Chapter[],
  characters: CharacterEntity[],
): CharacterVoiceProfile[] {
  return characters.map(character => {
    const lines = chapters
      .flatMap(chapter => matchDialogueToCharacter(extractDialogueBySpeaker(chapter.content), character));
    return {
      characterId: character.id,
      sampleCount: lines.length,
      fingerprint: computeFingerprint(character.name, lines),
      updatedAt: Date.now(),
    };
  });
}

export function getDialogueSimilarityAlerts(
  activeChapterContent: string | null,
  profiles: CharacterVoiceProfile[],
  config: VoiceSimilarityConfig = DEFAULT_VOICE_SIMILARITY_CONFIG,
): VoiceSimilarityAlert[] {
  const draftDialogueBySpeaker = extractDialogueBySpeaker(activeChapterContent);
  const alerts: VoiceSimilarityAlert[] = [];

  const fingerprints = Object.entries(draftDialogueBySpeaker).map(([speaker, lines]) => computeFingerprint(speaker, lines));

  for (const active of fingerprints) {
    if (active.features.sampleTokens < config.minSampleTokens) continue;

    for (const profile of profiles) {
      const baseline = profile.fingerprint;
      if (!baseline) continue;
      if (normalizeSpeakerLabel(active.speaker) === normalizeSpeakerLabel(baseline.speaker)) continue;
      if (baseline.features.sampleTokens < config.minSampleTokens) continue;

      const similarity = similarityScore(active, baseline);
      if (similarity >= config.similarityThreshold) {
        alerts.push({
          activeSpeaker: active.speaker,
          comparedSpeaker: baseline.speaker,
          similarity,
          threshold: config.similarityThreshold,
          activeSampleTokens: active.features.sampleTokens,
          comparedSampleTokens: baseline.features.sampleTokens,
        });
      }
    }
  }

  return alerts.sort((a, b) => b.similarity - a.similarity);
}


export function getVoiceContinuityWarnings(novelId: string, chapters: Chapter[], activeChapterContent: string | null): string[] {
  if (!novelId) return [];
  const snapshot = getContinuityMemorySnapshot(novelId, chapters);
  const known = new Set(snapshot.characters.map(character => normalizeSpeakerLabel(character.canonicalName)));
  const draftSpeakers = Object.keys(extractDialogueBySpeaker(activeChapterContent)).map(normalizeSpeakerLabel);

  return draftSpeakers
    .filter(speaker => speaker && !known.has(speaker))
    .map(speaker => `${speaker} appears in dialogue but is missing from canonical continuity.`);
}
