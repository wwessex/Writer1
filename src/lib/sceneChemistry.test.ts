import { describe, expect, it } from 'vitest';
import { simulateSceneChemistry } from './sceneChemistry';
import type { SceneSimulationInput } from '@/types';

const baseScene: SceneSimulationInput = {
  id: 'scene-1',
  title: 'Basement confrontation',
  summary: 'Mira corners Jonah in a flooded basement and forces him to choose between confession and escape while alarms ring above.',
  pov: 'Mira',
  location: 'Flooded basement',
  conflictType: 'interpersonal',
  stakes: 'If Jonah escapes, the evidence burns and the family loses everything.',
  tags: ['truth', 'betrayal'],
};

describe('scene chemistry simulation', () => {
  it('returns deterministic metric deltas for same input', () => {
    const swap = {
      pov: 'Jonah',
      location: 'Rooftop helipad',
      conflictType: 'survival' as const,
      stakes: 'A helicopter leaves in ninety seconds and only one person can board.',
    };

    const first = simulateSceneChemistry(baseScene, swap);
    const second = simulateSceneChemistry(baseScene, swap);

    expect(first.metrics.delta).toEqual(second.metrics.delta);
    expect(first.metrics.simulated).toEqual(second.metrics.simulated);
    expect(first.confidence).toBe(second.confidence);
  });

  it('handles missing metadata and triggers low-confidence guardrails', () => {
    const sparse: SceneSimulationInput = {
      id: 'scene-2',
      summary: 'They argue.',
    };

    const result = simulateSceneChemistry(sparse, { location: 'Hallway' });

    expect(result.lowConfidence).toBe(true);
    expect(result.confidence).toBeLessThan(65);
    expect(result.confidenceRationale.length).toBeGreaterThan(0);
    expect(Number.isFinite(result.metrics.delta.tension)).toBe(true);
    expect(Number.isFinite(result.metrics.delta.readability)).toBe(true);
    expect(Number.isFinite(result.metrics.delta.thematicAlignment)).toBe(true);
  });
});
