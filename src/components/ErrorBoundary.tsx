import { Component, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '1rem',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          background: '#0b1020',
          color: '#e5e7eb'
        }}>
          <h1 style={{ color: '#ef4444', margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#9ca3af', maxWidth: '400px', textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={this.handleExportBackup}
              style={{
                padding: '10px 20px',
                background: '#374151',
                border: '1px solid #4b5563',
                borderRadius: '6px',
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Export Backup
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                background: '#60a5fa',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
