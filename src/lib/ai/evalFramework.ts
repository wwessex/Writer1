/**
 * Model evaluation framework for custom LLM quality gates.
 *
 * Runs a suite of benchmark prompts against the configured AI provider
 * and scores responses on key writing dimensions. Designed to answer:
 * "Is this model better than the baseline for our use case?"
 *
 * Dimensions scored:
 * - coherence: Does the output make logical sense?
 * - creativity: Is the writing vivid and original?
 * - consistency: Does it maintain character/voice/style?
 * - instruction_following: Does it do what was asked?
 * - grammar: Is the output grammatically correct?
 */

import type { AIProvider, AIRequest, AIResponse } from './types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface EvalDimension {
  name: 'coherence' | 'creativity' | 'consistency' | 'instruction_following' | 'grammar';
  weight: number;
}

export interface EvalPrompt {
  id: string;
  label: string;
  action: string;
  prompt: string;
  context: string;
  /** Expected traits in the response (checked via keyword presence) */
  expectedTraits: string[];
  /** Maximum acceptable latency in ms */
  maxLatencyMs: number;
}

export interface EvalResult {
  promptId: string;
  label: string;
  response: string;
  latencyMs: number;
  scores: Record<EvalDimension['name'], number>;
  weightedScore: number;
  passed: boolean;
  errors: string[];
}

export interface EvalSuiteResult {
  provider: string;
  model: string;
  timestamp: number;
  results: EvalResult[];
  overallScore: number;
  passRate: number;
  averageLatencyMs: number;
  recommendation: 'ready' | 'needs-work' | 'not-ready';
}

/* ------------------------------------------------------------------ */
/*  Default eval dimensions                                            */
/* ------------------------------------------------------------------ */

export const DEFAULT_EVAL_DIMENSIONS: EvalDimension[] = [
  { name: 'coherence', weight: 0.25 },
  { name: 'creativity', weight: 0.20 },
  { name: 'consistency', weight: 0.20 },
  { name: 'instruction_following', weight: 0.20 },
  { name: 'grammar', weight: 0.15 },
];

/* ------------------------------------------------------------------ */
/*  Benchmark prompts                                                  */
/* ------------------------------------------------------------------ */

export const EVAL_PROMPTS: EvalPrompt[] = [
  {
    id: 'continuation',
    label: 'Story continuation',
    action: 'continue',
    prompt: 'Continue writing from where the text left off. Match the tone and style. Write 2-3 paragraphs.',
    context: 'The rain drummed against the windowpane as Sarah stared at the letter in her hands. The words blurred together, but she had already memorised every cruel syllable. Three years of silence, and now this.',
    expectedTraits: ['sarah', 'letter', 'rain'],
    maxLatencyMs: 30000,
  },
  {
    id: 'dialogue',
    label: 'Dialogue generation',
    action: 'custom',
    prompt: 'Write a tense dialogue exchange between two characters who are hiding a secret from each other. 8-12 lines of dialogue.',
    context: 'Marcus and Elena sit across from each other at a small café table. Both are smiling, but their eyes tell a different story.',
    expectedTraits: ['marcus', 'elena'],
    maxLatencyMs: 30000,
  },
  {
    id: 'scene-expansion',
    label: 'Scene expansion',
    action: 'expand',
    prompt: 'Expand this scene with sensory details, internal thought, and environmental description.',
    context: 'He walked into the room. It was dark. Something felt wrong.',
    expectedTraits: ['dark', 'room'],
    maxLatencyMs: 30000,
  },
  {
    id: 'tone-consistency',
    label: 'Tone consistency',
    action: 'custom',
    prompt: 'Rewrite this passage in a noir detective style while keeping all the same events and characters.',
    context: 'Jenny went to the store. She bought milk and bread. On the way home, she saw her neighbor Mr. Henderson watering his lawn. They waved at each other.',
    expectedTraits: ['jenny', 'henderson'],
    maxLatencyMs: 30000,
  },
  {
    id: 'grammar-fix',
    label: 'Grammar correction',
    action: 'grammar',
    prompt: 'Fix all grammar and spelling errors. List each correction.',
    context: 'Their going to the store tommorow, but they dont know weather it will be open. The childrens toys was scattered accross the floor, and nobody seamed to care about cleaning them.',
    expectedTraits: ["they're", 'tomorrow', 'whether', "children's", 'across', 'seemed'],
    maxLatencyMs: 15000,
  },
  {
    id: 'spelling-fix',
    label: 'Spelling correction',
    action: 'grammar',
    prompt: 'Fix all spelling errors in the text. Output only the corrected text.',
    context: 'The wierd profesor was definately not intrested in the restaraunt\'s reccomendation. He prefered to seperate the deserts from the main corse.',
    expectedTraits: ['weird', 'professor', 'definitely', 'interested', 'restaurant', 'recommendation', 'preferred', 'separate', 'desserts', 'course'],
    maxLatencyMs: 15000,
  },
  {
    id: 'homophone-fix',
    label: 'Homophone correction',
    action: 'grammar',
    prompt: 'Fix all homophone and commonly confused word errors. Output only the corrected text.',
    context: 'Its been a long time sense they went their. Your not going to believe the affect it had on there moral. The principle reason was that he lead them down the wrong path, and the whether made it worse.',
    expectedTraits: ["it's", 'since', 'there', "you're", 'effect', 'their', 'morale', 'principal', 'led', 'weather'],
    maxLatencyMs: 15000,
  },
];

