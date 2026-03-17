import { describe, expect, it } from 'vitest';
import { importFile } from './import';

function makeTextFile(content: string, name = 'test.txt'): File {
  return new File([content], name, { type: 'text/plain' });
}

async function makeDocxFile(name: string, type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'): Promise<File> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Chapter 1</w:t></w:r></w:p><w:p><w:r><w:t>Hello from DOCX</w:t></w:r></w:p></w:body></w:document>'
  );
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], name, { type });
}

describe('docx import', () => {
  it('imports DOCX when filename extension has trailing spaces and uppercase', async () => {
    const result = await importFile(await makeDocxFile('manuscript.DOCX   '));
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].title).toBe('Chapter 1');
  });

  it('imports DOCX based on MIME type even without .docx extension', async () => {
    const result = await importFile(await makeDocxFile('manuscript.upload'));
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].title).toBe('Chapter 1');
  });
});

describe('chapter heading detection', () => {
  describe('named section patterns', () => {
    it('recognises "Interlude" as a chapter heading', async () => {
      const text = [
        'Chapter 1',
        'Some text for chapter one.',
        'Interlude',
        'Some interlude text.',
        'Chapter 2',
        'Some text for chapter two.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections.map(s => s.title)).toEqual([
        'Chapter 1',
        'Interlude',
        'Chapter 2',
      ]);
    });

    it('recognises "Interlude: The Dream" with subtitle', async () => {
      const text = [
        'Chapter 1',
        'Content.',
        'Interlude: The Dream',
        'Dream content.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections.map(s => s.title)).toEqual([
        'Chapter 1',
        'Interlude: The Dream',
      ]);
    });

    it('recognises "Postscript" as a chapter heading', async () => {
      const text = [
        'Chapter 1',
        'Content.',
        'Postscript',
        'Final thoughts.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections.map(s => s.title)).toEqual([
        'Chapter 1',
        'Postscript',
      ]);
    });

    it("recognises \"Author's Note\" as a chapter heading", async () => {
      const text = [
        'Chapter 1',
        'Content.',
        "Author's Note",
        'A note from the author.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections.map(s => s.title)).toEqual([
        'Chapter 1',
        "Author's Note",
      ]);
    });
  });

  describe('contextual heading detection for untitled chapters', () => {
    it('detects a non-standard title between numbered chapters', async () => {
      const text = [
        'Chapter 5',
        'Content for chapter five.',
        '',
        'The Evidence',
        '',
        'Content for The Evidence chapter.',
        '',
        'Chapter 6',
        'Content for chapter six.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections.map(s => s.title)).toEqual([
        'Chapter 5',
        'The Evidence',
        'Chapter 6',
      ]);
    });

    it('preserves correct content in each detected chapter', async () => {
      const text = [
        'Chapter 5',
        'Five content here.',
        '',
        'The Evidence',
        '',
        'Evidence content here.',
        '',
        'Chapter 6',
        'Six content here.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections).toHaveLength(3);

      // Check Chapter 5 content
      expect(result.sections[0].content).toContain('Five content here.');

      // Check The Evidence content
      expect(result.sections[1].content).toContain('Evidence content here.');

      // Check Chapter 6 content
      expect(result.sections[2].content).toContain('Six content here.');
    });

    it('detects multiple non-standard titles in correct order', async () => {
      const text = [
        'Chapter 1',
        'Content one.',
        '',
        'The Morning After',
        '',
        'Morning content.',
        '',
        'Chapter 2',
        'Content two.',
        '',
        'Revelations',
        '',
        'Revelation content.',
        '',
        'Chapter 3',
        'Content three.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections.map(s => s.title)).toEqual([
        'Chapter 1',
        'The Morning After',
        'Chapter 2',
        'Revelations',
        'Chapter 3',
      ]);
    });

    it('does NOT treat a sentence ending with punctuation as a title', async () => {
      const text = [
        'Chapter 1',
        'Content one.',
        '',
        'He ran away.',
        '',
        'More content.',
        '',
        'Chapter 2',
        'Content two.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections.map(s => s.title)).toEqual([
        'Chapter 1',
        'Chapter 2',
      ]);
    });

    it('does NOT treat dialogue as a title', async () => {
      const text = [
        'Chapter 1',
        'Content one.',
        '',
        '"Hello there"',
        '',
        'More content.',
        '',
        'Chapter 2',
        'Content two.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections.map(s => s.title)).toEqual([
        'Chapter 1',
        'Chapter 2',
      ]);
    });

    it('does NOT treat a long line as a title', async () => {
      const text = [
        'Chapter 1',
        'Content one.',
        '',
        'The very long and winding road that stretched into the horizon beyond view',
        '',
        'More content.',
        '',
        'Chapter 2',
        'Content two.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections.map(s => s.title)).toEqual([
        'Chapter 1',
        'Chapter 2',
      ]);
    });

    it('does NOT activate contextual detection without numbered chapters', async () => {
      const text = [
        'Once upon a time there was a story.',
        '',
        'The Evidence',
        '',
        'More of the story continued here.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      // Without any "Chapter X" heading, contextual detection is off
      // The whole thing becomes one chapter (or detected via other heuristics)
      expect(result.sections).toHaveLength(1);
    });


    it('keeps a non-standard heading in original order when body starts immediately', async () => {
      const text = [
        'Chapter 5',
        'Content for chapter five.',
        '',
        'The Evidence',
        'Evidence content starts right away.',
        '',
        'Chapter 6',
        'Content for chapter six.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections.map(s => s.title)).toEqual([
        'Chapter 5',
        'The Evidence',
        'Chapter 6',
      ]);
    });

    it('does NOT treat a line without preceding blank line as a title', async () => {
      const text = [
        'Chapter 1',
        'Content one.',
        'The Evidence',
        '',
        'More content.',
        '',
        'Chapter 2',
        'Content two.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      // "The Evidence" is not preceded by blank line, so it stays in Chapter 1
      expect(result.sections.map(s => s.title)).toEqual([
        'Chapter 1',
        'Chapter 2',
      ]);
    });

    it('handles a non-standard title at the very start before numbered chapters', async () => {
      const text = [
        'The Beginning',
        '',
        'Some opening text.',
        '',
        'Chapter 1',
        'Content one.',
        '',
        'Chapter 2',
        'Content two.',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections.map(s => s.title)).toEqual([
        'The Beginning',
        'Chapter 1',
        'Chapter 2',
      ]);
    });

    it('handles a non-standard title at the very end after numbered chapters', async () => {
      const text = [
        'Chapter 1',
        'Content one.',
        '',
        'Chapter 2',
        'Content two.',
        '',
        'The End',
      ].join('\n');

      const result = await importFile(makeTextFile(text));
      expect(result.sections.map(s => s.title)).toEqual([
        'Chapter 1',
        'Chapter 2',
        'The End',
      ]);
    });
  });
});
