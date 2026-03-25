import { useState, useCallback, useEffect } from 'react';
import { Dialog, Button, Input } from '@/components/UI';
import { ConflictResolutionModal } from '@/components/Modals/ConflictResolutionModal';
import { useApp } from '@/context/AppContext';
import {
  connectIntegration,
  listIntegrationRevisions,
  pullIntegrationData,
  pushIntegrationData,
  resolveSyncConflict,
} from '@/lib/integrations';
import {
  connectProvider,
  disconnectProvider,
  refreshProviderConnection,
  type ProviderConnectionMetadata,
} from '@/lib/integrations/api';
import type { AppState, Chapter, ConflictInfo, ConflictResolutionOption, IntegrationConfig, IntegrationType, PersistedIntegrationConfig } from '@/types';
import { recordTelemetryEvent } from '@/lib/telemetry';
import { createAppError, reportAppError } from '@/lib/errors';
import { secureCacheDecode, secureCacheEncode } from '@/lib/secureCache';
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
    clientId: config.clientId,
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
    const scrubLegacySecrets = (raw?: Partial<IntegrationConfig>): Partial<IntegrationConfig> => {
      if (!raw) return {};
      const { accessToken: _a, apiKey: _k, ...safe } = raw as Partial<IntegrationConfig> & {
        accessToken?: string;
        apiKey?: string;
      };
      void _a; void _k;
      return safe;
    };

    const normalized = {
      scrivener: normalizeConfig('scrivener', scrubLegacySecrets(parsed.scrivener)),
      'google-drive': normalizeConfig('google-drive', scrubLegacySecrets(parsed['google-drive'])),
      dropbox: normalizeConfig('dropbox', scrubLegacySecrets(parsed.dropbox)),
    };

    saveConfigs(normalized);

    return normalized;
  } catch {
    return defaults;
  }
}

async function loadConfigsEncrypted(): Promise<IntegrationConfigs | null> {
  try {
    const encrypted = localStorage.getItem(`${STORAGE_KEY}_enc`);
    if (!encrypted) return null;
    const decoded = await secureCacheDecode(encrypted);
    if (!decoded) return null;
    localStorage.setItem(STORAGE_KEY, decoded);
    return loadConfigs();
  } catch {
    return null;
  }
}

function saveConfigs(configs: IntegrationConfigs) {
  const safeConfigs = {
    scrivener: createSafePersistedConfig(configs.scrivener),
    'google-drive': createSafePersistedConfig(configs['google-drive']),
    dropbox: createSafePersistedConfig(configs.dropbox),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeConfigs));
  void secureCacheEncode(JSON.stringify(safeConfigs)).then(encrypted => {
    localStorage.setItem(`${STORAGE_KEY}_enc`, encrypted);
  });
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
    sessionToken: metadata.sessionToken,
    refreshToken: metadata.refreshToken,
  };
}


function isTokenExpired(config: IntegrationConfig): boolean {
  if (!config.expiresAt) return false;
  return config.expiresAt <= Date.now();
}

function isTokenExpiringSoon(config: IntegrationConfig, thresholdMs = 5 * 60 * 1000): boolean {
  if (!config.expiresAt) return false;
  return config.expiresAt - Date.now() <= thresholdMs;
}

