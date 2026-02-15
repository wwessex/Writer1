import { useState } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import styles from './Modals.module.css';

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

const BASE_STEPS = [
  {
    icon: 'edit_note',
    title: 'Welcome to NovelWriter',
    description: 'A distraction-free writing environment for long-form projects. Everything is saved locally in your browser -- no account needed, fully offline-capable.',
  },
  {
    icon: 'menu_book',
    title: 'Organize with Sections',
    description: 'Create and manage project sections in the sidebar. Drag to reorder and add metadata. Book mode supports chapter planning, while screenplay mode supports scene workflow.',
  },
  {
    icon: 'photo_camera',
    title: 'Snapshots & Version History',
    description: 'Save snapshots of your work at any point. Compare versions side-by-side and restore previous versions if needed. Find this under Tools > Snapshots.',
  },
  {
    icon: 'analytics',
    title: 'Writing Analysis',
    description: 'Get readability scores, track repeated words, and find pacing issues. Enable LanguageTool in Settings for grammar checking.',
  },
  {
    icon: 'fullscreen',
    title: 'Focus Mode',
    description: 'Press Ctrl+Shift+F or use View > Focus Mode for a distraction-free writing experience. The current paragraph is highlighted to keep you in the flow.',
  },
  {
    icon: 'download',
    title: 'Export & Backup',
    description: 'Export your project as DOCX, PDF, screenplay PDF/Fountain (screenplay mode), or RTF. Create JSON backups to save everything including snapshots.',
  },
];

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const { state } = useApp();
  const [step, setStep] = useState(0);

  const modeHint = state.projectType === 'screenplay'
    ? 'You are currently in screenplay mode: scenes, screenplay formatting, and production-friendly exports are emphasized.'
    : 'You are currently in book mode: chapters, prose analysis, and long-form narrative drafting are emphasized.';

  const steps = [...BASE_STEPS];
  steps.splice(1, 0, {
    icon: 'tips_and_updates',
    title: 'Mode-Specific Hints',
    description: modeHint,
  });

  const currentStep = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  const handleNext = () => {
    if (isLast) {
      onClose();
      setStep(0);
    } else {
      setStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setStep(s => s - 1);
    }
  };

  const handleSkip = () => {
    onClose();
    setStep(0);
  };

  return (
    <Dialog open={open} onClose={handleSkip} title="Getting Started" size="medium">
      <div className={styles.onboarding}>
        <div className={styles.onboarding__icon}>
          <span className="material-symbols-rounded">{currentStep.icon}</span>
        </div>
        <h3 className={styles.onboarding__title}>{currentStep.title}</h3>
        <p className={styles.onboarding__description}>{currentStep.description}</p>

        <div className={styles.onboarding__dots}>
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={`${styles.onboarding__dot} ${idx === step ? styles['onboarding__dot--active'] : ''}`}
              onClick={() => setStep(idx)}
            />
          ))}
        </div>

        <div className={styles.onboarding__actions}>
          {!isFirst && (
            <Button variant="ghost" onClick={handlePrev}>
              Back
            </Button>
          )}
          {isFirst && (
            <Button variant="ghost" onClick={handleSkip}>
              Skip Tour
            </Button>
          )}
          <Button variant="primary" onClick={handleNext}>
            {isLast ? 'Get Started' : 'Next'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
