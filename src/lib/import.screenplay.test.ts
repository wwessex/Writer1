import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importFountain, mapImportedContentToProjectType } from './import';

function readFixture(name: string): string {
  return readFileSync(resolve(process.cwd(), 'src/lib/fixtures/import', name), 'utf8');
}

describe('screenplay import', () => {
  it('parses fountain scenes into ordered screenplay sections with metadata', async () => {
    const file = new File([readFixture('sample-basic.fountain')], 'sample-basic.fountain', { type: 'text/plain' });
    const result = await importFountain(file);

    expect(result.notices).toEqual([]);
    expect(result.sections).toHaveLength(2);
    expect(result.sections.map(section => section.title)).toEqual(['INT. KITCHEN - DAY', 'EXT. STREET - NIGHT']);
    expect(result.sections.map(section => section.metadata?.sourceFormat)).toEqual(['fountain', 'fountain']);

    // Content is now a Markdown/Fountain string
    const firstContent = result.sections[0].content;
    expect(typeof firstContent).toBe('string');
    expect(firstContent).toContain('INT. KITCHEN');
  });

  it('keeps import resilient and emits notices for partially supported constructs', async () => {
    const file = new File([readFixture('sample-partial-support.fountain')], 'sample-partial-support.fountain', { type: 'text/plain' });
    const result = await importFountain(file);

    expect(result.sections).toHaveLength(2);
    expect(result.notices.map(notice => notice.message)).toEqual([
      'Section headings are not fully supported and were imported as action text.',
      'Synopses are imported as action text.',
      'Inline notes are imported as action text.',
    ]);
  });

  it('maps imported content to project-specific schema attributes', () => {
    const content = 'Hello world';

    const screenplayContent = mapImportedContentToProjectType(content, 'screenplay');
    const bookContent = mapImportedContentToProjectType(screenplayContent, 'book');

    // Content is now a plain string, mapImportedContentToProjectType is identity
    expect(typeof screenplayContent).toBe('string');
    expect(typeof bookContent).toBe('string');
    expect(bookContent).toBe(content);
  });
});
