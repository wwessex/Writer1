import { useState } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import type { PacingProfile, StoryBlueprint, StoryStructurePreference } from '@/types';
import styles from './Modals.module.css';

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

const DEFAULT_BLUEPRINT: StoryBlueprint = {
  genre: '',
  subgenre: '',
  targetAudience: '',
  ageBand: '',
  tone: '',
  voice: '',
  structure: 'three-act',
  targetWordCount: 80000,
  pacingProfile: 'balanced'
};

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const { state, updateStoryBlueprint } = useApp();
  const [step, setStep] = useState(0);
  const [blueprintStep, setBlueprintStep] = useState(0);
  const [inBlueprintWizard, setInBlueprintWizard] = useState(false);
  const [blueprint, setBlueprint] = useState<StoryBlueprint>(state.storyBlueprint || DEFAULT_BLUEPRINT);

  const tips = [
    'Create chapters/scenes from the sidebar and drag to reorder.',
    'Use snapshots before major rewrites to keep rollback points.',
    'Open AI Writing to generate against your active chapter context.'
  ];

  const closeAll = () => {
    onClose();
    setStep(0);
    setBlueprintStep(0);
    setInBlueprintWizard(false);
  };

  const setStructure = (value: StoryStructurePreference) => setBlueprint(prev => ({ ...prev, structure: value }));
  const setPacing = (value: PacingProfile) => setBlueprint(prev => ({ ...prev, pacingProfile: value }));
  const updateField = <K extends keyof StoryBlueprint>(field: K, value: StoryBlueprint[K]) => setBlueprint(prev => ({ ...prev, [field]: value }));

  const saveBlueprint = () => {
    updateStoryBlueprint(blueprint);
    closeAll();
  };

  if (inBlueprintWizard) {
    return (
      <Dialog open={open} onClose={closeAll} title="Story Blueprint" size="medium">
        <div className={styles.onboarding}>
          <div className={styles.onboarding__stepCounter}>Blueprint Step {blueprintStep + 1} of 5</div>
          {blueprintStep === 0 && (
            <>
              <h3 className={styles.onboarding__title}>Genre & Subgenre</h3>
              <div className={styles.projectsCreateFields}>
                <input className={styles.projectsCreateInput} value={blueprint.genre} onChange={e => updateField('genre', e.target.value)} placeholder="Genre (e.g. Fantasy)" />
                <input className={styles.projectsCreateInput} value={blueprint.subgenre} onChange={e => updateField('subgenre', e.target.value)} placeholder="Subgenre (e.g. Dark Academia)" />
              </div>
            </>
          )}
          {blueprintStep === 1 && (
            <>
              <h3 className={styles.onboarding__title}>Target Audience</h3>
              <div className={styles.projectsCreateFields}>
                <input className={styles.projectsCreateInput} value={blueprint.targetAudience} onChange={e => updateField('targetAudience', e.target.value)} placeholder="Audience (e.g. Adult thriller readers)" />
                <input className={styles.projectsCreateInput} value={blueprint.ageBand} onChange={e => updateField('ageBand', e.target.value)} placeholder="Age band (e.g. 16+)" />
              </div>
            </>
          )}
          {blueprintStep === 2 && (
            <>
              <h3 className={styles.onboarding__title}>Tone & Voice</h3>
              <div className={styles.projectsCreateFields}>
                <input className={styles.projectsCreateInput} value={blueprint.tone} onChange={e => updateField('tone', e.target.value)} placeholder="Tone (e.g. brooding, intimate)" />
                <input className={styles.projectsCreateInput} value={blueprint.voice} onChange={e => updateField('voice', e.target.value)} placeholder="Voice (e.g. close third person)" />
              </div>
            </>
          )}
          {blueprintStep === 3 && (
            <>
              <h3 className={styles.onboarding__title}>Story Structure</h3>
              <div className={styles.projectsCreateTypeRow}>
                <label className={styles.projectsTypeOption}><input type="radio" checked={blueprint.structure === 'three-act'} onChange={() => setStructure('three-act')} /><span>3-Act</span></label>
                <label className={styles.projectsTypeOption}><input type="radio" checked={blueprint.structure === 'save-the-cat'} onChange={() => setStructure('save-the-cat')} /><span>Save the Cat</span></label>
                <label className={styles.projectsTypeOption}><input type="radio" checked={blueprint.structure === 'hero-journey'} onChange={() => setStructure('hero-journey')} /><span>Hero's Journey</span></label>
              </div>
            </>
          )}
          {blueprintStep === 4 && (
            <>
              <h3 className={styles.onboarding__title}>Word Count & Pacing</h3>
              <div className={styles.projectsCreateFields}>
                <input className={styles.projectsCreateInput} type="number" min={1000} step={1000} value={blueprint.targetWordCount} onChange={e => updateField('targetWordCount', Number(e.target.value) || 0)} placeholder="Target word count" />
                <div className={styles.projectsCreateTypeRow}>
                  <label className={styles.projectsTypeOption}><input type="radio" checked={blueprint.pacingProfile === 'fast'} onChange={() => setPacing('fast')} /><span>Fast</span></label>
                  <label className={styles.projectsTypeOption}><input type="radio" checked={blueprint.pacingProfile === 'balanced'} onChange={() => setPacing('balanced')} /><span>Balanced</span></label>
                  <label className={styles.projectsTypeOption}><input type="radio" checked={blueprint.pacingProfile === 'slow-burn'} onChange={() => setPacing('slow-burn')} /><span>Slow burn</span></label>
                </div>
              </div>
            </>
          )}
          <div className={styles.onboarding__actions}>
            <Button variant="ghost" onClick={() => (blueprintStep === 0 ? setInBlueprintWizard(false) : setBlueprintStep(s => s - 1))}>Back</Button>
            <Button variant="primary" onClick={() => (blueprintStep === 4 ? saveBlueprint() : setBlueprintStep(s => s + 1))}>{blueprintStep === 4 ? 'Save Blueprint' : 'Next'}</Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={closeAll} title="Getting Started" size="medium">
      <div className={styles.onboarding}>
        <div className={styles.onboarding__stepCounter}>Step {step + 1} of 2</div>
        {step === 0 ? (
          <>
            <h3 className={styles.onboarding__title}>Welcome to DraftHarbour Studio</h3>
            <p className={styles.onboarding__description}>
              You are in {state.projectType === 'screenplay' ? 'screenplay' : 'book'} mode. Build your project setup now so AI outputs stay consistent.
            </p>
          </>
        ) : (
          <>
            <h3 className={styles.onboarding__title}>Quick Tips</h3>
            <div className={styles.onboarding__tips}>
              {tips.map(tip => (
                <div key={tip} className={styles.onboarding__tip}><span className="material-symbols-rounded">check_circle</span><span>{tip}</span></div>
              ))}
            </div>
          </>
        )}
        <div className={styles.onboarding__actions}>
          <Button variant="ghost" onClick={() => (step === 0 ? closeAll() : setStep(0))}>{step === 0 ? 'Skip' : 'Back'}</Button>
          {step === 0 && <Button variant="default" onClick={() => setInBlueprintWizard(true)}>Create Blueprint</Button>}
          <Button variant="primary" onClick={() => (step === 1 ? closeAll() : setStep(1))}>{step === 1 ? 'Start Writing' : 'Next'}</Button>
        </div>
      </div>
    </Dialog>
  );
}
