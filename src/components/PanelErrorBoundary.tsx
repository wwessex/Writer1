import { Component, type ReactNode } from 'react';

interface PanelErrorBoundaryProps {
  panel: string;
  children: ReactNode;
}

interface PanelErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Section-level error boundary that renders a compact recovery message
 * instead of taking down the entire app.
 */
export class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[PanelErrorBoundary:${this.props.panel}]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
          gap: '0.75rem',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
          textAlign: 'center',
          height: '100%',
          minHeight: '120px',
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: '1.5rem', color: 'var(--danger, #ef4444)' }}>
            error
          </span>
          <p>This panel encountered an error.</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '6px 14px',
              background: 'var(--btn-bg, var(--panel))',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm, 8px)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
