import { useState, useCallback } from 'react';
import { Dialog, Button, Input } from '@/components/UI';
import { useApp } from '@/context/AppContext';
import {
  connectIntegration,
  listIntegrationRevisions,
  pullIntegrationData,
  pushIntegrationData,
  testIntegrationConnection,
} from '@/lib/integrations';
import type { AppState, Chapter, IntegrationConfig, IntegrationType } from '@/types';
import styles from './Modals.module.css';

interface IntegrationsModalProps {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'novelwriter_integrations';

interface IntegrationConfigs {
  scrivener: IntegrationConfig;
  'google-drive': IntegrationConfig;
  dropbox: IntegrationConfig;
}

type OperationState = 'idle' | 'loading' | 'success' | 'error';

function loadConfigs(): IntegrationConfigs {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // Fall through to defaults
  }
  return {
    scrivener: { type: 'scrivener', enabled: false },
    'google-drive': { type: 'google-drive', enabled: false },
    dropbox: { type: 'dropbox', enabled: false },
  };
}

function saveConfigs(configs: IntegrationConfigs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

function formatSyncTime(timestamp?: number): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type ConnectionStatus = 'disconnected' | 'configured';

function getConnectionStatus(
  type: IntegrationType,
  config: IntegrationConfig
): ConnectionStatus {
  if (!config.enabled) return 'disconnected';

  if (type === 'dropbox' && !config.accessToken) return 'disconnected';
  return 'configured';
}

function statusLabel(status: ConnectionStatus): string {
  return status === 'configured' ? 'Configured' : 'Disconnected';
}

function statusColor(status: ConnectionStatus): string {
  return status === 'configured' ? 'var(--accent)' : 'var(--text-muted)';
}

function statusBadgeLabel(status: OperationState): string {
  switch (status) {
    case 'loading':
      return 'Running';
    case 'success':
      return 'Success';
    case 'error':
      return 'Failed';
    case 'idle':
    default:
      return 'Idle';
  }
}

export function IntegrationsModal({ open, onClose }: IntegrationsModalProps) {
  const { state, dispatch } = useApp();
  const [configs, setConfigs] = useState<IntegrationConfigs>(loadConfigs);

  const updateConfig = useCallback(
    (type: IntegrationType, updates: Partial<IntegrationConfig>) => {
      setConfigs((prev) => {
        const key = type === 'google-drive' ? 'google-drive' : type;
        const next = {
          ...prev,
          [key]: { ...prev[key], ...updates },
        };
        saveConfigs(next);
        return next;
      });
    },
    []
  );

  const toggleEnabled = useCallback(
    (type: IntegrationType) => {
      const key = type === 'google-drive' ? 'google-drive' : type;
      updateConfig(type, { enabled: !configs[key].enabled });
    },
    [configs, updateConfig]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="External Integrations"
      size="large"
    >
      <div className={styles.integrationsGrid}>
        <ScrivenerCard
          config={configs.scrivener}
          appState={state}
          onToggle={() => toggleEnabled('scrivener')}
          onUpdate={(updates) => updateConfig('scrivener', updates)}
          onApplyPull={(chapterUpdates) => {
            dispatch({ type: 'SET_CHAPTERS', payload: chapterUpdates });
          }}
        />

        <GoogleDriveCard
          config={configs['google-drive']}
          appState={state}
          onToggle={() => toggleEnabled('google-drive')}
          onUpdate={(updates) => updateConfig('google-drive', updates)}
          onApplyPull={(chapterUpdates) => {
            dispatch({ type: 'SET_CHAPTERS', payload: chapterUpdates });
          }}
        />

        <DropboxCard
          config={configs.dropbox}
          appState={state}
          onToggle={() => toggleEnabled('dropbox')}
          onUpdate={(updates) => updateConfig('dropbox', updates)}
          onApplyPull={(chapterUpdates) => {
            dispatch({ type: 'SET_CHAPTERS', payload: chapterUpdates });
          }}
        />
      </div>
    </Dialog>
  );
}

interface CardShellProps {
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  status: ConnectionStatus;
  lastSyncAt?: number;
  onToggle: () => void;
  children: React.ReactNode;
}

function CardShell({
  icon,
  title,
  description,
  enabled,
  status,
  lastSyncAt,
  onToggle,
  children,
}: CardShellProps) {
  return (
    <div
      className={`${styles.integrationCard} ${
        enabled ? styles['integrationCard--active'] : ''
      }`}
    >
      <div className={styles.integrationCard__header}>
        <div className={styles.integrationCard__iconWrap}>
          <span className="material-symbols-rounded">{icon}</span>
        </div>
        <div className={styles.integrationCard__titleBlock}>
          <h4 className={styles.integrationCard__title}>{title}</h4>
          <p className={styles.integrationCard__desc}>{description}</p>
        </div>
        <label className={styles.toggleSwitch}>
          <input type="checkbox" checked={enabled} onChange={onToggle} />
          <span className={styles.toggleSwitch__slider} />
        </label>
      </div>

      <div className={styles.integrationCard__statusRow}>
        <span
          className={styles.integrationCard__dot}
          style={{ background: statusColor(status) }}
        />
        <span className={styles.integrationCard__statusLabel}>
          {statusLabel(status)}
        </span>
        <span className={styles.integrationCard__syncTime}>
          Last sync: {formatSyncTime(lastSyncAt)}
        </span>
      </div>

      {enabled && (
        <div className={styles.integrationCard__body}>{children}</div>
      )}
    </div>
  );
}

function OperationFeedback({
  state,
  message,
}: {
  state: OperationState;
  message: string;
}) {
  return (
    <div className={styles.integrationCard__feedback}>
      <span className={`${styles.integrationCard__badge} ${styles[`integrationCard__badge--${state}`]}`}>
        {statusBadgeLabel(state)}
      </span>
      <p className={styles.integrationCard__feedbackText}>{message}</p>
    </div>
  );
}

interface IntegrationCardBaseProps {
  config: IntegrationConfig;
  appState: Pick<AppState, 'novelId' | 'projectType' | 'chapters'>;
  onToggle: () => void;
  onUpdate: (updates: Partial<IntegrationConfig>) => void;
  onApplyPull: (chapters: Chapter[]) => void;
}

function ScrivenerCard({ config, appState, onToggle, onUpdate, onApplyPull }: IntegrationCardBaseProps) {
  const status = getConnectionStatus('scrivener', config);
  const [operationState, setOperationState] = useState<OperationState>('idle');
  const [operationMessage, setOperationMessage] = useState('No operations run yet.');

  const run = useCallback(async (task: () => Promise<string>) => {
    setOperationState('loading');
    try {
      const message = await task();
      const syncedAt = Date.now();
      onUpdate({ lastSyncAt: syncedAt });
      setOperationState('success');
      setOperationMessage(message);
    } catch (error) {
      setOperationState('error');
      setOperationMessage(error instanceof Error ? error.message : 'Unexpected integration error.');
    }
  }, [onUpdate]);

  return (
    <CardShell
      icon="edit_note"
      title="Scrivener"
      description="Import from and export to Scrivener .scriv project format"
      enabled={config.enabled}
      status={status}
      lastSyncAt={config.lastSyncAt}
      onToggle={onToggle}
    >
      <div className={styles.integrationCard__section}>
        <p className={styles.integrationCard__hint}>
          Transfer your work between NovelWriter and Scrivener with adapter-backed pull/push operations.
        </p>
        <div className={styles.integrationCard__actions}>
          <Button variant="default" disabled={operationState === 'loading'} onClick={() => run(async () => {
            const pullResult = await pullIntegrationData('scrivener', config, appState);
            onApplyPull(pullResult.chapterUpdates);
            return `Pulled ${pullResult.chapterUpdates.length} chapter(s) from Scrivener.`;
          })}>
            <span className="material-symbols-rounded">upload_file</span>
            Import .scriv
          </Button>
          <Button variant="default" disabled={operationState === 'loading'} onClick={() => run(async () => {
            const pushResult = await pushIntegrationData('scrivener', config, appState);
            return pushResult.message;
          })}>
            <span className="material-symbols-rounded">download</span>
            Export .scriv
          </Button>
        </div>
        <OperationFeedback state={operationState} message={operationMessage} />
      </div>
    </CardShell>
  );
}

function GoogleDriveCard({ config, appState, onToggle, onUpdate, onApplyPull }: IntegrationCardBaseProps) {
  const status = getConnectionStatus('google-drive', config);
  const [operationState, setOperationState] = useState<OperationState>('idle');
  const [operationMessage, setOperationMessage] = useState('Google Drive adapter ready.');

  const run = useCallback(async (task: () => Promise<string>) => {
    setOperationState('loading');
    try {
      const message = await task();
      const syncedAt = Date.now();
      onUpdate({ lastSyncAt: syncedAt });
      setOperationState('success');
      setOperationMessage(message);
    } catch (error) {
      setOperationState('error');
      setOperationMessage(error instanceof Error ? error.message : 'Unexpected integration error.');
    }
  }, [onUpdate]);

  return (
    <CardShell
      icon="docs"
      title="Google Docs"
      description="Sync chapters to Google Docs for collaborative editing"
      enabled={config.enabled}
      status={status}
      lastSyncAt={config.lastSyncAt}
      onToggle={onToggle}
    >
      <div className={styles.integrationCard__section}>
        <p className={styles.integrationCard__hint}>
          Adapter workflow supports OAuth bootstrapping, connectivity checks, push/pull and revision listing.
        </p>

        <div className={styles.integrationCard__actions}>
          <Button variant="default" disabled={operationState === 'loading'} onClick={() => run(async () => {
            const result = await connectIntegration('google-drive', config);
            return result.message;
          })}>
            <span className="material-symbols-rounded">link</span>
            Connect
          </Button>
          <Button variant="default" disabled={operationState === 'loading'} onClick={() => run(async () => {
            const result = await testIntegrationConnection('google-drive', config);
            return result.message;
          })}>
            <span className="material-symbols-rounded">wifi_tethering</span>
            Test
          </Button>
          <Button variant="default" disabled={operationState === 'loading'} onClick={() => run(async () => {
            const result = await pushIntegrationData('google-drive', config, appState);
            return result.message;
          })}>
            <span className="material-symbols-rounded">cloud_upload</span>
            Push
          </Button>
          <Button variant="default" disabled={operationState === 'loading'} onClick={() => run(async () => {
            const result = await pullIntegrationData('google-drive', config, appState);
            onApplyPull(result.chapterUpdates);
            return `Pulled ${result.chapterUpdates.length} chapter(s) from Google Drive.`;
          })}>
            <span className="material-symbols-rounded">cloud_download</span>
            Pull
          </Button>
          <Button variant="default" disabled={operationState === 'loading'} onClick={() => run(async () => {
            const revisions = await listIntegrationRevisions('google-drive', config);
            return `Found ${revisions.length} remote revision(s).`;
          })}>
            <span className="material-symbols-rounded">history</span>
            Revisions
          </Button>
        </div>

        <OperationFeedback state={operationState} message={operationMessage} />
      </div>
    </CardShell>
  );
}

function DropboxCard({ config, appState, onToggle, onUpdate, onApplyPull }: IntegrationCardBaseProps) {
  const status = getConnectionStatus('dropbox', config);
  const [apiKey, setApiKey] = useState(config.accessToken || '');
  const [folder, setFolder] = useState(config.folderId || '/NovelWriter');
  const [operationState, setOperationState] = useState<OperationState>('idle');
  const [operationMessage, setOperationMessage] = useState('Configure Dropbox access and run an operation.');

  const run = useCallback(async (task: (cardConfig: IntegrationConfig) => Promise<string>) => {
    setOperationState('loading');
    try {
      const cardConfig: IntegrationConfig = {
        ...config,
        accessToken: apiKey,
        folderId: folder,
      };
      const message = await task(cardConfig);
      const syncedAt = Date.now();
      onUpdate({ accessToken: apiKey, folderId: folder, lastSyncAt: syncedAt });
      setOperationState('success');
      setOperationMessage(message);
    } catch (error) {
      setOperationState('error');
      setOperationMessage(error instanceof Error ? error.message : 'Unexpected integration error.');
    }
  }, [apiKey, config, folder, onUpdate]);

  return (
    <CardShell
      icon="cloud_upload"
      title="Dropbox"
      description="Back up and sync your novels to a Dropbox folder"
      enabled={config.enabled}
      status={status}
      lastSyncAt={config.lastSyncAt}
      onToggle={onToggle}
    >
      <div className={styles.integrationCard__section}>
        <div className={styles.integrationCard__field}>
          <label className={styles.integrationCard__label}>API Access Token</label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Dropbox access token"
          />
          <p className={styles.integrationCard__fieldHint}>
            Generate a token from the{' '}
            <a
              href="https://www.dropbox.com/developers/apps"
              target="_blank"
              rel="noopener noreferrer"
            >
              Dropbox App Console
            </a>
            . Your token is stored locally and never sent to any third-party
            server.
          </p>
        </div>

        <div className={styles.integrationCard__field}>
          <label className={styles.integrationCard__label}>Sync Folder Path</label>
          <Input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="/NovelWriter"
          />
          <p className={styles.integrationCard__fieldHint}>
            The Dropbox folder where novel backups will be stored. Each novel
            gets its own subfolder.
          </p>
        </div>

        <div className={styles.integrationCard__actions}>
          <Button variant="primary" disabled={operationState === 'loading'} onClick={() => run(async (cardConfig) => {
            const result = await connectIntegration('dropbox', cardConfig);
            return result.message;
          })}>
            <span className="material-symbols-rounded">link</span>
            Connect
          </Button>
          <Button variant="default" disabled={operationState === 'loading'} onClick={() => run(async (cardConfig) => {
            const result = await testIntegrationConnection('dropbox', cardConfig);
            return result.message;
          })}>
            <span className="material-symbols-rounded">wifi_tethering</span>
            Test Connection
          </Button>
          <Button variant="default" disabled={operationState === 'loading'} onClick={() => run(async (cardConfig) => {
            const result = await pushIntegrationData('dropbox', cardConfig, appState);
            return result.message;
          })}>
            <span className="material-symbols-rounded">cloud_upload</span>
            Push
          </Button>
          <Button variant="default" disabled={operationState === 'loading'} onClick={() => run(async (cardConfig) => {
            const result = await pullIntegrationData('dropbox', cardConfig, appState);
            onApplyPull(result.chapterUpdates);
            return `Pulled ${result.chapterUpdates.length} chapter(s) from Dropbox.`;
          })}>
            <span className="material-symbols-rounded">cloud_download</span>
            Pull
          </Button>
          <Button variant="default" disabled={operationState === 'loading'} onClick={() => run(async (cardConfig) => {
            const revisions = await listIntegrationRevisions('dropbox', cardConfig);
            return `Found ${revisions.length} remote revision(s).`;
          })}>
            <span className="material-symbols-rounded">history</span>
            Revisions
          </Button>
        </div>

        <OperationFeedback state={operationState} message={operationMessage} />
      </div>
    </CardShell>
  );
}
