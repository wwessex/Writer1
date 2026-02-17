import { useState, useCallback, useEffect } from 'react';
import { Dialog, Button, Input } from '@/components/UI';
import { ConflictResolutionModal } from '@/components/Modals/ConflictResolutionModal';
import { useApp } from '@/context/AppContext';
import {
  connectIntegration,
  listIntegrationRevisions,
  pullIntegrationData,
  pushIntegrationData,
  testIntegrationConnection,
  resolveSyncConflict,
} from '@/lib/integrations';
import {
  connectProvider,
  disconnectProvider,
  fetchProviderMetadata,
  refreshProviderConnection,
  type ProviderConnectionMetadata,
  type ProviderPublicMetadata,
} from '@/lib/integrations/api';
import type { AppState, Chapter, ConflictInfo, ConflictResolutionOption, IntegrationConfig, IntegrationType, PersistedIntegrationConfig } from '@/types';
import styles from './Modals.module.css';

interface IntegrationsModalProps {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'draftharbour_integrations';

interface IntegrationConfigs {
  scrivener: IntegrationConfig;
  'google-drive': IntegrationConfig;
  dropbox: IntegrationConfig;
}

type OperationState = 'idle' | 'loading' | 'success' | 'error';

type ConnectionStatus = 'disconnected' | 'pending' | 'connected' | 'error';

function defaultConfig(type: IntegrationType): IntegrationConfig {
  return {
    type,
    enabled: false,
    status: 'disconnected',
  };
}

function normalizeConfig(type: IntegrationType, raw?: Partial<IntegrationConfig>): IntegrationConfig {
  const base = defaultConfig(type);
  const next = {
    ...base,
    ...(raw || {}),
    type,
  };

  if (!next.status) {
    next.status = next.connectionId ? 'connected' : 'disconnected';
  }

  return next;
}

function createSafePersistedConfig(config: IntegrationConfig): PersistedIntegrationConfig {
  return {
    type: config.type,
    enabled: config.enabled,
    connectionId: config.connectionId,
    providerUserId: config.providerUserId,
    scopes: config.scopes,
    expiresAt: config.expiresAt,
    status: config.status,
    folderId: config.folderId,
    lastSyncAt: config.lastSyncAt,
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
  };
}

function loadConfigs(): IntegrationConfigs {
  const defaults: IntegrationConfigs = {
    scrivener: defaultConfig('scrivener'),
    'google-drive': defaultConfig('google-drive'),
    dropbox: defaultConfig('dropbox'),
  };

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return defaults;
    }

    const parsed = JSON.parse(data) as Partial<Record<IntegrationType, Partial<IntegrationConfig>>>;
    return {
      scrivener: normalizeConfig('scrivener', parsed.scrivener),
      'google-drive': normalizeConfig('google-drive', parsed['google-drive']),
      dropbox: normalizeConfig('dropbox', parsed.dropbox),
    };
  } catch {
    return defaults;
  }
}

function saveConfigs(configs: IntegrationConfigs) {
  const safeConfigs = {
    scrivener: createSafePersistedConfig(configs.scrivener),
    'google-drive': createSafePersistedConfig(configs['google-drive']),
    dropbox: createSafePersistedConfig(configs.dropbox),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeConfigs));
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

function getConnectionStatus(
  config: IntegrationConfig
): ConnectionStatus {
  if (!config.enabled) return 'disconnected';
  if (config.status) return config.status;
  if (config.connectionId) return 'connected';
  return 'disconnected';
}

function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'pending':
      return 'Pending';
    case 'error':
      return 'Connection issue';
    case 'disconnected':
    default:
      return 'Disconnected';
  }
}

function statusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'var(--accent)';
    case 'pending':
      return 'var(--warning)';
    case 'error':
      return 'var(--danger)';
    case 'disconnected':
    default:
      return 'var(--text-muted)';
  }
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

function mapMetadataToConfig(metadata: ProviderConnectionMetadata): Partial<IntegrationConfig> {
  return {
    connectionId: metadata.connectionId,
    providerUserId: metadata.providerUserId,
    scopes: metadata.scopes,
    expiresAt: metadata.expiresAt,
    status: metadata.status,
    accessToken: metadata.accessToken,
    refreshToken: metadata.refreshToken,
  };
}

