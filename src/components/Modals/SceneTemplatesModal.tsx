import { useState, useMemo } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useToast } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import type { Scene, ProjectType } from '@/types';
import styles from './Modals.module.css';

interface SceneTemplatesModalProps {
  open: boolean;
  onClose: () => void;
}

interface SceneTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'structure' | 'genre' | 'pacing';
  projectTypes: ProjectType[];
  scene: Partial<Scene>;
  beats: string[];
}

const TEMPLATES: SceneTemplate[] = [
  // Structure templates
  {
    id: 'opening-hook',
    name: 'Opening Hook',
    icon: 'play_arrow',
    description: 'Establish character, setting, and an immediate question or tension.',
    category: 'structure',
    projectTypes: ['book', 'screenplay'],
    scene: { status: 'planned', pov: '', summary: 'Establish the world and hook the reader with an immediate question.' },
    beats: ['Sensory anchor (sight, sound, or action)', 'Introduce POV character mid-action', 'Plant the central question or conflict', 'End on a micro-cliffhanger'],
  },
  {
    id: 'rising-action',
    name: 'Rising Action',
    icon: 'trending_up',
    description: 'Escalate stakes through obstacles, choices, or reveals.',
    category: 'structure',
    projectTypes: ['book', 'screenplay'],
    scene: { status: 'planned', summary: 'Escalate pressure with obstacles and difficult choices.' },
    beats: ['Recap the current stakes briefly', 'Introduce a new obstacle or complication', 'Force a difficult choice on the protagonist', 'Raise the stakes with a consequence or reveal'],
  },
  {
    id: 'midpoint-twist',
    name: 'Midpoint Twist',
    icon: 'swap_vert',
    description: 'Shift the story direction with a major revelation or reversal.',
    category: 'structure',
    projectTypes: ['book', 'screenplay'],
    scene: { status: 'planned', summary: 'Deliver a twist that changes everything the character believed.' },
    beats: ['Build false confidence or comfort', 'Deliver the twist or revelation', 'Show immediate emotional reaction', 'Establish the new direction or threat'],
  },
  {
    id: 'climax',
    name: 'Climax Scene',
    icon: 'bolt',
    description: 'The protagonist faces the central conflict head-on.',
    category: 'structure',
    projectTypes: ['book', 'screenplay'],
    scene: { status: 'planned', summary: 'The protagonist confronts the central conflict in a decisive moment.' },
    beats: ['All threads converge', 'Protagonist makes their defining choice', 'The confrontation or decisive action', 'Immediate aftermath and cost'],
  },
  {
    id: 'resolution',
    name: 'Resolution / Denouement',
    icon: 'check_circle',
    description: 'Tie up loose ends and show the new normal.',
    category: 'structure',
    projectTypes: ['book', 'screenplay'],
    scene: { status: 'planned', summary: 'Show the aftermath and the character\'s transformation.' },
    beats: ['Show the new status quo', 'Reflect on what was lost and gained', 'Close character arcs', 'Final image or echo of the opening'],
  },

  // Genre templates
  {
    id: 'mystery-clue',
    name: 'Mystery: Clue Discovery',
    icon: 'search',
    description: 'Plant a clue while misdirecting the reader.',
    category: 'genre',
    projectTypes: ['book', 'screenplay'],
    scene: { status: 'planned', tags: ['mystery', 'clue'], summary: 'Plant a crucial clue hidden in plain sight.' },
    beats: ['Establish the investigation context', 'Present the clue alongside a red herring', 'Character reacts but misinterprets', 'Clue connects to a larger pattern'],
  },
  {
    id: 'romance-tension',
    name: 'Romance: Tension Scene',
    icon: 'favorite',
    description: 'Build romantic tension through proximity and conflict.',
    category: 'genre',
    projectTypes: ['book'],
    scene: { status: 'planned', tags: ['romance'], summary: 'Forced proximity or conflict creates undeniable tension.' },
    beats: ['Force characters into close proximity', 'Build awareness through sensory details', 'Create a moment of vulnerability', 'Interrupt or pull back before resolution'],
  },
  {
    id: 'action-sequence',
    name: 'Action Sequence',
    icon: 'directions_run',
    description: 'Fast-paced action with clear stakes and geography.',
    category: 'genre',
    projectTypes: ['book', 'screenplay'],
    scene: { status: 'planned', tags: ['action'], summary: 'High-stakes action sequence with clear spatial awareness.' },
    beats: ['Establish the space and positions', 'Trigger the action (ambush, chase, fight)', 'Escalate with complications mid-sequence', 'Resolve with a cost or narrow escape'],
  },
  {
    id: 'horror-dread',
    name: 'Horror: Building Dread',
    icon: 'visibility_off',
    description: 'Slowly build unease before a terrifying reveal.',
    category: 'genre',
    projectTypes: ['book', 'screenplay'],
    scene: { status: 'planned', tags: ['horror'], summary: 'Build atmospheric dread leading to a horrifying moment.' },
    beats: ['Establish normalcy with one wrong detail', 'Escalate unease through sensory wrongness', 'Character rationalizes the warning signs', 'The reveal: show just enough to terrify'],
  },

  // Pacing templates
  {
    id: 'quiet-moment',
    name: 'Quiet Character Moment',
    icon: 'self_improvement',
    description: 'Slow down for introspection and character depth.',
    category: 'pacing',
    projectTypes: ['book'],
    scene: { status: 'planned', tags: ['character'], summary: 'A reflective pause that deepens character understanding.' },
    beats: ['Character alone or in safe company', 'Internal reflection on recent events', 'Reveal a vulnerability or secret desire', 'Small decision that foreshadows a larger one'],
  },
  {
    id: 'dialogue-confrontation',
    name: 'Dialogue Confrontation',
    icon: 'forum',
    description: 'Two characters clash through words, subtext, and power dynamics.',
    category: 'pacing',
    projectTypes: ['book', 'screenplay'],
    scene: { status: 'planned', tags: ['dialogue', 'conflict'], summary: 'A verbal confrontation where words are weapons.' },
    beats: ['Establish the power dynamic', 'Each character pursues a hidden agenda', 'Subtext escalates to direct conflict', 'One character gains the upper hand; the other regroups'],
  },
  {
    id: 'montage',
    name: 'Montage / Time Skip',
    icon: 'fast_forward',
    description: 'Compress time to show progress, change, or the passage of events.',
    category: 'pacing',
    projectTypes: ['book', 'screenplay'],
    scene: { status: 'planned', tags: ['montage'], summary: 'Compress time to show transformation or preparation.' },
    beats: ['3-5 vignettes showing change over time', 'Each vignette has a micro-conflict or milestone', 'Sensory anchors differ to show time passing', 'End on a moment that launches the next act'],
  },
];