export function IntegrationsModal({ open, onClose }: IntegrationsModalProps) {
  const { state, dispatch } = useApp();
  const [configs, setConfigs] = useState<IntegrationConfigs>(loadConfigs);

  useEffect(() => {
    void loadConfigsEncrypted().then(loaded => {
      if (loaded) {
        setConfigs(loaded);
      }
    });
  }, []);
  const [activeConflict, setActiveConflict] = useState<ConflictInfo | null>(null);

  const applyPullResult = useCallback((pullResult: { chapterUpdates: Chapter[]; conflicts: ConflictInfo[] }) => {
    dispatch({ type: 'SET_CHAPTERS', payload: pullResult.chapterUpdates });
    const conflict = pullResult.conflicts[0] || null;
    if (conflict) {
      recordTelemetryEvent({
        action: 'integrations.sync_conflict',
        contextLengthChars: 0,
        promptLengthChars: 0,
        responseLengthChars: 0,
        provider: conflict.provider,
        success: false,
        errorType: conflict.remoteRevisionId || 'revision_conflict',
      });
      void reportAppError(
        createAppError('SYNC_CONFLICT', 'Integration sync conflict detected.', 'network', 'medium', { cause: conflict }),
        { category: 'sync_conflict', context: `provider=${conflict.provider}` }
      );
    }
    setActiveConflict(conflict);
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

  // Auto-refresh tokens that are about to expire
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const checkProviderSessions = async () => {
      await Promise.all((['google-drive', 'dropbox'] as const).map(async (provider) => {
        const cfg = configs[provider];
        if (!cfg.connectionId || !cfg.sessionToken || !cfg.refreshToken || !cfg.clientId) return;

        if (isTokenExpiringSoon(cfg)) {
          try {
            const refreshed = await refreshProviderConnection(provider, cfg.connectionId, cfg);
            if (cancelled) return;
            updateConfig(provider, mapMetadataToConfig(refreshed.connection));
          } catch (error) {
            if (cancelled) return;
            updateConfig(provider, { status: 'error' });
            recordTelemetryEvent({
              action: 'integrations.token_refresh_failed',
              contextLengthChars: 0,
              promptLengthChars: 0,
              responseLengthChars: 0,
              provider,
              success: false,
              errorType: error instanceof Error ? error.message : 'unknown_error',
            });
            void reportAppError(
              createAppError('INTEGRATION_AUTH_FAILED', `${provider} token refresh failed.`, 'network', 'medium', { cause: error }),
              { category: 'integration_auth_failure', context: `provider=${provider}` }
            );
          }
        }
      }));
    };

    void checkProviderSessions();
    const interval = window.setInterval(() => {
      void checkProviderSessions();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [open, configs, updateConfig]);

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
            appState={state}
            onToggle={() => toggleEnabled('google-drive')}
            onUpdate={(updates) => updateConfig('google-drive', updates)}
            onApplyPull={applyPullResult}
          />

          <DropboxCard
            config={configs.dropbox}
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

function GoogleDriveCard({ config, appState, onToggle, onUpdate, onApplyPull }: IntegrationCardBaseProps) {
  const status = getConnectionStatus(config);
  const [operationState, setOperationState] = useState<OperationState>('idle');
  const [operationMessage, setOperationMessage] = useState('Click Connect to sign in with your Google account.');
  const [customClientId, setCustomClientId] = useState(config.clientId || '');
  const expired = isTokenExpired(config);

  const effectiveClientId = customClientId.trim();

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

  const connectOrReconnectLabel = config.connectionId && expired ? 'Reconnect' : 'Connect';

  return (
    <CardShell
      icon="docs"
      title="Google Drive"
      description="Sync chapters to Google Drive with one click"
      enabled={config.enabled}
      status={status}
      lastSyncAt={config.lastSyncAt}
      onToggle={onToggle}
    >
      <div className={styles.integrationCard__section}>
        <p className={styles.integrationCard__hint}>
          Sync chapters to Google Drive. Enter your Google OAuth Client ID to connect.
        </p>

        {config.providerUserId && (
          <p className={styles.integrationCard__fieldHint}>
            Account: {config.providerUserId}
          </p>
        )}

        <div className={styles.integrationCard__actions}>
          <Button variant="primary" disabled={operationState === 'loading' || !effectiveClientId} onClick={() => run(async () => {
            onUpdate({ status: 'pending' });
            try {
              const result = await connectProvider('google-drive', effectiveClientId);
              onUpdate({ ...mapMetadataToConfig(result.connection), clientId: effectiveClientId });
              const connectResult = await connectIntegration('google-drive', {
                ...config,
                clientId: effectiveClientId,
                ...mapMetadataToConfig(result.connection),
              });
              recordTelemetryEvent({ action: 'integrations.connect_success', contextLengthChars: 0, promptLengthChars: 0, responseLengthChars: 0, provider: 'google-drive', success: true });
              return connectResult.message;
            } catch (error) {
              onUpdate({ status: 'error' });
              recordTelemetryEvent({ action: 'integrations.connect_fail', contextLengthChars: 0, promptLengthChars: 0, responseLengthChars: 0, provider: 'google-drive', success: false, errorType: error instanceof Error ? error.message : 'unknown_error' });
              throw error;
            }
          })}>
            <span className="material-symbols-rounded">link</span>
            {connectOrReconnectLabel}
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.connectionId} onClick={() => run(async () => {
            await disconnectProvider('google-drive', config.connectionId!, config.sessionToken);
            onUpdate({ connectionId: undefined, providerUserId: undefined, scopes: undefined, expiresAt: undefined, status: 'disconnected', sessionToken: undefined, refreshToken: undefined });
            return 'Google account disconnected.';
          })}>
            <span className="material-symbols-rounded">link_off</span>
            Disconnect
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.sessionToken} onClick={() => run(async () => {
            let currentConfig = config;
            if (expired && config.refreshToken && config.clientId) {
              const refresh = await refreshProviderConnection('google-drive', config.connectionId!, config);
              const updates = mapMetadataToConfig(refresh.connection);
              onUpdate(updates);
              currentConfig = { ...config, ...updates };
            }
            const pushResult = await pushIntegrationData('google-drive', currentConfig, appState);
            const pullResult = await pullIntegrationData('google-drive', currentConfig, appState);
            onApplyPull(pullResult);
            return `${pushResult.message} Synced ${pullResult.chapterUpdates.length} chapter(s).`;
          })}>
            <span className="material-symbols-rounded">sync</span>
            Sync now
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.sessionToken} onClick={() => run(async () => {
            const revisions = await listIntegrationRevisions('google-drive', config);
            return `Found ${revisions.length} remote revision(s).`;
          })}>
            <span className="material-symbols-rounded">history</span>
            Revisions
          </Button>
        </div>

        <div className={styles.integrationCard__field}>
          <label className={styles.integrationCard__label}>Google OAuth Client ID</label>
          <Input
            value={customClientId}
            onChange={(e) => {
              setCustomClientId(e.target.value);
              if (e.target.value.trim()) {
                onUpdate({ clientId: e.target.value.trim() });
              }
            }}
            placeholder="your-app.apps.googleusercontent.com"
          />
          <p className={styles.integrationCard__fieldHint}>
            Create a client ID at console.cloud.google.com (APIs &amp; Services &gt; Credentials &gt; OAuth 2.0 Client ID). Select &quot;Web application&quot; and add your app URL as an authorized redirect URI.
          </p>
        </div>

        <OperationFeedback state={operationState} message={operationMessage} />
      </div>
    </CardShell>
  );
}


function DropboxCard({ config, appState, onToggle, onUpdate, onApplyPull }: IntegrationCardBaseProps) {
  const status = getConnectionStatus(config);
  const [folder, setFolder] = useState(config.folderId || '/DraftHarbour');
  const [customAppKey, setCustomAppKey] = useState(config.clientId || '');
  const [operationState, setOperationState] = useState<OperationState>('idle');
  const [operationMessage, setOperationMessage] = useState('Enter your Dropbox App Key and click Connect.');
  const expired = isTokenExpired(config);

  const effectiveAppKey = customAppKey.trim();

  const run = useCallback(async (task: (cardConfig: IntegrationConfig) => Promise<string>) => {
    setOperationState('loading');
    try {
      const cardConfig: IntegrationConfig = {
        ...config,
        folderId: folder,
        clientId: effectiveAppKey,
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
  }, [config, folder, effectiveAppKey, onUpdate]);

  const connectOrReconnectLabel = config.connectionId && expired ? 'Reconnect' : 'Connect';

  return (
    <CardShell
      icon="cloud_upload"
      title="Dropbox"
      description="Sync novel backups to Dropbox with one click"
      enabled={config.enabled}
      status={status}
      lastSyncAt={config.lastSyncAt}
      onToggle={onToggle}
    >
      <div className={styles.integrationCard__section}>
        <p className={styles.integrationCard__hint}>
          Sync novel backups to Dropbox. Enter your Dropbox App Key to connect.
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

        {config.providerUserId && (
          <p className={styles.integrationCard__fieldHint}>
            Account: {config.providerUserId}
          </p>
        )}

        <div className={styles.integrationCard__actions}>
          <Button variant="primary" disabled={operationState === 'loading' || !effectiveAppKey} onClick={() => run(async (cardConfig) => {
            onUpdate({ status: 'pending' });
            try {
              const result = await connectProvider('dropbox', effectiveAppKey);
              onUpdate({ ...mapMetadataToConfig(result.connection), clientId: effectiveAppKey });
              const connectResult = await connectIntegration('dropbox', {
                ...cardConfig,
                ...mapMetadataToConfig(result.connection),
              });
              recordTelemetryEvent({ action: 'integrations.connect_success', contextLengthChars: 0, promptLengthChars: 0, responseLengthChars: 0, provider: 'dropbox', success: true });
              return connectResult.message;
            } catch (error) {
              onUpdate({ status: 'error' });
              recordTelemetryEvent({ action: 'integrations.connect_fail', contextLengthChars: 0, promptLengthChars: 0, responseLengthChars: 0, provider: 'dropbox', success: false, errorType: error instanceof Error ? error.message : 'unknown_error' });
              throw error;
            }
          })}>
            <span className="material-symbols-rounded">link</span>
            {connectOrReconnectLabel}
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.connectionId} onClick={() => run(async () => {
            await disconnectProvider('dropbox', config.connectionId!, config.sessionToken);
            onUpdate({ connectionId: undefined, providerUserId: undefined, scopes: undefined, expiresAt: undefined, status: 'disconnected', sessionToken: undefined, refreshToken: undefined });
            return 'Dropbox account disconnected.';
          })}>
            <span className="material-symbols-rounded">link_off</span>
            Disconnect
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.sessionToken} onClick={() => run(async (cardConfig) => {
            let currentConfig = cardConfig;
            if (expired && config.refreshToken && config.clientId) {
              const refresh = await refreshProviderConnection('dropbox', config.connectionId!, config);
              const updates = mapMetadataToConfig(refresh.connection);
              onUpdate(updates);
              currentConfig = { ...cardConfig, ...updates };
            }
            const pushResult = await pushIntegrationData('dropbox', currentConfig, appState);
            const pullResult = await pullIntegrationData('dropbox', currentConfig, appState);
            onApplyPull(pullResult);
            return `${pushResult.message} Synced ${pullResult.chapterUpdates.length} chapter(s).`;
          })}>
            <span className="material-symbols-rounded">sync</span>
            Sync now
          </Button>
          <Button variant="default" disabled={operationState === 'loading' || !config.sessionToken} onClick={() => run(async (cardConfig) => {
            const revisions = await listIntegrationRevisions('dropbox', cardConfig);
            return `Found ${revisions.length} remote revision(s).`;
          })}>
            <span className="material-symbols-rounded">history</span>
            Revisions
          </Button>
        </div>

        <div className={styles.integrationCard__field}>
          <label className={styles.integrationCard__label}>Dropbox App Key</label>
          <Input
            value={customAppKey}
            onChange={(e) => {
              setCustomAppKey(e.target.value);
              if (e.target.value.trim()) {
                onUpdate({ clientId: e.target.value.trim() });
              }
            }}
            placeholder="your-dropbox-app-key"
          />
          <p className={styles.integrationCard__fieldHint}>
            Create an app at dropbox.com/developers/apps (App type: Scoped access, Full Dropbox). Copy the App Key from the Settings tab.
          </p>
        </div>

        <OperationFeedback state={operationState} message={operationMessage} />
      </div>
    </CardShell>
  );
}
