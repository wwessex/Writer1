import type {
  Scene,
  SceneSimulationInput,
  SceneSimulationMetricSet,
  SceneSimulationResult,
  SceneSimulationSwapCandidate,
} from '@/types';
import { calculateFleschScore, countWords } from '@/lib/utils';
import { calculateSceneSimulationMetrics } from '@/lib/projectMetrics';

const CONFLICT_TENSION_WEIGHT: Record<NonNullable<SceneSimulationInput['conflictType']>, number> = {
  interpersonal: 12,
  internal: 6,
  environmental: 10,
  societal: 9,
  mystery: 8,
  survival: 14,
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}

function toSimulationInput(scene: Scene): SceneSimulationInput {
  return {
    id: scene.id,
    title: scene.title,
    summary: scene.summary,
    pov: scene.pov,
    location: scene.location,
    stakes: scene.tags?.join(' ') || '',
    tags: scene.tags,
    productionTags: scene.productionTags,
  };
}

function detectConflictType(text: string): SceneSimulationInput['conflictType'] {
  const normalized = text.toLowerCase();
  if (/storm|fire|flood|terrain|weather/.test(normalized)) return 'environmental';
  if (/society|law|system|institution|court|police/.test(normalized)) return 'societal';
  if (/survive|hunger|escape|chase|predator/.test(normalized)) return 'survival';
  if (/secret|clue|mystery|unknown|evidence/.test(normalized)) return 'mystery';
  if (/doubt|fear|guilt|memory|regret/.test(normalized)) return 'internal';
  return 'interpersonal';
}

function getThematicTokens(input: SceneSimulationInput): string[] {
  const parts = [input.summary || '', input.stakes || '', ...(input.tags || [])].join(' ').toLowerCase();
  return parts.match(/[a-z']+/g) || [];
}

function calculateSceneMetrics(input: SceneSimulationInput): SceneSimulationMetricSet {
  const summary = input.summary || '';
  const flesch = calculateFleschScore(summary);
  const readability = clamp(flesch || 35);
  const words = countWords(summary);
  const stakesWeight = Math.min(16, countWords(input.stakes || '') * 2);
  const conflictType = (input.conflictType || detectConflictType([input.title, summary, input.stakes].join(' ')) || 'interpersonal') as NonNullable<SceneSimulationInput['conflictType']>;
  const conflictWeight = CONFLICT_TENSION_WEIGHT[conflictType] || 8;
  const tension = clamp(28 + Math.min(words / 2, 34) + stakesWeight + conflictWeight);

  const themeTokens = getThematicTokens(input);
  const uniqueTokenRatio = themeTokens.length > 0 ? new Set(themeTokens).size / themeTokens.length : 0;
  const povBonus = input.pov ? 12 : 0;
  const locationBonus = input.location ? 10 : 0;
  const thematicAlignment = clamp(30 + uniqueTokenRatio * 40 + povBonus + locationBonus);

  return {
    tension,
    readability,
    thematicAlignment,
  };
}

function makeRationale(delta: SceneSimulationMetricSet): string {
  const notes: string[] = [];
  if (delta.tension > 3) notes.push('increase pressure and urgency beats');
  if (delta.readability < -3) notes.push('simplify sentence flow to preserve clarity');
  if (delta.thematicAlignment > 3) notes.push('reinforce scene motifs and symbolic callbacks');
  if (notes.length === 0) return 'Changes are subtle; focus on voice continuity and objective clarity.';
  return `Simulation suggests you should ${notes.join(', ')}.`;
}

function buildConfidence(input: SceneSimulationInput, swap: SceneSimulationSwapCandidate): {
  confidence: number;
  lowConfidence: boolean;
  reasons: string[];
} {
  let confidence = 0.45;
  const reasons: string[] = [];

  const summaryWords = countWords(input.summary || '');
  if (summaryWords >= 18) {
    confidence += 0.2;
  } else {
    reasons.push('Scene summary is short, limiting signal quality.');
  }

  if (input.pov || swap.pov) {
    confidence += 0.1;
  } else {
    reasons.push('POV is missing, reducing character-intent certainty.');
  }

  if (input.location || swap.location) {
    confidence += 0.1;
  } else {
    reasons.push('Location is missing, reducing situational context.');
  }

  if ((input.stakes && countWords(input.stakes) > 2) || (swap.stakes && countWords(swap.stakes) > 2)) {
    confidence += 0.1;
  } else {
    reasons.push('Stakes detail is sparse, so tension deltas may underfit.');
  }

  if (input.conflictType || swap.conflictType) {
    confidence += 0.1;
  } else {
    reasons.push('Conflict type is inferred, which is less reliable than explicit metadata.');
  }

  const normalized = clamp(confidence * 100);
  return {
    confidence: normalized,
    lowConfidence: normalized < 65,
    reasons,
  };
}

export function simulateSceneChemistry(
  sceneInput: SceneSimulationInput,
  swapCandidate: SceneSimulationSwapCandidate,
): SceneSimulationResult {
  const merged: SceneSimulationInput = {
    ...sceneInput,
    ...swapCandidate,
    id: sceneInput.id,
  };

  const baseline = calculateSceneMetrics(sceneInput);
  const simulated = calculateSceneMetrics(merged);
  const metrics = calculateSceneSimulationMetrics(baseline, simulated);
  const confidenceState = buildConfidence(sceneInput, swapCandidate);

  const recommendedRewriteDirection = metrics.delta.tension >= 0
    ? 'Lean into escalating beats and sharper reversals in the middle third of the scene.'
    : 'Reduce exposition density and reframe conflict turns with clearer intent-action lines.';

  return {
    sceneId: sceneInput.id,
    appliedSwaps: swapCandidate,
    metrics,
    confidence: confidenceState.confidence,
    confidenceRationale: confidenceState.reasons,
    lowConfidence: confidenceState.lowConfidence,
    rationale: makeRationale(metrics.delta),
    recommendedRewriteDirection,
  };
}

export function simulateChapterSceneChemistry(
  scenes: Scene[],
  sceneId: string,
  swapCandidate: SceneSimulationSwapCandidate,
): SceneSimulationResult | null {
  const target = scenes.find(scene => scene.id === sceneId);
  if (!target) return null;
  return simulateSceneChemistry(toSimulationInput(target), swapCandidate);
}
