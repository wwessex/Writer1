import { Input } from '@/components/UI';
import { HelpTooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import type { AppSettings } from '@/types';
import type { SettingsUpdate } from '@/context/appSettings';
import styles from '../Windows.module.css';

const LANGUAGE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'de-DE', label: 'German' },
  { value: 'fr-FR', label: 'French' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'pt-BR', label: 'Portuguese (BR)' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'nl-NL', label: 'Dutch' },
  { value: 'pl-PL', label: 'Polish' },
  { value: 'ru-RU', label: 'Russian' }
];

interface WritingAssistSectionProps {
  assist: AppSettings['assist'];
  updateSettings: (updates: SettingsUpdate) => void;
  isFieldVisible: (sectionId: string, fieldId: string) => boolean;
  highlightMatch: (text: string) => React.ReactNode;
}

export function WritingAssistSection({ assist, updateSettings, isFieldVisible, highlightMatch }: WritingAssistSectionProps) {
  return (
    <>
      {isFieldVisible('assist', 'languageToolEnabled') && <div className={styles.fieldRow}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={assist.languageToolEnabled}
            onChange={e => updateSettings({
              assist: { ...assist, languageToolEnabled: e.target.checked }
            })}
          />
          <span>{highlightMatch('Enable LanguageTool')}</span>
          <HelpTooltip text="LanguageTool checks grammar, spelling, and style. The free public API works without an account." position="right" />
        </label>
      </div>}
      {isFieldVisible('assist', 'languageToolUrl') && <div className={styles.field}>
        <label>
          {highlightMatch('LanguageTool URL')}
          <HelpTooltip text="API endpoint for grammar checking. Use the public server or your own instance." />
        </label>
        <Input
          value={assist.languageToolUrl}
          onChange={e => updateSettings({
            assist: { ...assist, languageToolUrl: e.target.value }
          })}
          placeholder="https://api.languagetool.org/v2/check"
        />
      </div>}
      {isFieldVisible('assist', 'languageToolLanguage') && <div className={styles.field}>
        <label>{highlightMatch('Language')}</label>
        <Select
          options={LANGUAGE_OPTIONS}
          value={assist.languageToolLanguage}
          onChange={e => updateSettings({
            assist: { ...assist, languageToolLanguage: e.target.value }
          })}
        />
      </div>}
    </>
  );
}