export function IntegrationsModal({ open, onClose }: IntegrationsModalProps) {
  const { state, dispatch } = useApp();
  const [configs, setConfigs] = useState<IntegrationConfigs>(loadConfigs);
  const [providerMetadata, setProviderMetadata] = useState<Partial<Record<'google-drive' | 'dropbox', ProviderPublicMetadata>>>({});
  const [activeConflict, setActiveConflict] = useState<ConflictInfo | null>(null);

  useEffect(() => {
    if (!open) return;

    void fetchProviderMetadata()
      .then((response) => setProviderMetadata(response.providers))
      .catch(() => setProviderMetadata({}));
  }, [open]);

  const applyPullResult = useCallback((pullResult: { chapterUpdates: Chapter[]; conflicts: ConflictInfo[] }) => {
    dispatch({ type: 'SET_CHAPTERS', payload: pullResult.chapterUpdates });
    setActiveConflict(pullResult.conflicts[0] || null);
  }, [dispatch]);

  const handleResolveConflict = useCallback((resolution: ConflictResolutionOption) => {
    if (!activeConflict) return;

    const resolved = resolveSyncConflict(activeConflict, resolution);
    dispatch({
      type: 'UPDATE_CHAPTER',
      payload: {
        id: activeConflict.chapterId,
        updates: {
          content: resolved,
          updatedAt: Date.now(),
        },
      },
    });
    setActiveConflict(null);
  }, [activeConflict, dispatch]);

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
    <>
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
            onApplyPull={applyPullResult}
          />

          <GoogleDriveCard
            config={configs['google-drive']}
            metadata={providerMetadata['google-drive']}
            appState={state}
            onToggle={() => toggleEnabled('google-drive')}
            onUpdate={(updates) => updateConfig('google-drive', updates)}
            onApplyPull={applyPullResult}
          />

          <DropboxCard
            config={configs.dropbox}
            metadata={providerMetadata.dropbox}
            appState={state}
            onToggle={() => toggleEnabled('dropbox')}
            onUpdate={(updates) => updateConfig('dropbox', updates)}
            onApplyPull={applyPullResult}
          />
        </div>
      </Dialog>

      <ConflictResolutionModal
        open={Boolean(activeConflict)}
        onClose={() => setActiveConflict(null)}
        conflict={activeConflict}
        onResolve={handleResolveConflict}
      />
    </>
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
  metadata?: ProviderPublicMetadata;
  appState: Pick<AppState, 'novelId' | 'projectType' | 'chapters'>;
  onToggle: () => void;
  onUpdate: (updates: Partial<IntegrationConfig>) => void;
  onApplyPull: (pullResult: { chapterUpdates: Chapter[]; conflicts: ConflictInfo[] }) => void;
}

