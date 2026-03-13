import { Input } from '@/components/UI';
import { HelpTooltip } from '@/components/UI/Tooltip';
import type { AppSettings } from '@/types';
import type { SettingsUpdate } from '@/context/appSettings';
import styles from '../Windows.module.css';

interface ApplicationSectionProps {
  settings: AppSettings;
  updateSettings: (updates: SettingsUpdate) => void;
  isFieldVisible: (sectionId: string, fieldId: string) => boolean;
  highlightMatch: (text: string) => React.ReactNode;
}

export function ApplicationSection({ settings, updateSettings, isFieldVisible, highlightMatch }: ApplicationSectionProps) {
  return (
    <>
      {(isFieldVisible('app', 'autosaveMs') || isFieldVisible('app', 'dailyWordGoal')) && <div className={styles.fieldRow}>
        {isFieldVisible('app', 'autosaveMs') && <div className={styles.field}>
          <label>
            {highlightMatch('Autosave (ms)')}
            <HelpTooltip text="How long to wait after you stop typing before auto-saving" />
          </label>
          <Input
            type="number"
            value={settings.autosaveMs}
            onChange={e => updateSettings({ autosaveMs: parseInt(e.target.value) || 800 })}
            min={100}
            max={5000}
          />
        </div>}
        {isFieldVisible('app', 'dailyWordGoal') && <div className={styles.field}>
          <label>
            {highlightMatch('Daily Word Goal')}
            <HelpTooltip text="Set a daily writing target. Progress is tracked in the Dashboard and status bar." />
          </label>
          <Input
            type="number"
            value={settings.dailyWordGoal || ''}
            onChange={e => updateSettings({ dailyWordGoal: parseInt(e.target.value) || 0 })}
            placeholder="0"
          />
        </div>}
      </div>}
      {isFieldVisible('app', 'novelWordGoal') && <div className={styles.field}>
        <label>
          {highlightMatch('Novel Word Goal')}
          <HelpTooltip text="Set an overall word goal for your project. A progress bar appears in the status bar." />
        </label>
        <Input
          type="number"
          value={settings.novelWordGoal || ''}
          onChange={e => updateSettings({ novelWordGoal: parseInt(e.target.value) || 0 })}
          placeholder="0"
        />
      </div>}
      <div className={styles.fieldRow}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={settings.typewriterMode}
            onChange={e => updateSettings({ typewriterMode: e.target.checked })}
          />
          <span>Typewriter Scroll Mode</span>
          <HelpTooltip text="Keep the cursor line vertically centered in the editor while typing (Ctrl+Shift+T)" position="right" />
        </label>
      </div>
    </>
  );
}