export function SceneTemplatesModal({ open, onClose }: SceneTemplatesModalProps) {
  const { state, activeChapter, addScene, updateScene } = useApp();
  const { showToast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<SceneTemplate | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | 'structure' | 'genre' | 'pacing'>('all');
  const [povInput, setPovInput] = useState('');
  const [goalInput, setGoalInput] = useState('');

  const filteredTemplates = useMemo(() => {
    return TEMPLATES.filter(t => {
      if (activeCategory !== 'all' && t.category !== activeCategory) return false;
      return t.projectTypes.includes(state.projectType);
    });
  }, [activeCategory, state.projectType]);

  const handleApplyTemplate = () => {
    if (!selectedTemplate || !activeChapter) return;

    const sceneData: Partial<Scene> = {
      ...selectedTemplate.scene,
      title: selectedTemplate.name,
      pov: povInput || selectedTemplate.scene.pov || '',
      wordGoal: parseInt(goalInput) || 0,
      tags: [
        ...(selectedTemplate.scene.tags || []),
        ...selectedTemplate.beats.map((_, i) => `beat-${i + 1}`),
      ],
      summary: [
        selectedTemplate.scene.summary || '',
        '',
        'BEATS:',
        ...selectedTemplate.beats.map((b, i) => `${i + 1}. ${b}`),
      ].join('\n'),
    };

    addScene(activeChapter.id);


    // We apply updates through a brief timeout to let the state update
    setTimeout(() => {
      const updatedChapter = document.querySelector('[data-chapter-id]');
      if (updatedChapter) return;
      // Fallback: update the last scene
      const lastScene = activeChapter.scenes?.[activeChapter.scenes.length];
      if (lastScene) {
        updateScene(activeChapter.id, lastScene.id, sceneData);
      }
    }, 100);

    showToast(`Applied "${selectedTemplate.name}" template`, 'success', 'auto_awesome');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Scene Templates" size="large">
      <div className={styles.templatesLayout}>
        {/* Category filters */}
        <div className={styles.templateCategories}>
          {(['all', 'structure', 'genre', 'pacing'] as const).map(cat => (
            <button
              key={cat}
              className={`${styles.templateCategoryBtn} ${activeCategory === cat ? styles['templateCategoryBtn--active'] : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              <span className="material-symbols-rounded">
                {cat === 'all' ? 'apps' : cat === 'structure' ? 'account_tree' : cat === 'genre' ? 'category' : 'speed'}
              </span>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className={styles.templatesGrid}>
          {/* Template list */}
          <div className={styles.templateList}>
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className={`${styles.templateCard} ${selectedTemplate?.id === template.id ? styles['templateCard--selected'] : ''}`}
                onClick={() => setSelectedTemplate(template)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') setSelectedTemplate(template); }}
              >
                <div className={styles.templateCard__icon}>
                  <span className="material-symbols-rounded">{template.icon}</span>
                </div>
                <div className={styles.templateCard__info}>
                  <span className={styles.templateCard__name}>{template.name}</span>
                  <span className={styles.templateCard__desc}>{template.description}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Template detail */}
          <div className={styles.templateDetail}>
            {selectedTemplate ? (
              <>
                <div className={styles.templateDetail__header}>
                  <span className="material-symbols-rounded" style={{ fontSize: '2rem', color: 'var(--accent)' }}>
                    {selectedTemplate.icon}
                  </span>
                  <div>
                    <h4 className={styles.templateDetail__title}>{selectedTemplate.name}</h4>
                    <p className={styles.templateDetail__desc}>{selectedTemplate.description}</p>
                  </div>
                </div>

                <div className={styles.templateDetail__beats}>
                  <h5>Scene Beats</h5>
                  <ol className={styles.beatList}>
                    {selectedTemplate.beats.map((beat, i) => (
                      <li key={i} className={styles.beatItem}>
                        <span className={styles.beatItem__number}>{i + 1}</span>
                        <span>{beat}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {selectedTemplate.scene.tags && selectedTemplate.scene.tags.length > 0 && (
                  <div className={styles.templateDetail__tags}>
                    {selectedTemplate.scene.tags.map(tag => (
                      <span key={tag} className={styles.templateTag}>{tag}</span>
                    ))}
                  </div>
                )}

                <div className={styles.templateDetail__config}>
                  <div className={styles.templateDetail__field}>
                    <label>POV Character (optional)</label>
                    <input
                      className={styles.templateInput}
                      value={povInput}
                      onChange={e => setPovInput(e.target.value)}
                      placeholder="e.g., Sarah, Detective Mills"
                    />
                  </div>
                  <div className={styles.templateDetail__field}>
                    <label>Word Goal (optional)</label>
                    <input
                      className={styles.templateInput}
                      type="number"
                      value={goalInput}
                      onChange={e => setGoalInput(e.target.value)}
                      placeholder="e.g., 2000"
                    />
                  </div>
                </div>

                <div className={styles.templateDetail__actions}>
                  <Button
                    variant="primary"
                    onClick={handleApplyTemplate}
                    disabled={!activeChapter}
                  >
                    <span className="material-symbols-rounded">add</span>
                    Add Scene from Template
                  </Button>
                  {!activeChapter && (
                    <p className={styles.templateDetail__hint}>Select a chapter first to add a scene.</p>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.templateEmptyDetail}>
                <span className="material-symbols-rounded">auto_awesome</span>
                <p>Select a template to preview its structure, beats, and goals.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
