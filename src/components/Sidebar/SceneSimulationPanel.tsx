import { Input, Textarea } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import type { Scene, SceneConflictType, SceneSimulationSwapCandidate } from '@/types';
import type { simulateChapterSceneChemistry } from '@/lib/sceneChemistry';
import styles from './ScenePlanner.module.css';

interface SceneSimulationPanelProps {
  scenes: Scene[];
  simulatedSceneId: string;
  setSimulatedSceneId: (id: string) => void;
  swapCandidate: SceneSimulationSwapCandidate;
  setSwapCandidate: React.Dispatch<React.SetStateAction<SceneSimulationSwapCandidate>>;
  simulationResult: ReturnType<typeof simulateChapterSceneChemistry> | null;
  conflictOptions: { value: SceneConflictType; label: string }[];
}

export function SceneSimulationPanel({
  scenes,
  simulatedSceneId,
  setSimulatedSceneId,
  swapCandidate,
  setSwapCandidate,
  simulationResult,
  conflictOptions,
}: SceneSimulationPanelProps) {
  return (
    <div className={styles.simulatorPanel}>
      <div className={styles.simulatorPanel__header}>
        <h4>Scene Chemistry Simulation</h4>
        <p>Pick a scene and test swaps for POV, location, conflict type, and stakes to preview projected impact.</p>
      </div>
      <div className={styles.simulatorPanel__grid}>
        <div>
          <label>Scene</label>
          <Select
            options={scenes.map(scene => ({ value: scene.id, label: scene.title || 'Untitled scene' }))}
            value={simulatedSceneId || (scenes[0]?.id || '')}
            onChange={e => setSimulatedSceneId(e.target.value)}
          />
        </div>
        <div>
          <label>Swap POV</label>
          <Input
            value={swapCandidate.pov || ''}
            onChange={e => setSwapCandidate(prev => ({ ...prev, pov: e.target.value || undefined }))}
            placeholder="e.g. Antagonist"
          />
        </div>
        <div>
          <label>Swap Location</label>
          <Input
            value={swapCandidate.location || ''}
            onChange={e => setSwapCandidate(prev => ({ ...prev, location: e.target.value || undefined }))}
            placeholder="e.g. Flooded subway"
          />
        </div>
        <div>
          <label>Swap Conflict Type</label>
          <Select
            options={[{ value: '', label: 'No swap' }, ...conflictOptions]}
            value={swapCandidate.conflictType || ''}
            onChange={e => setSwapCandidate(prev => ({ ...prev, conflictType: (e.target.value || undefined) as SceneConflictType | undefined }))}
          />
        </div>
        <div className={styles.simulatorPanel__full}>
          <label>Swap Stakes</label>
          <Textarea
            value={swapCandidate.stakes || ''}
            onChange={e => setSwapCandidate(prev => ({ ...prev, stakes: e.target.value || undefined }))}
            rows={2}
            placeholder="What is at risk if the scene fails?"
          />
        </div>
      </div>

      {simulationResult && (
        <div className={styles.simulatorPanel__results}>
          <div className={styles.simulatorMetrics}>
            <div>
              <strong>Tension</strong>
              <span>{simulationResult.metrics.simulated.tension} ({simulationResult.metrics.delta.tension >= 0 ? '+' : ''}{simulationResult.metrics.delta.tension})</span>
            </div>
            <div>
              <strong>Readability</strong>
              <span>{simulationResult.metrics.simulated.readability} ({simulationResult.metrics.delta.readability >= 0 ? '+' : ''}{simulationResult.metrics.delta.readability})</span>
            </div>
            <div>
              <strong>Thematic alignment</strong>
              <span>{simulationResult.metrics.simulated.thematicAlignment} ({simulationResult.metrics.delta.thematicAlignment >= 0 ? '+' : ''}{simulationResult.metrics.delta.thematicAlignment})</span>
            </div>
          </div>
          <p className={styles.simulatorPanel__rationale}>{simulationResult.rationale}</p>
          <p className={styles.simulatorPanel__direction}><strong>Recommended rewrite direction:</strong> {simulationResult.recommendedRewriteDirection}</p>
          <p className={styles.simulatorPanel__confidence}>
            Confidence: <strong>{simulationResult.confidence}%</strong>
          </p>
          {simulationResult.lowConfidence && (
            <div className={styles.simulatorPanel__guardrail}>
              <strong>Low-confidence projection.</strong> Add more scene summary detail, explicit stakes, and POV metadata before relying on these deltas.
              <ul>
                {simulationResult.confidenceRationale.map(reason => <li key={reason}>{reason}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
