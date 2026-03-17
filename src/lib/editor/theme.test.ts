import { describe, expect, it } from 'vitest';
import { draftharbourTheme, draftharbourHighlightTheme } from './theme';

describe('theme', () => {
  it('exports draftharbourTheme as a CodeMirror extension', () => {
    expect(draftharbourTheme).toBeDefined();
  });

  it('exports draftharbourHighlightTheme as a CodeMirror extension', () => {
    expect(draftharbourHighlightTheme).toBeDefined();
  });
});
