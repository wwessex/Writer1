import { useState } from 'react';
import { Dialog, Button } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import styles from './Modals.module.css';

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

interface OnboardingStep {
  icon: string;
  title: string;
  description: string;
  tips?: string[];
  shortcut?: string;
}

const BASE_STEPS: OnboardingStep[] = [
  {
    icon: 'edit_note',
    title: 'Welcome to NovelWriter',
    description: 'A distraction-free writing environment for long-form projects. Everything is saved locally in your browser -- no account needed, fully offline-capable.',
    tips: [
      'Your data never leaves your device unless you configure cloud sync',
      'Works offline as a Progressive Web App -- install it from your browser',
      'All settings and content persist between sessions via IndexedDB'
    ]
  },
  {
    icon: 'menu_book',
    title: 'Organize Your Work',
    description: 'Create chapters in the sidebar, then break each chapter into scenes for detailed planning. Drag to reorder and add metadata like status, POV, and tags.',
    tips: [
      'Click the + button in the sidebar to create your first chapter',
      'Open the Scene Planner to break chapters into smaller beats',
      'Set status (planned, draft, revised, final) to track your progress'
    ],
    shortcut: 'Ctrl+Shift+N to create a new chapter'
  },
  {
    icon: 'photo_camera',
    title: 'Snapshots & Version History',
    description: 'Save snapshots of your work at any point. Compare versions side-by-side and restore previous versions with one click.',
    tips: [
      'Open Tools > Snapshots to save or restore a version',
      'Use Compare to see a side-by-side diff of two snapshots',
      'Save snapshots before major rewrites for easy rollback'
    ]
  },
  {
    icon: 'smart_toy',
    title: 'AI Writing Assistant',
    description: 'Use AI tools for brainstorming, continuity checks, and grammar fixes. Works with any OpenAI-compatible API (OpenAI, Ollama, LM Studio).',
    tips: [
      'Open Tools > AI Writing to configure your API endpoint and key',
      'Preset prompts cover common tasks: continue writing, summarize, expand',
      'Your API key is stored only in your browser\'s localStorage'
    ]
  },
  {
    icon: 'analytics',
    title: 'Writing Analysis',
    description: 'Get readability scores, track repeated words, and find pacing issues. Enable LanguageTool in Settings for grammar checking.',
    tips: [
      'Open Tools > Analysis to see word count, Flesch readability, and more',
      'Enable LanguageTool in Settings > Writing Assistance for grammar checks',
      'Long sentences (30+ words) are flagged to help improve pacing'
    ]
  },
  {
    icon: 'fullscreen',
    title: 'Focus Mode',
    description: 'Enter focus mode for distraction-free writing. The sidebar, toolbar, and header fade away, highlighting only the current paragraph.',
    tips: [
      'The current paragraph is highlighted to keep you in the flow',
      'Press Escape to exit focus mode at any time'
    ],
    shortcut: 'Ctrl+Shift+F to toggle focus mode'
  },
  {
    icon: 'download',
    title: 'Export & Backup',
    description: 'Export your project as DOCX, PDF, or RTF. Screenplay projects support Fountain and screenplay-formatted PDF. Create JSON backups to save everything.',
    tips: [
      'Use File > Export to choose your format',
      'JSON backups include all chapters, snapshots, and metadata',
      'Import DOCX or RTF files to bring in existing work'
    ],
    shortcut: 'Ctrl+Shift+E to open export'
  },
];

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const { state } = useApp();
  const [step, setStep] = useState(0);

  const modeHint = state.projectType === 'screenplay'
    ? 'You are currently in screenplay mode: scenes, screenplay formatting, and production-friendly exports are emphasized.'
    : 'You are currently in book mode: chapters, prose analysis, and long-form narrative drafting are emphasized.';

  const modeTips = state.projectType === 'screenplay'
    ? [
        'Use File > Projects to switch between book and screenplay modes',
        'Scene planner supports slug lines, INT/EXT, and production tags',
        'Export to Fountain or screenplay-formatted PDF for production use'
      ]
    : [
        'Use File > Projects to switch between book and screenplay modes',
        'The outline panel lets you plan POV, tags, and word goals per chapter',
        'Track your progress with the Dashboard (Tools > Dashboard)'
      ];

  const steps: OnboardingStep[] = [...BASE_STEPS];
  steps.splice(1, 0, {
    icon: 'tips_and_updates',
    title: 'Your Current Mode',
    description: modeHint,
    tips: modeTips
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
        <div className={styles.onboarding__stepCounter}>
          Step {step + 1} of {steps.length}
        </div>

        <div className={styles.onboarding__icon}>
          <span className="material-symbols-rounded">{currentStep.icon}</span>
        </div>
        <h3 className={styles.onboarding__title}>{currentStep.title}</h3>
        <p className={styles.onboarding__description}>{currentStep.description}</p>

        {currentStep.tips && currentStep.tips.length > 0 && (
          <div className={styles.onboarding__tips}>
            {currentStep.tips.map((tip, idx) => (
              <div key={idx} className={styles.onboarding__tip}>
                <span className="material-symbols-rounded">check_circle</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        )}

        {currentStep.shortcut && (
          <div className={styles.onboarding__shortcut}>
            <span className="material-symbols-rounded">keyboard</span>
            <kbd>{currentStep.shortcut}</kbd>
          </div>
        )}

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
            {isLast ? 'Start Writing' : 'Next'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