/* ------------------------------------------------------------------ */
/*  Scoring heuristics                                                 */
/* ------------------------------------------------------------------ */

function scoreCoherence(response: string): number {
  if (!response.trim()) return 0;
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length === 0) return 0.1;
  // Heuristic: longer, multi-sentence responses with paragraph structure score higher
  const hasParagraphs = response.includes('\n\n') || response.includes('\n');
  const hasReasonableLength = response.length > 100 && response.length < 10000;
  let score = 0.5;
  if (hasParagraphs) score += 0.2;
  if (hasReasonableLength) score += 0.2;
  if (sentences.length >= 3) score += 0.1;
  return Math.min(1, score);
}

function scoreCreativity(response: string): number {
  if (!response.trim()) return 0;
  const words = response.split(/\s+/);
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const lexicalDiversity = uniqueWords.size / Math.max(words.length, 1);

  // Check for sensory/descriptive language
  const sensoryWords = /\b(shimmer|whisper|creak|glow|shadow|echo|scent|trembl|warm|cold|bitter|soft|harsh|bright|dim)\w*/gi;
  const sensoryMatches = response.match(sensoryWords) ?? [];

  let score = 0.3;
  if (lexicalDiversity > 0.5) score += 0.2;
  if (lexicalDiversity > 0.6) score += 0.1;
  if (sensoryMatches.length >= 2) score += 0.2;
  if (sensoryMatches.length >= 5) score += 0.1;
  if (response.includes('"') || response.includes('\u201c')) score += 0.1; // Has dialogue
  return Math.min(1, score);
}

function scoreConsistency(response: string, expectedTraits: string[]): number {
  if (!response.trim() || expectedTraits.length === 0) return 0.5;
  const lower = response.toLowerCase();
  const found = expectedTraits.filter(trait => lower.includes(trait.toLowerCase()));
  return found.length / expectedTraits.length;
}

