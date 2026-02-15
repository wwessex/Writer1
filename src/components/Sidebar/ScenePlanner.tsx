import { useState, useCallback, useRef, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { IconButton, Button, Input, Textarea } from '@/components/UI';
import { Select } from '@/components/UI/Select';
import type { Scene } from '@/types';
import styles from './ScenePlanner.module.css';

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'draft', label: 'Draft' },
  { value: 'revised', label: 'Revised' },
  { value: 'final', label: 'Final' }
];

export function ScenePlanner() {
  const { state, activeChapter, addScene, updateScene, deleteScene, reorderScenes } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'draft' | 'revised' | 'final'>('all');
  const [productionTagFilter, setProductionTagFilter] = useState('all');
  const [dragState, setDragState] = useState<{
    dragging: boolean;
    draggedId: string | null;
    dropTargetId: string | null;
  }>({
    dragging: false,
    draggedId: null,
    dropTargetId: null
  });
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isScreenplay = state.projectType === 'screenplay';
  const scenes = useMemo(() => activeChapter?.scenes || [], [activeChapter?.scenes]);

  const productionTags = useMemo(() => {
    const tags = new Set<string>();
    scenes.forEach(scene => (scene.productionTags || []).forEach(tag => tags.add(tag)));
    return Array.from(tags).sort();
  }, [scenes]);

  const filteredScenes = useMemo(() => {
    return scenes.filter(scene => {
      const statusOk = statusFilter === 'all' || scene.status === statusFilter;
      const tagOk = productionTagFilter === 'all' || (scene.productionTags || []).includes(productionTagFilter);
      return statusOk && tagOk;
    });
  }, [scenes, statusFilter, productionTagFilter]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDragState({ dragging: true, draggedId: id, dropTargetId: null });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragState(prev => ({ ...prev, dropTargetId: id }));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragState({ dragging: false, draggedId: null, dropTargetId: null });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!activeChapter) return;

    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== targetId) {
      const scenesCopy = [...scenes];
      const dragIdx = scenesCopy.findIndex(s => s.id === draggedId);
      const targetIdx = scenesCopy.findIndex(s => s.id === targetId);

      if (dragIdx !== -1 && targetIdx !== -1) {
        const [dragged] = scenesCopy.splice(dragIdx, 1);
        scenesCopy.splice(targetIdx, 0, dragged);
        reorderScenes(activeChapter.id, scenesCopy.map(s => s.id));

        setJustMovedId(draggedId);
        clearTimeout(animRef.current);
        animRef.current = setTimeout(() => setJustMovedId(null), 300);
      }
    }

    setDragState({ dragging: false, draggedId: null, dropTargetId: null });
  }, [activeChapter, scenes, reorderScenes]);

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
        <IconButton icon="add" label="Add Scene" variant="ghost" onClick={handleAddScene} />
      </div>

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
                <span className={styles.sceneCard__drag}>
                  <span className="material-symbols-rounded">drag_indicator</span>
                </span>
                <span className={styles.sceneCard__number}>{index + 1}</span>
                <span className={styles.sceneCard__title}>{scene.title || 'Untitled Scene'}</span>
                <span className={`${styles.sceneCard__status} ${styles[`sceneCard__status--${scene.status}`]}`}>
                  {scene.status}
                </span>
                <span className="material-symbols-rounded">
                  {isExpanded ? 'expand_less' : 'expand_more'}
                </span>
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
                      rows={3}
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
                            options={[
                              { value: 'INT', label: 'INT' },
                              { value: 'EXT', label: 'EXT' },
                              { value: 'INT/EXT', label: 'INT/EXT' }
                            ]}
                            value={scene.interiorExterior || 'INT'}
                            onChange={e => handleUpdate(scene.id, { interiorExterior: e.target.value as Scene['interiorExterior'] })}
                          />
                        </div>
                        <div className={styles.sceneCard__field}>
                          <label>Time</label>
                          <Select
                            options={[
                              { value: 'DAY', label: 'DAY' },
                              { value: 'NIGHT', label: 'NIGHT' },
                              { value: 'DAWN', label: 'DAWN' },
                              { value: 'DUSK', label: 'DUSK' }
                            ]}
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
    </section>
  );
}
