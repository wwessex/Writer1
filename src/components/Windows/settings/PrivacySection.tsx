import { useState } from 'react';
import { Button } from '@/components/UI';
import { isTelemetryOptedIn, setTelemetryOptIn, clearTelemetryData } from '@/lib/telemetry';
import type { ManagedPolicy } from '@/lib/policy';
import type { AppSettings } from '@/types';
import type { SettingsUpdate } from '@/context/appSettings';
import styles from '../Windows.module.css';

interface PrivacySectionProps {
  sync: AppSettings['sync'];
  updateSettings: (updates: SettingsUpdate) => void;
  managedPolicy: ManagedPolicy;
  isFieldVisible: (sectionId: string, fieldId: string) => boolean;
  highlightMatch: (text: string) => React.ReactNode;
}

export function PrivacySection({ sync, updateSettings, managedPolicy, isFieldVisible, highlightMatch }: PrivacySectionProps) {
  const [telemetryEnabled, setTelemetryEnabled] = useState(isTelemetryOptedIn());

  return (
    <>
      <div className={styles.privacyNotice}>
        <span className="material-symbols-rounded">info</span>
        <div>
          <p className={styles.privacyNotice__text}>
            <strong>Your writing stays private by default.</strong> DraftHarbour Studio stores everything in
            your browser's local storage (IndexedDB). No data leaves your device unless you
            explicitly enable cloud sync below. Diagnostics reports include only metadata and
            app-state summaries, and automatically redact auth tokens, secrets, and passwords.
          </p>
        </div>
      </div>

      {isFieldVisible('privacy', 'cloudSync') && <div className={styles.privacyToggle}>
        <div className={styles.privacyToggle__info}>
          <span className={styles.privacyToggle__label}>{highlightMatch('Cloud Sync')}</span>
          <span className={styles.privacyToggle__desc}>
            When enabled, chapter content is sent to your configured sync server.
            Data is transmitted over HTTPS. Enable encrypted sync in Integrations for end-to-end encryption.
          </span>
        </div>
        <label className={styles.toggleSwitch}>
          <input
            type="checkbox"
            checked={sync.url.trim() !== ''}
            disabled={managedPolicy.forceLocalOnly}
            onChange={e => {
              if (!e.target.checked) {
                updateSettings({ sync: { ...sync, url: '', auth: '' } });
              }
            }}
          />
          <span className={styles.toggleSwitch__slider} />
        </label>
      </div>}

      {isFieldVisible('privacy', 'aiUsageTelemetry') && <div className={styles.privacyToggle}>
        <div className={styles.privacyToggle__info}>
          <span className={styles.privacyToggle__label}>{highlightMatch('AI Usage Telemetry')}</span>
          <span className={styles.privacyToggle__desc}>
            Opt in to track your AI usage locally (character counts, latency, action types).
            No content or text is ever recorded -- only metadata. Data stays on your device.
          </span>
        </div>
        <label className={styles.toggleSwitch}>
          <input
            type="checkbox"
            checked={telemetryEnabled}
            disabled={managedPolicy.disableTelemetry}
            onChange={e => {
              setTelemetryEnabled(e.target.checked);
              setTelemetryOptIn(e.target.checked);
            }}
          />
          <span className={styles.toggleSwitch__slider} />
        </label>
      </div>}

      {telemetryEnabled && (
        <Button variant="ghost" onClick={() => { clearTelemetryData(); }}>
          <span className="material-symbols-rounded">delete_sweep</span>
          Clear Telemetry Data
        </Button>
      )}

      {isFieldVisible('privacy', 'localStorageOnly') && <div className={styles.privacyToggle}>
        <div className={styles.privacyToggle__info}>
          <span className={styles.privacyToggle__label}>{highlightMatch('Local Storage Only')}</span>
          <span className={styles.privacyToggle__desc}>
            Grammar checking via LanguageTool sends text to the configured API endpoint.
            AI Writing Tools sends chapter context to your configured AI endpoint.
            Both are opt-in and disabled by default.
          </span>
        </div>
        <span className="material-symbols-rounded" style={{ color: 'var(--success, #22c55e)', fontSize: '1.5rem' }}>
          verified_user
        </span>
      </div>}
    </>
  );
}
