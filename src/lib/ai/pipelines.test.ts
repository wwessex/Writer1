import { describe, expect, it } from 'vitest';
import { applyInsertionMode, renderPipelinePrompt } from './pipelines';

describe('ai pipelines', () => {
  it('renders template variables', () => {
    const rendered = renderPipelinePrompt('A {{chapterText}} B {{currentDraft}} C {{userPrompt}} D {{toneReference}}', {
      chapterText: 'chapter',
      currentDraft: 'draft',
      userPrompt: 'prompt',
      toneReference: 'tone',
    });

    expect(rendered).toContain('A chapter');
    expect(rendered).toContain('B draft');
    expect(rendered).toContain('C prompt');
    expect(rendered).toContain('D tone');
  });

  it('applies append and side-by-side modes', () => {
    expect(applyInsertionMode('old', 'new', 'append')).toBe('old\n\nnew');
    expect(applyInsertionMode('old', 'new', 'side-by-side')).toContain('=== Original Draft ===');
    expect(applyInsertionMode('old', 'new', 'replace')).toBe('new');
  });
});
