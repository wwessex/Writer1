import { Input } from '@/components/UI';
import { HelpTooltip } from '@/components/UI/Tooltip';
import type { AppSettings } from '@/types';
import type { SettingsUpdate } from '@/context/appSettings';
import styles from '../Windows.module.css';

interface SyncSectionProps {
  sync: AppSettings['sync'];
  updateSettings: (updates: SettingsUpdate) => void;
  isFieldVisible: (sectionId: string, fieldId: string) => boolean;
  highlightMatch: (text: string) => React.ReactNode;
}

export function SyncSection({ sync, updateSettings, isFieldVisible, highlightMatch }: SyncSectionProps) {
  return (
    <>
      {isFieldVisible('sync', 'novelId') && <div className={styles.field}>
        <label>
          {highlightMatch('Novel ID')}
          <HelpTooltip text="A unique identifier for syncing this novel across devices" />
        </label>
        <Input
          value={sync.novelId}
          onChange={e => updateSettings({
            sync: { ...sync, novelId: e.target.value }
          })}
          placeholder="unique-novel-id"
        />
      </div>}
      {isFieldVisible('sync', 'syncUrl') && <div className={styles.field}>
        <label>
          {highlightMatch('Sync Server URL')}
          <HelpTooltip text="The endpoint of your sync server for cloud backup" />
        </label>
        <Input
          value={sync.url}
          onChange={e => updateSettings({
            sync: { ...sync, url: e.target.value }
          })}
          placeholder="https://your-server.com/sync"
        />
      </div>}
      {isFieldVisible('sync', 'authHeader') && <div className={styles.field}>
        <label>
          {highlightMatch('Authorization Header')}
          <HelpTooltip text="The full Authorization header value sent with sync requests, e.g. 'Bearer your-token-here'" />
        </label>
        <Input
          type="password"
          value={sync.auth}
          onChange={e => updateSettings({
            sync: { ...sync, auth: e.target.value }
          })}
          placeholder="Bearer your-token"
        />
      </div>}
    </>
  );
}
