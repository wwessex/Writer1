import { HelpTooltip } from '@/components/UI/Tooltip';
import { Select } from '@/components/UI/Select';
import type { AppSettings } from '@/types';
import type { SettingsUpdate } from '@/context/appSettings';
import styles from '../Windows.module.css';

const FONT_OPTIONS = [
  { value: 'system', label: 'System Default' },
  { value: 'serif', label: 'Serif (Georgia)' },
  { value: 'mono', label: 'Monospace' },
  { value: 'courier-prime', label: 'Courier Prime' },
  { value: 'merriweather', label: 'Merriweather' },
  { value: 'lora', label: 'Lora' }
];

const FONT_SIZE_OPTIONS = [
  { value: '14', label: '14px' },
  { value: '15', label: '15px' },
  { value: '16', label: '16px' },
  { value: '17', label: '17px' },
  { value: '18', label: '18px' },
  { value: '20', label: '20px' },
  { value: '22', label: '22px' }
];

const LINE_HEIGHT_OPTIONS = [
  { value: '1.5', label: 'Compact (1.5)' },
  { value: '1.625', label: 'Normal (1.625)' },
  { value: '1.75', label: 'Relaxed (1.75)' },
  { value: '2', label: 'Spacious (2.0)' },
  { value: '2.25', label: 'Wide (2.25)' }
];

interface TypographySectionProps {
  typography: AppSettings['typography'];
  updateSettings: (updates: SettingsUpdate) => void;
  isFieldVisible: (sectionId: string, fieldId: string) => boolean;
  highlightMatch: (text: string) => React.ReactNode;
}

export function TypographySection({ typography, updateSettings, isFieldVisible, highlightMatch }: TypographySectionProps) {
  return (
    <>
      {isFieldVisible('typography', 'fontFamily') && <div className={styles.field}>
        <label>
          {highlightMatch('Font Family')}
          <HelpTooltip text="Choose the typeface for your writing area" />
        </label>
        <Select
          options={FONT_OPTIONS}
          value={typography.fontFamily}
          onChange={e => updateSettings({
            typography: { ...typography, fontFamily: e.target.value }
          })}
        />
      </div>}
      {(isFieldVisible('typography', 'fontSize') || isFieldVisible('typography', 'lineHeight')) && <div className={styles.fieldRow}>
        {isFieldVisible('typography', 'fontSize') && <div className={styles.field}>
          <label>{highlightMatch('Font Size')}</label>
          <Select
            options={FONT_SIZE_OPTIONS}
            value={String(typography.fontSize)}
            onChange={e => updateSettings({
              typography: { ...typography, fontSize: parseInt(e.target.value) }
            })}
          />
        </div>}
        {isFieldVisible('typography', 'lineHeight') && <div className={styles.field}>
          <label>{highlightMatch('Line Height')}</label>
          <Select
            options={LINE_HEIGHT_OPTIONS}
            value={String(typography.lineHeight)}
            onChange={e => updateSettings({
              typography: { ...typography, lineHeight: parseFloat(e.target.value) }
            })}
          />
        </div>}
      </div>}
    </>
  );
}
