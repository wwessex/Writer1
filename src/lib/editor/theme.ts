/**
 * CodeMirror 6 theme that maps DraftHarbour CSS custom properties.
 * Supports light, dark, and high-contrast themes.
 */
import { EditorView } from '@codemirror/view';

export const draftharbourTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--editor-font-size, 16px)',
    fontFamily: 'var(--editor-font-family, Georgia, "Times New Roman", Times, serif)',
    lineHeight: 'var(--editor-line-height, 1.6)',
    color: 'var(--text)',
    backgroundColor: 'transparent',
  },
  '.cm-content': {
    padding: '1rem 0',
    caretColor: 'var(--accent)',
    minHeight: '100%',
    maxWidth: '720px',
    margin: '0 auto',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--accent)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--selection, rgba(59, 130, 246, 0.2))',
  },
  '.cm-activeLine': {
    backgroundColor: 'transparent',
  },
  '.cm-gutters': {
    display: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },

  // ── Rich preview styles ──────────────────────────────────
  '.cm-md-heading-1': {
    fontSize: '2em',
    fontWeight: 'bold',
    lineHeight: '1.3',
  },
  '.cm-md-heading-2': {
    fontSize: '1.5em',
    fontWeight: 'bold',
    lineHeight: '1.3',
  },
  '.cm-md-heading-3': {
    fontSize: '1.25em',
    fontWeight: 'bold',
    lineHeight: '1.3',
  },
  '.cm-md-heading-4': {
    fontSize: '1.1em',
    fontWeight: 'bold',
    lineHeight: '1.3',
  },
  '.cm-md-bold': {
    fontWeight: 'bold',
  },
  '.cm-md-italic': {
    fontStyle: 'italic',
  },
  '.cm-md-strikethrough': {
    textDecoration: 'line-through',
  },
  '.cm-md-underline': {
    textDecoration: 'underline',
  },
  '.cm-md-code': {
    fontFamily: '"Courier New", Courier, monospace',
    backgroundColor: 'var(--surface-alt, rgba(0,0,0,0.05))',
    padding: '0.1em 0.3em',
    borderRadius: '3px',
  },
  '.cm-md-syntax': {
    opacity: '0.35',
    fontSize: '0.85em',
  },
  '.cm-md-blockquote': {
    borderLeft: '3px solid var(--accent, #3b82f6)',
    paddingLeft: '1em',
    color: 'var(--text-muted, #6b7280)',
    fontStyle: 'italic',
  },
  '.cm-md-hr': {
    display: 'block',
    textAlign: 'center',
    color: 'var(--border, #d1d5db)',
  },
  '.cm-md-image': {
    color: 'var(--accent, #3b82f6)',
    fontStyle: 'italic',
  },
  '.cm-md-link': {
    color: 'var(--accent, #3b82f6)',
    textDecoration: 'underline',
  },

  // ── Find/Replace highlights ──────────────────────────────
  '.cm-find-match': {
    backgroundColor: 'rgba(255, 213, 79, 0.4)',
    borderRadius: '2px',
  },
  '.cm-find-match-current': {
    backgroundColor: 'rgba(255, 152, 0, 0.6)',
    borderRadius: '2px',
  },

  // ── Comment anchor highlights ────────────────────────────
  '.cm-comment-anchor': {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderBottom: '2px solid rgba(59, 130, 246, 0.4)',
  },
  '.cm-comment-anchor-resolved': {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderBottom: '2px solid rgba(34, 197, 94, 0.3)',
  },

  // ── Fountain / Screenplay styles ─────────────────────────
  '.cm-fountain-scene-heading': {
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontSize: '1.1em',
  },
  '.cm-fountain-character': {
    textTransform: 'uppercase',
    textAlign: 'center',
    marginLeft: '25%',
  },
  '.cm-fountain-dialogue': {
    marginLeft: '15%',
    marginRight: '15%',
  },
  '.cm-fountain-parenthetical': {
    marginLeft: '20%',
    fontStyle: 'italic',
  },
  '.cm-fountain-transition': {
    textTransform: 'uppercase',
    textAlign: 'right',
  },
});

export const draftharbourHighlightTheme = EditorView.baseTheme({
  // Base theme overrides that apply regardless of theme variant
  '&light .cm-md-syntax': {
    color: '#94a3b8',
  },
  '&dark .cm-md-syntax': {
    color: '#475569',
  },
});
