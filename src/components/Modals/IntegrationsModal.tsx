import { useState, useCallback } from 'react';
import { Dialog, Button, Input } from '@/components/UI';
import type { IntegrationConfig, IntegrationType } from '@/types';
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

type ConnectionStatus = 'disconnected' | 'configured' | 'coming-soon';

function getConnectionStatus(
  type: IntegrationType,
  config: IntegrationConfig
): ConnectionStatus {
  if (!config.enabled) return 'disconnected';

  if (type === 'dropbox' && config.accessToken) return 'configured';
  if (type === 'google-drive') return 'coming-soon';
  if (type === 'scrivener') return 'configured';

  return 'coming-soon';
}

function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'configured':
      return 'Configured';
    case 'coming-soon':
      return 'Coming Soon';
    case 'disconnected':
    default:
      return 'Disconnected';
  }
}

function statusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'configured':
      return 'var(--accent)';
    case 'coming-soon':
      return '#eab308';
    case 'disconnected':
    default:
      return 'var(--text-muted)';
  }
}

export function IntegrationsModal({ open, onClose }: IntegrationsModalProps) {
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
        {/* Scrivener Card */}
        <ScrivenerCard
          config={configs.scrivener}
          onToggle={() => toggleEnabled('scrivener')}
          onUpdate={(updates) => updateConfig('scrivener', updates)}
        />

        {/* Google Docs Card */}
        <GoogleDriveCard
          config={configs['google-drive']}
          onToggle={() => toggleEnabled('google-drive')}
          onUpdate={(updates) => updateConfig('google-drive', updates)}
        />

        {/* Dropbox Card */}
        <DropboxCard
          config={configs.dropbox}
          onToggle={() => toggleEnabled('dropbox')}
          onUpdate={(updates) => updateConfig('dropbox', updates)}
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Integration Card Shell                                             */
/* ------------------------------------------------------------------ */

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

      {/* Status Row */}
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

      {/* Config Body - only visible when enabled */}
      {enabled && (
        <div className={styles.integrationCard__body}>{children}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scrivener Integration                                              */
/* ------------------------------------------------------------------ */

interface ScrivenerCardProps {
  config: IntegrationConfig;
  onToggle: () => void;
  onUpdate: (updates: Partial<IntegrationConfig>) => void;
}

function ScrivenerCard({ config, onToggle, onUpdate }: ScrivenerCardProps) {
  const status = getConnectionStatus('scrivener', config);

  const handleImport = () => {
    // Placeholder: in a full implementation, this would open a file picker
    // for .scriv bundles and parse the internal XML structure.
    alert(
      'Scrivener import is not yet available. This feature will allow you to import .scriv project files in a future update.'
    );
    onUpdate({ lastSyncAt: Date.now() });
  };

  const handleExport = () => {
    // Placeholder: in a full implementation, this would generate a .scriv
    // bundle from the current novel data.
    alert(
      'Scrivener export is not yet available. This feature will allow you to export your novel as a .scriv project in a future update.'
    );
    onUpdate({ lastSyncAt: Date.now() });
  };

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
          Transfer your work between NovelWriter and Scrivener. Import brings in
          your binder structure as chapters; export produces a compatible .scriv
          bundle.
        </p>
        <div className={styles.integrationCard__actions}>
          <Button variant="default" onClick={handleImport}>
            <span className="material-symbols-rounded">upload_file</span>
            Import .scriv
          </Button>
          <Button variant="default" onClick={handleExport}>
            <span className="material-symbols-rounded">download</span>
            Export .scriv
          </Button>
        </div>
      </div>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Google Docs Integration                                            */
/* ------------------------------------------------------------------ */

interface GoogleDriveCardProps {
  config: IntegrationConfig;
  onToggle: () => void;
  onUpdate: (updates: Partial<IntegrationConfig>) => void;
}

function GoogleDriveCard({
  config,
  onToggle,
}: GoogleDriveCardProps) {
  const status = getConnectionStatus('google-drive', config);

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
        <div className={styles.integrationCard__comingSoon}>
          <span className="material-symbols-rounded">lock</span>
          <div>
            <h5 className={styles.integrationCard__comingSoonTitle}>
              OAuth Required
            </h5>
            <p className={styles.integrationCard__hint}>
              Google Docs integration requires OAuth 2.0 authentication with a
              backend server to securely manage tokens. This feature is planned
              for a future release when server-side infrastructure is available.
            </p>
          </div>
        </div>

        <div className={styles.integrationCard__instructions}>
          <h5>Setup Instructions (Future)</h5>
          <ol>
            <li>A Google Cloud project with the Docs API enabled will be required.</li>
            <li>The application will redirect you to Google for authorization.</li>
            <li>Once authorized, chapters can be pushed to and pulled from Google Docs.</li>
            <li>Collaborative edits made in Google Docs will sync back on demand.</li>
          </ol>
        </div>
      </div>
    </CardShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Dropbox Integration                                                */
/* ------------------------------------------------------------------ */

interface DropboxCardProps {
  config: IntegrationConfig;
  onToggle: () => void;
  onUpdate: (updates: Partial<IntegrationConfig>) => void;
}

function DropboxCard({ config, onToggle, onUpdate }: DropboxCardProps) {
  const status = getConnectionStatus('dropbox', config);
  const [apiKey, setApiKey] = useState(config.accessToken || '');
  const [folder, setFolder] = useState(config.folderId || '/NovelWriter');

  const handleSaveConfig = () => {
    onUpdate({
      accessToken: apiKey,
      folderId: folder,
      lastSyncAt: Date.now(),
    });
  };

  const handleTestConnection = () => {
    // Placeholder: in a full implementation this would call the Dropbox API
    // to verify the access token and list files in the folder.
    if (!apiKey.trim()) {
      alert('Please enter your Dropbox API key first.');
      return;
    }
    alert(
      'Dropbox connection test is not yet implemented. The API key has been saved locally and will be used when Dropbox sync is available.'
    );
    onUpdate({
      accessToken: apiKey,
      folderId: folder,
      lastSyncAt: Date.now(),
    });
  };

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
          <label className={styles.integrationCard__label}>
            API Access Token
          </label>
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
          <label className={styles.integrationCard__label}>
            Sync Folder Path
          </label>
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
          <Button variant="primary" onClick={handleSaveConfig}>
            <span className="material-symbols-rounded">save</span>
            Save Configuration
          </Button>
          <Button variant="default" onClick={handleTestConnection}>
            <span className="material-symbols-rounded">wifi_tethering</span>
            Test Connection
          </Button>
        </div>
      </div>
    </CardShell>
  );
}
