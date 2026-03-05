/**
 * Guided Book Flow wizard modal.
 *
 * Walks the user through structured phases from concept to manuscript:
 * 1. Concept & Premise
 * 2. Research & World-Building
 * 3. AI-Assisted Outline
 * 4. Sample Chapter
 * 5. Full Manuscript
 */

import { useState, useEffect, useCallback } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useToast } from '@/components/UI';
import {
  GUIDED_FLOW_PHASES,
  createInitialFlowState,
  loadGuidedFlowState,
  saveGuidedFlowState,
  clearGuidedFlowState,
} from '@/lib/ai/guidedFlow';
import type { GuidedFlowState, GuidedFlowPhase } from '@/lib/ai/guidedFlow';
import styles from './Modals.module.css';

interface GuidedFlowModalProps {
  open: boolean;
  onClose: () => void;
}

export function GuidedFlowModal({ open, onClose }: GuidedFlowModalProps) {
  const { showToast } = useToast();
  const [flowState, setFlowState] = useState<GuidedFlowState>(createInitialFlowState);

  useEffect(() => {
    if (open) {
      const saved = loadGuidedFlowState();
      if (saved) {
        setFlowState(saved);
      }
    }
  }, [open]);

  const updateState = useCallback((updates: Partial<GuidedFlowState>) => {
    setFlowState(prev => {
      const next = { ...prev, ...updates };
      saveGuidedFlowState(next);
      return next;
    });
  }, []);

  const goToPhase = useCallback((phase: GuidedFlowPhase) => {
    updateState({ currentPhase: phase });
  }, [updateState]);

  const completePhase = useCallback((phase: GuidedFlowPhase) => {
    if (!flowState.completedPhases.includes(phase)) {
      updateState({
        completedPhases: [...flowState.completedPhases, phase],
      });
    }
    const currentIndex = GUIDED_FLOW_PHASES.findIndex(p => p.id === phase);
    if (currentIndex < GUIDED_FLOW_PHASES.length - 1) {
      goToPhase(GUIDED_FLOW_PHASES[currentIndex + 1].id);
    }
  }, [flowState.completedPhases, updateState, goToPhase]);

  const resetFlow = useCallback(() => {
    clearGuidedFlowState();
    setFlowState(createInitialFlowState());
    showToast('Guided flow reset', 'info');
  }, [showToast]);

  const currentPhaseIndex = GUIDED_FLOW_PHASES.findIndex(p => p.id === flowState.currentPhase);

  return (
    <Dialog open={open} onClose={onClose} title="Guided Book Flow" size="large">
      <div style={{ display: 'flex', gap: 24, minHeight: 400 }}>
        {/* Phase sidebar */}
        <div style={{ width: 220, borderRight: '1px solid var(--border)', paddingRight: 16 }}>
          {GUIDED_FLOW_PHASES.map((phase, index) => {
            const isCompleted = flowState.completedPhases.includes(phase.id);
            const isCurrent = flowState.currentPhase === phase.id;
            const isAccessible = index === 0 || flowState.completedPhases.includes(GUIDED_FLOW_PHASES[index - 1].id);

            return (
              <button
                key={phase.id}
                onClick={() => isAccessible && goToPhase(phase.id)}
                disabled={!isAccessible}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  background: isCurrent ? 'var(--hover)' : 'none',
                  borderRadius: 6,
                  cursor: isAccessible ? 'pointer' : 'default',
                  opacity: isAccessible ? 1 : 0.4,
                  textAlign: 'left',
                  color: 'var(--text)',
                  marginBottom: 4,
                }}
              >
                <span className="material-symbols-rounded" style={{
                  fontSize: 18,
                  color: isCompleted ? 'var(--success, #22c55e)' : isCurrent ? 'var(--accent)' : 'var(--text-secondary)',
                }}>
                  {isCompleted ? 'check_circle' : phase.icon}
                </span>
                <span style={{ fontSize: 13, fontWeight: isCurrent ? 600 : 400 }}>
                  {phase.label}
                </span>
              </button>
            );
          })}

          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            <Button variant="ghost" onClick={resetFlow}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>restart_alt</span>
              Start Over
            </Button>
          </div>
        </div>

        {/* Phase content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {flowState.currentPhase === 'concept' && (
            <div className={styles.section}>
              <h3>Concept & Premise</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                Define the core elements of your book. This information will guide AI assistance throughout the process.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label>
                  <span style={{ display: 'block', fontWeight: 500, marginBottom: 4 }}>Genre</span>
                  <input
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)' }}
                    placeholder="e.g., Literary Fiction, Sci-Fi, Mystery"
                    value={flowState.concept.genre}
                    onChange={e => updateState({ concept: { ...flowState.concept, genre: e.target.value } })}
                  />
                </label>

                <label>
                  <span style={{ display: 'block', fontWeight: 500, marginBottom: 4 }}>Target Audience</span>
                  <input
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)' }}
                    placeholder="e.g., Young Adult, Adult, Middle Grade"
                    value={flowState.concept.audience}
                    onChange={e => updateState({ concept: { ...flowState.concept, audience: e.target.value } })}
                  />
                </label>

                <label>
                  <span style={{ display: 'block', fontWeight: 500, marginBottom: 4 }}>Logline</span>
                  <textarea
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical' }}
                    rows={3}
                    placeholder="A one-sentence summary of your book's core conflict and stakes"
                    value={flowState.concept.logline}
                    onChange={e => updateState({ concept: { ...flowState.concept, logline: e.target.value } })}
                  />
                </label>

                <label>
                  <span style={{ display: 'block', fontWeight: 500, marginBottom: 4 }}>Target Word Count</span>
                  <input
                    type="number"
                    style={{ width: 160, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)' }}
                    value={flowState.concept.wordTarget}
                    onChange={e => updateState({ concept: { ...flowState.concept, wordTarget: Number(e.target.value) || 50000 } })}
                  />
                </label>
              </div>

              <Button
                variant="primary"
                onClick={() => completePhase('concept')}
                style={{ marginTop: 16 }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>arrow_forward</span>
                Continue to Research
              </Button>
            </div>
          )}

          {flowState.currentPhase === 'research' && (
            <div className={styles.section}>
              <h3>Research & World-Building</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                Gather your research notes and references. Use AI to generate research suggestions based on your concept.
              </p>

              <textarea
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical' }}
                rows={8}
                placeholder="Add your research notes, world-building details, character backgrounds..."
                value={flowState.research.notes}
                onChange={e => updateState({ research: { ...flowState.research, notes: e.target.value } })}
              />

              <Button
                variant="primary"
                onClick={() => completePhase('research')}
                style={{ marginTop: 16 }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>arrow_forward</span>
                Continue to Outline
              </Button>
            </div>
          )}

          {flowState.currentPhase === 'outline' && (
            <div className={styles.section}>
              <h3>AI-Assisted Outline</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                Generate a chapter-by-chapter outline from your concept and research.
              </p>

              {flowState.outline.chapters.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, border: '1px dashed var(--border)', borderRadius: 8 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 32, opacity: 0.4 }}>format_list_numbered</span>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Use the AI Writing Tools to generate an outline based on your concept, then return here to continue.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {flowState.outline.chapters.map((ch, i) => (
                    <div key={i} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <strong>Ch. {i + 1}: {ch.title}</strong>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{ch.summary}</p>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="primary"
                onClick={() => completePhase('outline')}
                style={{ marginTop: 16 }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>arrow_forward</span>
                Continue to Sample Chapter
              </Button>
            </div>
          )}

          {flowState.currentPhase === 'sample-chapter' && (
            <div className={styles.section}>
              <h3>Sample Chapter</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                Draft a sample chapter to establish your voice and style. Use AI to help generate a first draft.
              </p>

              <textarea
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', color: 'var(--text)', fontFamily: 'inherit', resize: 'vertical' }}
                rows={12}
                placeholder="Write or paste your sample chapter here..."
                value={flowState.sampleChapter.content}
                onChange={e => updateState({ sampleChapter: { ...flowState.sampleChapter, content: e.target.value } })}
              />

              <Button
                variant="primary"
                onClick={() => completePhase('sample-chapter')}
                style={{ marginTop: 16 }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>arrow_forward</span>
                Continue to Full Manuscript
              </Button>
            </div>
          )}

          {flowState.currentPhase === 'full-manuscript' && (
            <div className={styles.section}>
              <h3>Full Manuscript</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                You&apos;ve completed all preparation phases! Your guided flow data is saved and available for reference.
              </p>

              <div style={{ padding: 16, background: 'var(--hover)', borderRadius: 8, marginBottom: 16 }}>
                <strong>Your Book Plan</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.6 }}>
                  <li>Genre: {flowState.concept.genre || 'Not set'}</li>
                  <li>Audience: {flowState.concept.audience || 'Not set'}</li>
                  <li>Target: {flowState.concept.wordTarget.toLocaleString()} words</li>
                  <li>Chapters planned: {flowState.outline.chapters.length || 'None'}</li>
                </ul>
              </div>

              <p style={{ color: 'var(--text-secondary)' }}>
                Close this wizard and use the editor to write your manuscript. Use AI Writing Tools for chapter-by-chapter assistance.
              </p>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Button variant="primary" onClick={onClose}>
                  Start Writing
                </Button>
                <Button variant="ghost" onClick={resetFlow}>
                  Start New Flow
                </Button>
              </div>
            </div>
          )}

          {/* Progress indicator */}
          <div style={{ display: 'flex', gap: 4, marginTop: 24, justifyContent: 'center' }}>
            {GUIDED_FLOW_PHASES.map((_, index) => (
              <div
                key={index}
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  background: index <= currentPhaseIndex ? 'var(--accent)' : 'var(--border)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
