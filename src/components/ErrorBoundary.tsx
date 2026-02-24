import { Component, type ReactNode } from 'react';
import {
  createAppError,
  enableSafeModeForNextRestart,
  reportAppError
} from '@/lib/errors';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const errorMessages = [
  'The ink spilled a bit. Your words are safe.',
  'A plot twist we didn\'t plan for. Let\'s fix that.',
  'Even the best stories have rough drafts.',
  'The quill slipped, but the manuscript is intact.',
  'A momentary stumble in an otherwise fine chapter.',
];

function getErrorMessage(): string {
  return errorMessages[Math.floor(Math.random() * errorMessages.length)];
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: '1.25rem',
    padding: '2rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    background: 'var(--bg, #0b1020)',
    color: 'var(--text, #e5e7eb)',
    animation: 'fadeIn 0.4s ease-out',
  },
  icon: {
    fontSize: '3rem',
    opacity: 0.5,
    animation: 'gentleBounce 2s ease-in-out infinite',
  },
  heading: {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: 0,
    color: 'var(--text, #e5e7eb)',
  },
  friendly: {
    color: 'var(--text-muted, #9ca3af)',
    fontSize: '0.9375rem',
    maxWidth: '400px',
    textAlign: 'center' as const,
    lineHeight: 1.6,
    margin: 0,
  },
  detail: {
    color: 'var(--text-muted, #6b7280)',
    fontSize: '0.75rem',
    maxWidth: '500px',
    textAlign: 'center' as const,
    padding: '0.75rem 1rem',
    background: 'var(--btn-bg, rgba(255,255,255,0.06))',
    borderRadius: '8px',
    fontFamily: 'monospace',
    wordBreak: 'break-word' as const,
  },
  buttonGroup: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  secondaryButton: {
    padding: '10px 20px',
    background: 'var(--btn-bg, #374151)',
    border: '1px solid var(--border, #4b5563)',
    borderRadius: '10px',
    color: 'var(--text, #e5e7eb)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 180ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  primaryButton: {
    padding: '10px 20px',
    background: 'var(--accent, #4f7cff)',
    border: 'none',
    borderRadius: '10px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    boxShadow: '0 2px 8px rgba(79, 124, 255, 0.3)',
    transition: 'all 180ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught:', error, errorInfo);
    void reportAppError(
      createAppError('REACT_BOUNDARY', error.message || 'React render failure', 'application', 'critical', { cause: { error, errorInfo } }),
      { category: 'react_boundary' }
    );
  }

  private handleExportBackup = async () => {
    try {
      const storageModule = await import('@/lib/storage');
      // Try to export from the first novel found in the DB
      const novels = await storageModule.getAllNovels();
      const novelId = novels[0]?.id;
      if (!novelId) { alert('No project data found to export.'); return; }
      const data = await storageModule.exportBackup(novelId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draftharbour-emergency-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Emergency backup export failed:', e);
      alert('Backup export failed. Your data is still in IndexedDB — try using browser DevTools to access it.');
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <span className="material-symbols-rounded" style={styles.icon}>
            edit_note
          </span>
          <h1 style={styles.heading}>
            {getErrorMessage()}
          </h1>
          <p style={styles.friendly}>
            Something unexpected happened, but don&apos;t worry — your writing is safely
            stored locally. You can export a backup or reload to get back on track.
          </p>
          {this.state.error?.message && (
            <p style={styles.detail}>
              {this.state.error.message}
            </p>
          )}
          <div style={styles.buttonGroup}>
            <button
              onClick={this.handleExportBackup}
              style={styles.secondaryButton}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.background = 'var(--btn-hover, #4b5563)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = 'var(--btn-bg, #374151)';
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            >
              Export Backup
            </button>
            <button
              onClick={() => {
                enableSafeModeForNextRestart();
                window.location.reload();
              }}
              style={styles.secondaryButton}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 124, 255, 0.4)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(79, 124, 255, 0.3)';
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            >
              Restart in Safe Mode
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