function scoreInstructionFollowing(response: string, prompt: string): number {
  if (!response.trim()) return 0;
  let score = 0.4;

  // Check if response is substantial
  if (response.length > 50) score += 0.2;
  if (response.length > 200) score += 0.1;

  // Check it's not just echoing the prompt
  const promptWords = new Set(prompt.toLowerCase().split(/\s+/).slice(0, 10));
  const responseWords = response.toLowerCase().split(/\s+/).slice(0, 10);
  const overlap = responseWords.filter(w => promptWords.has(w)).length;
  if (overlap < responseWords.length * 0.5) score += 0.2;

  // Check it's not a refusal
  const refusalPatterns = /\b(i cannot|i can't|i'm unable|as an ai|i don't have the ability)\b/i;
  if (!refusalPatterns.test(response)) score += 0.1;

  return Math.min(1, score);
}

function scoreGrammar(response: string): number {
  if (!response.trim()) return 0;
  let score = 0.6;

  // Penalise common grammar issues in the output
  const doubleSpaces = (response.match(/  +/g) ?? []).length;
  const unclosedQuotes = (response.match(/"/g) ?? []).length % 2 !== 0;
  const repeatedWords = (response.match(/\b(\w+)\s+\1\b/gi) ?? []).length;

  if (doubleSpaces > 2) score -= 0.1;
  if (unclosedQuotes) score -= 0.1;
  if (repeatedWords > 1) score -= 0.15;

  // Check for common misspellings that should have been caught
  const commonMisspellings = /\b(teh|recieve|occured|seperate|definately|wierd|accomodate|occurence|tommorow|accross)\b/gi;
  const misspellingCount = (response.match(commonMisspellings) ?? []).length;
  if (misspellingCount > 0) score -= 0.15 * Math.min(misspellingCount, 3);

  // Check for homophone errors in output
  const homophones = /\b(their going|your welcome|its been|could of|should of|would of|alot)\b/gi;
  const homophoneCount = (response.match(homophones) ?? []).length;
  if (homophoneCount > 0) score -= 0.1 * Math.min(homophoneCount, 3);

  // Reward well-structured text
  const sentences = response.split(/[.!?]+/).filter(s => s.trim());
  const avgSentenceLength = response.length / Math.max(sentences.length, 1);
  if (avgSentenceLength > 20 && avgSentenceLength < 200) score += 0.15;
  if (sentences.length >= 3) score += 0.15;

  return Math.max(0, Math.min(1, score));
}

function scoreResponse(
  response: string,
  evalPrompt: EvalPrompt,
): Record<EvalDimension['name'], number> {
  return {
    coherence: scoreCoherence(response),
    creativity: scoreCreativity(response),
    consistency: scoreConsistency(response, evalPrompt.expectedTraits),
    instruction_following: scoreInstructionFollowing(response, evalPrompt.prompt),
    grammar: scoreGrammar(response),
  };
}

function computeWeightedScore(
  scores: Record<EvalDimension['name'], number>,
  dimensions: EvalDimension[],
): number {
  let total = 0;
  let weightSum = 0;
  for (const dim of dimensions) {
    total += (scores[dim.name] ?? 0) * dim.weight;
    weightSum += dim.weight;
  }
  return weightSum > 0 ? total / weightSum : 0;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

const PASS_THRESHOLD = 0.5;

export async function runEvalSuite(
  provider: AIProvider,
  modelName: string,
  prompts: EvalPrompt[] = EVAL_PROMPTS,
  dimensions: EvalDimension[] = DEFAULT_EVAL_DIMENSIONS,
  signal?: AbortSignal,
): Promise<EvalSuiteResult> {
  const results: EvalResult[] = [];

  for (const evalPrompt of prompts) {
    if (signal?.aborted) break;

    const errors: string[] = [];
    let response: AIResponse | null = null;

    try {
      const request: AIRequest = {
        action: evalPrompt.action,
        prompt: evalPrompt.prompt,
        context: evalPrompt.context,
        projectType: 'book',
        signal,
      };

      response = await provider.execute(request);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') break;
      errors.push(err instanceof Error ? err.message : String(err));
    }

    const text = response?.text ?? '';
    const latencyMs = response?.latencyMs ?? 0;

    if (latencyMs > evalPrompt.maxLatencyMs) {
      errors.push(`Latency ${latencyMs}ms exceeds max ${evalPrompt.maxLatencyMs}ms`);
    }

    const scores = response ? scoreResponse(text, evalPrompt) : {
      coherence: 0, creativity: 0, consistency: 0, instruction_following: 0, grammar: 0,
    };
    const weightedScore = computeWeightedScore(scores, dimensions);

    results.push({
      promptId: evalPrompt.id,
      label: evalPrompt.label,
      response: text.slice(0, 500),
      latencyMs,
      scores,
      weightedScore,
      passed: weightedScore >= PASS_THRESHOLD && errors.length === 0,
      errors,
    });
  }

  const overallScore = results.length > 0
    ? results.reduce((sum, r) => sum + r.weightedScore, 0) / results.length
    : 0;
  const passRate = results.length > 0
    ? results.filter(r => r.passed).length / results.length
    : 0;
  const averageLatencyMs = results.length > 0
    ? results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length
    : 0;

  const recommendation: EvalSuiteResult['recommendation'] =
    passRate >= 0.8 && overallScore >= 0.6 ? 'ready' :
    passRate >= 0.5 && overallScore >= 0.4 ? 'needs-work' :
    'not-ready';

  return {
    provider: provider.type,
    model: modelName,
    timestamp: Date.now(),
    results,
    overallScore,
    passRate,
    averageLatencyMs,
    recommendation,
  };
}

/* ------------------------------------------------------------------ */
/*  Result persistence                                                 */
/* ------------------------------------------------------------------ */

const EVAL_RESULTS_KEY = 'draftharbour_eval_results';
const MAX_STORED_RESULTS = 20;

export function saveEvalResult(result: EvalSuiteResult): void {
  try {
    const raw = localStorage.getItem(EVAL_RESULTS_KEY);
    const history: EvalSuiteResult[] = raw ? JSON.parse(raw) : [];
    history.unshift(result);
    if (history.length > MAX_STORED_RESULTS) history.length = MAX_STORED_RESULTS;
    localStorage.setItem(EVAL_RESULTS_KEY, JSON.stringify(history));
  } catch {
    // silently fail for storage quota issues
  }
}

export function loadEvalHistory(): EvalSuiteResult[] {
  try {
    const raw = localStorage.getItem(EVAL_RESULTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