function ScrivenerCard({ config, appState, onToggle, onUpdate, onApplyPull }: IntegrationCardBaseProps) {
  const status = getConnectionStatus(config);
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
          Import chapters from a zipped .scriv project or export your work as a Scrivener-compatible ZIP file.
        </p>
        <div className={styles.integrationCard__actions}>
          <Button variant="default" disabled={operationState === 'loading'} onClick={() => run(async () => {
            const pullResult = await pullIntegrationData('scrivener', config, appState);
            onApplyPull(pullResult);
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

function GoogleDriveCard({ config, metadata, appState, onToggle, onUpdate, onApplyPull }: IntegrationCardBaseProps) {
  const status = getConnectionStatus(config);
  const [operationState, setOperationState] = useState<OperationState>('idle');
  const [operationMessage, setOperationMessage] = useState('Connect account to get started.');

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
      title="Google Drive"
      description="Securely connect with OAuth and sync chapters to Google Drive"
      enabled={config.enabled}
      status={status}
      lastSyncAt={config.lastSyncAt}
      onToggle={onToggle}
    >
      <div className={styles.integrationCard__section}>
        <p className={styles.integrationCard__fieldHint}>
          {metadata?.available === false
            ? `${metadata.displayName || 'Google Drive'} connect is unavailable right now.`
            : 'Connect account securely through your server-managed Google Drive integration.'}
          {metadata?.scopes?.length ? ` Scopes: ${metadata.scopes.join(', ')}` : ''}
        </p>

        <div className={styles.integrationCard__actions}>
          <Button variant="primary" disabled={operationState === 'loading' || metadata?.available === false} onClick={() => run(async () => {
            onUpdate({ status: 'pending' });
            const result = await connectProvider('google-drive');
            onUpdate(mapMetadataToConfig(result.connection));
            const connectResult = await connectIntegration('google-drive', {
              ...config,
              ...mapMetadataToConfig(result.connection),
            });
            return connectResult.message;
          })}>
            <span className="material-symbols-rounded">link</span>
            Connect Account
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.connectionId} onClick={() => run(async () => {
            const result = await refreshProviderConnection('google-drive', config.connectionId!, config.refreshToken);
            onUpdate(mapMetadataToConfig(result.connection));
            return 'Google connection refreshed.';
          })}>
            <span className="material-symbols-rounded">autorenew</span>
            Refresh Auth
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.connectionId} onClick={() => run(async () => {
            await disconnectProvider('google-drive', config.connectionId!, config.accessToken);
            onUpdate({ connectionId: undefined, providerUserId: undefined, scopes: undefined, expiresAt: undefined, status: 'disconnected', accessToken: undefined, refreshToken: undefined });
            return 'Google account disconnected.';
          })}>
            <span className="material-symbols-rounded">link_off</span>
            Disconnect
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.accessToken} onClick={() => run(async () => {
            const result = await testIntegrationConnection('google-drive', config);
            return result.message;
          })}>
            <span className="material-symbols-rounded">wifi_tethering</span>
            Test
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.accessToken} onClick={() => run(async () => {
            const result = await pushIntegrationData('google-drive', config, appState);
            return result.message;
          })}>
            <span className="material-symbols-rounded">cloud_upload</span>
            Push
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.accessToken} onClick={() => run(async () => {
            const result = await pullIntegrationData('google-drive', config, appState);
            onApplyPull(result);
            return `Pulled ${result.chapterUpdates.length} chapter(s) from Google Drive.`;
          })}>
            <span className="material-symbols-rounded">cloud_download</span>
            Pull
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.accessToken} onClick={() => run(async () => {
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


function DropboxCard({ config, metadata, appState, onToggle, onUpdate, onApplyPull }: IntegrationCardBaseProps) {
  const status = getConnectionStatus(config);
  const [folder, setFolder] = useState(config.folderId || '/DraftHarbour');
  const [operationState, setOperationState] = useState<OperationState>('idle');
  const [operationMessage, setOperationMessage] = useState('Connect account to get started.');

  const run = useCallback(async (task: (cardConfig: IntegrationConfig) => Promise<string>) => {
    setOperationState('loading');
    try {
      const cardConfig: IntegrationConfig = {
        ...config,
        folderId: folder,
      };
      const message = await task(cardConfig);
      const syncedAt = Date.now();
      onUpdate({ folderId: folder, lastSyncAt: syncedAt });
      setOperationState('success');
      setOperationMessage(message);
    } catch (error) {
      setOperationState('error');
      setOperationMessage(error instanceof Error ? error.message : 'Unexpected integration error.');
    }
  }, [config, folder, onUpdate]);

  return (
    <CardShell
      icon="cloud_upload"
      title="Dropbox"
      description="Securely connect via OAuth and sync novel backups to Dropbox"
      enabled={config.enabled}
      status={status}
      lastSyncAt={config.lastSyncAt}
      onToggle={onToggle}
    >
      <div className={styles.integrationCard__section}>
        <p className={styles.integrationCard__fieldHint}>
          {metadata?.available === false
            ? `${metadata.displayName || 'Dropbox'} connect is unavailable right now.`
            : 'Connect account securely through your server-managed Dropbox integration.'}
          {metadata?.scopes?.length ? ` Scopes: ${metadata.scopes.join(', ')}` : ''}
        </p>

        <div className={styles.integrationCard__field}>
          <label className={styles.integrationCard__label}>Sync Folder Path</label>
          <Input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="/DraftHarbour"
          />
          <p className={styles.integrationCard__fieldHint}>
            The Dropbox folder where novel backups will be stored.
          </p>
        </div>

        <div className={styles.integrationCard__actions}>
          <Button variant="primary" disabled={operationState === 'loading' || metadata?.available === false} onClick={() => run(async (cardConfig) => {
            onUpdate({ status: 'pending' });
            const result = await connectProvider('dropbox');
            onUpdate(mapMetadataToConfig(result.connection));
            const connectResult = await connectIntegration('dropbox', {
              ...cardConfig,
              ...mapMetadataToConfig(result.connection),
            });
            return connectResult.message;
          })}>
            <span className="material-symbols-rounded">link</span>
            Connect Account
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.connectionId} onClick={() => run(async (cardConfig) => {
            const result = await refreshProviderConnection('dropbox', config.connectionId!, config.refreshToken);
            onUpdate(mapMetadataToConfig(result.connection));
            return `Dropbox connection refreshed for ${cardConfig.folderId || '/DraftHarbour'}.`;
          })}>
            <span className="material-symbols-rounded">autorenew</span>
            Refresh Auth
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.connectionId} onClick={() => run(async () => {
            await disconnectProvider('dropbox', config.connectionId!, config.accessToken);
            onUpdate({ connectionId: undefined, providerUserId: undefined, scopes: undefined, expiresAt: undefined, status: 'disconnected', accessToken: undefined, refreshToken: undefined });
            return 'Dropbox account disconnected.';
          })}>
            <span className="material-symbols-rounded">link_off</span>
            Disconnect
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.accessToken} onClick={() => run(async (cardConfig) => {
            const result = await testIntegrationConnection('dropbox', cardConfig);
            return result.message;
          })}>
            <span className="material-symbols-rounded">wifi_tethering</span>
            Test Connection
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.accessToken} onClick={() => run(async (cardConfig) => {
            const result = await pushIntegrationData('dropbox', cardConfig, appState);
            return result.message;
          })}>
            <span className="material-symbols-rounded">cloud_upload</span>
            Push
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.accessToken} onClick={() => run(async (cardConfig) => {
            const result = await pullIntegrationData('dropbox', cardConfig, appState);
            onApplyPull(result);
            return `Pulled ${result.chapterUpdates.length} chapter(s) from Dropbox.`;
          })}>
            <span className="material-symbols-rounded">cloud_download</span>
            Pull
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.accessToken} onClick={() => run(async (cardConfig) => {
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
