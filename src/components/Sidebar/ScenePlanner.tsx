import { useState, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { IconButton, Button, Input, Textarea } from '@/components/UI';
import { Tooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import type { Scene, SceneConflictType, SceneSimulationSwapCandidate } from '@/types';
import { simulateChapterSceneChemistry } from '@/lib/sceneChemistry';
import { useDragReorder } from '@/hooks/useDragReorder';
import { STATUS_OPTIONS, SCREENPLAY_INT_EXT_OPTIONS, SCREENPLAY_TIME_OPTIONS } from '@/lib/constants';
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
        {filteredScenes.map((scene, index) => {
          const isDragging = dragState.draggedId === scene.id;
          const isDropTarget = dragState.dropTargetId === scene.id && dragState.draggedId !== scene.id;
          const isExpanded = expandedId === scene.id;
          const isJustMoved = justMovedId === scene.id;

          return (
            <div
              key={scene.id}
              className={[
                styles.sceneCard,
                isDragging && styles['sceneCard--dragging'],
                isDropTarget && styles['sceneCard--dropTarget'],
                isJustMoved && styles['sceneCard--justMoved']
              ].filter(Boolean).join(' ')}
              draggable
              onDragStart={e => handleDragStart(e, scene.id)}
              onDragOver={e => handleDragOver(e, scene.id)}
              onDragEnd={handleDragEnd}
              onDrop={e => handleDrop(e, scene.id)}
            >
              <div className={styles.sceneCard__header} onClick={() => setExpandedId(isExpanded ? null : scene.id)}>
                <Tooltip content="Drag to reorder" position="left">
                  <span className={styles.sceneCard__drag}>
                    <span className="material-symbols-rounded">drag_indicator</span>
                  </span>
                </Tooltip>
                <span className={styles.sceneCard__number}>{index + 1}</span>
                <span className={styles.sceneCard__title}>{scene.title || 'Untitled Scene'}</span>
                <span className={`${styles.sceneCard__status} ${styles[`sceneCard__status--${scene.status}`]}`}>
                  {scene.status}
                </span>
                <Tooltip content={isExpanded ? 'Collapse scene details' : 'Expand scene details'} position="left">
                  <span className="material-symbols-rounded">
                    {isExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </Tooltip>
              </div>

              {isExpanded && (
                <div className={styles.sceneCard__body}>
                  <div className={styles.sceneCard__field}>
                    <label>Title</label>
                    <Input
                      value={scene.title}
                      onChange={e => handleUpdate(scene.id, { title: e.target.value })}
                      placeholder="Scene title"
                    />
                  </div>
                  <div className={styles.sceneCard__field}>
                    <label>Summary</label>
                    <Textarea
                      value={scene.summary}
                      onChange={e => handleUpdate(scene.id, { summary: e.target.value })}
                      placeholder="What happens in this scene..."
                      rows={4}
                    />
                  </div>
                  <div className={styles.sceneCard__fieldRow}>
                    <div className={styles.sceneCard__field}>
                      <label>Status</label>
                      <Select
                        options={STATUS_OPTIONS}
                        value={scene.status}
                        onChange={e => handleUpdate(scene.id, { status: e.target.value as Scene['status'] })}
                      />
                    </div>
                    <div className={styles.sceneCard__field}>
                      <label>Production Tag</label>
                      <Input
                        value={(scene.productionTags || []).join(', ')}
                        onChange={e => handleUpdate(scene.id, { productionTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                        placeholder="vfx, stunt"
                      />
                    </div>
                  </div>

                  {isScreenplay && (
                    <>
                      <div className={styles.sceneCard__fieldRow}>
                        <div className={styles.sceneCard__field}>
                          <label>Slug Line</label>
                          <Input
                            value={scene.slugLine || ''}
                            onChange={e => handleUpdate(scene.id, { slugLine: e.target.value })}
                            placeholder="INT. OFFICE - DAY"
                          />
                        </div>
                        <div className={styles.sceneCard__field}>
                          <label>Location</label>
                          <Input
                            value={scene.location || ''}
                            onChange={e => handleUpdate(scene.id, { location: e.target.value })}
                            placeholder="Office"
                          />
                        </div>
                      </div>
                      <div className={styles.sceneCard__fieldRow}>
                        <div className={styles.sceneCard__field}>
                          <label>INT/EXT</label>
                          <Select
                            options={SCREENPLAY_INT_EXT_OPTIONS}
                            value={scene.interiorExterior || 'INT'}
                            onChange={e => handleUpdate(scene.id, { interiorExterior: e.target.value as Scene['interiorExterior'] })}
                          />
                        </div>
                        <div className={styles.sceneCard__field}>
                          <label>Time</label>
                          <Select
                            options={SCREENPLAY_TIME_OPTIONS}
                            value={scene.timeOfDay || 'DAY'}
                            onChange={e => handleUpdate(scene.id, { timeOfDay: e.target.value as Scene['timeOfDay'] })}
                          />
                        </div>
                      </div>
                      <div className={styles.sceneCard__field}>
                        <label>Page Estimate</label>
                        <Input
                          type="number"
                          value={scene.pageEstimate || ''}
                          onChange={e => handleUpdate(scene.id, { pageEstimate: parseInt(e.target.value) || 0 })}
                          placeholder="1"
                        />
                      </div>
                    </>
                  )}

                  <div className={styles.sceneCard__actions}>
                    <Tooltip content="Edit scene in expanded view" position="top">
                      <Button variant="ghost" size="small" onClick={() => setPopoutSceneId(scene.id)}>
                        <span className="material-symbols-rounded">open_in_full</span>
                        Expand
                      </Button>
                    </Tooltip>
                    <Button variant="danger" size="small" onClick={() => handleDelete(scene.id)}>
                      <span className="material-symbols-rounded">delete</span>
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
          <div className={styles.popoutOverlay} onClick={e => { if (e.target === e.currentTarget) setPopoutSceneId(null); }}>
            <div className={styles.popoutEditor}>
              <div className={styles.popoutEditor__header}>
                <h3 className={styles.popoutEditor__title}>{popoutScene.title || 'Untitled Scene'}</h3>
                <IconButton icon="close" label="Close" variant="ghost" onClick={() => setPopoutSceneId(null)} />
              </div>
              <div className={styles.popoutEditor__body}>
                <div>
                  <label>Title</label>
                  <Input
                    value={popoutScene.title}
                    onChange={e => handleUpdate(popoutScene.id, { title: e.target.value })}
                    placeholder="Scene title"
                  />
                </div>
                <div>
                  <label>Summary</label>
                  <Textarea
                    value={popoutScene.summary}
                    onChange={e => handleUpdate(popoutScene.id, { summary: e.target.value })}
                    placeholder="Describe what happens in this scene in detail..."
                    rows={6}
                  />
                </div>
                <div className={styles.popoutEditor__fieldRow}>
                  <div>
                    <label>Status</label>
                    <Select
                      options={STATUS_OPTIONS}
                      value={popoutScene.status}
                      onChange={e => handleUpdate(popoutScene.id, { status: e.target.value as Scene['status'] })}
                    />
                  </div>
                  <div>
                    <label>Production Tags</label>
                    <Input
                      value={(popoutScene.productionTags || []).join(', ')}
                      onChange={e => handleUpdate(popoutScene.id, { productionTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                      placeholder="vfx, stunt"
                    />
                  </div>
                </div>
                {isScreenplay && (
                  <>
                    <div className={styles.popoutEditor__fieldRow}>
                      <div>
                        <label>Slug Line</label>
                        <Input
                          value={popoutScene.slugLine || ''}
                          onChange={e => handleUpdate(popoutScene.id, { slugLine: e.target.value })}
                          placeholder="INT. OFFICE - DAY"
                        />
                      </div>
                      <div>
                        <label>Location</label>
                        <Input
                          value={popoutScene.location || ''}
                          onChange={e => handleUpdate(popoutScene.id, { location: e.target.value })}
                          placeholder="Office"
                        />
                      </div>
                    </div>
                    <div className={styles.popoutEditor__fieldRow}>
                      <div>
                        <label>INT/EXT</label>
                        <Select
                          options={SCREENPLAY_INT_EXT_OPTIONS}
                          value={popoutScene.interiorExterior || 'INT'}
                          onChange={e => handleUpdate(popoutScene.id, { interiorExterior: e.target.value as Scene['interiorExterior'] })}
                        />
                      </div>
                      <div>
                        <label>Time</label>
                        <Select
                          options={SCREENPLAY_TIME_OPTIONS}
                          value={popoutScene.timeOfDay || 'DAY'}
                          onChange={e => handleUpdate(popoutScene.id, { timeOfDay: e.target.value as Scene['timeOfDay'] })}
                        />
                      </div>
                    </div>
                    <div>
                      <label>Page Estimate</label>
                      <Input
                        type="number"
                        value={popoutScene.pageEstimate || ''}
                        onChange={e => handleUpdate(popoutScene.id, { pageEstimate: parseInt(e.target.value) || 0 })}
                        placeholder="1"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className={styles.popoutEditor__footer}>
                <Button variant="primary" onClick={() => setPopoutSceneId(null)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
