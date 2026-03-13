export type SceneConflictType = 'interpersonal' | 'internal' | 'environmental' | 'societal' | 'mystery' | 'survival';

export interface SceneSimulationInput {
  id: string;
  title?: string;
  summary?: string;
  pov?: string;
  location?: string;
  conflictType?: SceneConflictType;
  stakes?: string;
  tags?: string[];
  productionTags?: string[];
}

export interface SceneSimulationSwapCandidate {
  pov?: string;
  location?: string;
  conflictType?: SceneConflictType;
  stakes?: string;
}

export interface SceneSimulationMetricSet {
  tension: number;
  readability: number;
  thematicAlignment: number;
}

export interface SceneSimulationMetrics {
  baseline: SceneSimulationMetricSet;
  simulated: SceneSimulationMetricSet;
  delta: SceneSimulationMetricSet;
}

export interface SceneSimulationResult {
  sceneId: string;
  appliedSwaps: SceneSimulationSwapCandidate;
  metrics: SceneSimulationMetrics;
  confidence: number;
  confidenceRationale: string[];
  rationale: string;
  recommendedRewriteDirection: string;
  lowConfidence: boolean;
}
