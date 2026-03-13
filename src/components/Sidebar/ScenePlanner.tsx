import { useState, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { IconButton } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import type { Scene, SceneConflictType, SceneSimulationSwapCandidate } from '@/types';
import { simulateChapterSceneChemistry } from '@/lib/sceneChemistry';
import { useDragReorder } from '@/hooks/useDragReorder';
import { STATUS_OPTIONS } from '@/lib/constants';
import { SceneSimulationPanel } from './SceneSimulationPanel';
import { SceneCard } from './SceneCard';
import { ScenePopoutEditor } from './ScenePopoutEditor';
import styles from './ScenePlanner.module.css';

export function ScenePlanner() {
  const { state, activeChapter, addScene, updateScene, deleteScene, reorderScenes } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [popoutSceneId, setPopoutSceneId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'draft' | 'revised' | 'final'>('all');
  const [productionTagFilter, setProductionTagFilter] = useState('all');
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [simulatedSceneId, setSimulatedSceneId] = useState<string>('');
  const [swapCandidate, setSwapCandidate] = useState<SceneSimulationSwapCandidate>({});

  const isScreenplay = state.projectType === 'screenplay';
  const scenes = useMemo(() => activeChapter?.scenes || [], [activeChapter?.scenes]);

  const handleSceneReorder = useCallback((ids: string[]) => {
    if (activeChapter) {
      reorderScenes(activeChapter.id, ids);
    }
  }, [activeChapter, reorderScenes]);

  const { dragState, justMovedId, handleDragStart, handleDragOver, handleDragEnd, handleDrop } = useDragReorder({
    items: scenes,
    onReorder: handleSceneReorder,
  });

  const productionTags = useMemo(() => {
    const tags = new Set<string>();
    scenes.forEach(scene => (scene.productionTags || []).forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [scenes]);

  const simulationResult = useMemo(() => {
    if (!simulatorOpen || !activeChapter || !simulatedSceneId) return null;
    return simulateChapterSceneChemistry(activeChapter.scenes || [], simulatedSceneId, swapCandidate);
  }, [simulatorOpen, activeChapter, simulatedSceneId, swapCandidate]);

  const filteredScenes = useMemo(() => {
    return scenes.filter(scene => {
      const statusOk = statusFilter === 'all' || scene.status === statusFilter;
      const tagOk = productionTagFilter === 'all' || (scene.productionTags || []).includes(productionTagFilter);
      return statusOk && tagOk;
    });
  }, [scenes, statusFilter, productionTagFilter]);

  const handleUpdate = (sceneId: string, updates: Partial<Scene>) => {
    if (!activeChapter) return;
    updateScene(activeChapter.id, sceneId, updates);
  };

  const handleDelete = (sceneId: string) => {
    if (!activeChapter) return;
    if (confirm('Delete this scene?')) {
      deleteScene(activeChapter.id, sceneId);
      if (expandedId === sceneId) setExpandedId(null);
    }
  };

  const handleAddScene = () => {
    if (!activeChapter) return;
    addScene(activeChapter.id);
  };

  const conflictOptions: { value: SceneConflictType; label: string }[] = [
    { value: 'interpersonal', label: 'Interpersonal' },
    { value: 'internal', label: 'Internal' },
    { value: 'environmental', label: 'Environmental' },
    { value: 'societal', label: 'Societal' },
    { value: 'mystery', label: 'Mystery' },
    { value: 'survival', label: 'Survival' },
  ];

  if (!activeChapter) {
    return (
      <section className={styles.scenePlanner}>
        <div className={styles.scenePlanner__header}>
          <h3 className={styles.scenePlanner__title}>Scene Planner</h3>
        </div>
        <p className={styles.scenePlanner__empty}>Select a {isScreenplay ? 'scene group' : 'chapter'} first</p>
      </section>
    );
  }

  return (
    <section className={styles.scenePlanner}>
      <div className={styles.scenePlanner__header}>
        <h3 className={styles.scenePlanner__title}>
          {isScreenplay ? 'Scene Planner' : 'Scenes'}
          {filteredScenes.length > 0 && <span className={styles.scenePlanner__count}>{filteredScenes.length}</span>}
        </h3>
        <div className={styles.scenePlanner__headerActions}>
          <Tooltip content="Simulate impact from scene variable swaps" position="bottom">
            <IconButton
              icon="model_training"
              label="Scene Chemistry Simulator"
              variant="ghost"
              onClick={() => {
                setSimulatorOpen(prev => !prev);
                if (!simulatedSceneId && scenes.length > 0) setSimulatedSceneId(scenes[0].id);
              }}
            />
          </Tooltip>
          <Tooltip content="Add a new scene" position="bottom">
            <IconButton icon="add" label="Add Scene" variant="ghost" onClick={handleAddScene} />
          </Tooltip>
        </div>
      </div>

      {simulatorOpen && (
        <SceneSimulationPanel
          scenes={scenes}
          simulatedSceneId={simulatedSceneId}
          setSimulatedSceneId={setSimulatedSceneId}
          swapCandidate={swapCandidate}
          setSwapCandidate={setSwapCandidate}
          simulationResult={simulationResult}
          conflictOptions={conflictOptions}
        />
      )}

      <div className={styles.scenePlanner__items}>
        <Select
          options={[{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS]}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
        />
        <Select
          options={[{ value: 'all', label: 'All production tags' }, ...productionTags.map(tag => ({ value: tag, label: tag }))]}
          value={productionTagFilter}
          onChange={e => setProductionTagFilter(e.target.value)}
        />
        {filteredScenes.map((scene, index) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            index={index}
            isScreenplay={isScreenplay}
            isExpanded={expandedId === scene.id}
            onToggle={() => setExpandedId(expandedId === scene.id ? null : scene.id)}
            isDragging={dragState.draggedId === scene.id}
            isDropTarget={dragState.dropTargetId === scene.id && dragState.draggedId !== scene.id}
            isJustMoved={justMovedId === scene.id}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onExpand={setPopoutSceneId}
          />
        ))}
      </div>

      {filteredScenes.length === 0 && scenes.length === 0 && (
        <div className={styles.scenePlanner__emptyState}>
          <span className={`material-symbols-rounded ${styles.scenePlanner__emptyIcon}`}>movie_filter</span>
          <p className={styles.scenePlanner__empty}>
            No scenes yet. Break your {isScreenplay ? 'sequence' : 'chapter'} into scenes to plan structure, track POV, and set goals.
          </p>
          <button className={styles.scenePlanner__ctaBtn} onClick={handleAddScene}>
            <span className="material-symbols-rounded">add</span>
            Create First Scene
          </button>
        </div>
      )}
      {filteredScenes.length === 0 && scenes.length > 0 && (
        <p className={styles.scenePlanner__empty}>
          No scenes match current filters. Adjust the status or tag filter above.
        </p>
      )}

      {/* Pop-out scene editor overlay */}
      {popoutSceneId && (() => {
        const popoutScene = scenes.find(s => s.id === popoutSceneId);
        if (!popoutScene) return null;
        return (
          <ScenePopoutEditor
            scene={popoutScene}
            isScreenplay={isScreenplay}
            onUpdate={handleUpdate}
            onClose={() => setPopoutSceneId(null)}
          />
        );
      })()}
    </section>
  );
}
