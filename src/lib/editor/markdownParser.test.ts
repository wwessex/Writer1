import { describe, expect, it } from 'vitest';
import {
  markdownToPlainText,
  markdownToBlocks,
  markdownToScreenplayBlocks,
  extractDialogueBySpeaker,
} from './markdownParser';

// ── markdownToPlainText ──────────────────────────────────

describe('markdownToPlainText', () => {
  it('returns empty string for null input', () => {
    expect(markdownToPlainText(null)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(markdownToPlainText('')).toBe('');
  });

  it('returns empty string for non-string input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(markdownToPlainText({ type: 'doc' } as any)).toBe('');
  });

  it('strips bold markers', () => {
    expect(markdownToPlainText('**bold text**')).toBe('bold text');
    expect(markdownToPlainText('__also bold__')).toBe('also bold');
  });

  it('strips italic markers', () => {
    expect(markdownToPlainText('*italic text*')).toBe('italic text');
    expect(markdownToPlainText('_also italic_')).toBe('also italic');
  });

  it('strips bold+italic markers', () => {
    expect(markdownToPlainText('***bold italic***')).toBe('bold italic');
    expect(markdownToPlainText('___bold italic___')).toBe('bold italic');
  });

  it('strips strikethrough markers', () => {
    expect(markdownToPlainText('~~deleted~~')).toBe('deleted');
  });

  it('strips underline HTML tags', () => {
    expect(markdownToPlainText('<u>underlined</u>')).toBe('underlined');
  });

  it('strips heading markers', () => {
    expect(markdownToPlainText('# Heading 1')).toBe('Heading 1');
    expect(markdownToPlainText('## Heading 2')).toBe('Heading 2');
    expect(markdownToPlainText('###### Heading 6')).toBe('Heading 6');
  });

  it('strips links but keeps text', () => {
    expect(markdownToPlainText('[click here](https://example.com)')).toBe('click here');
  });

  it('strips images but keeps alt text', () => {
    expect(markdownToPlainText('![alt text](image.png)')).toBe('alt text');
  });

  it('strips unordered list markers', () => {
    expect(markdownToPlainText('- item one\n* item two\n+ item three'))
      .toBe('item one\nitem two\nitem three');
  });

  it('strips ordered list markers', () => {
    expect(markdownToPlainText('1. first\n2. second')).toBe('first\nsecond');
  });

  it('strips blockquote markers', () => {
    expect(markdownToPlainText('> quoted text')).toBe('quoted text');
  });

  it('strips code fences', () => {
    expect(markdownToPlainText('```\nconst x = 1;\n```')).toBe('const x = 1;');
  });

  it('strips inline code backticks', () => {
    expect(markdownToPlainText('use `console.log` here')).toBe('use console.log here');
  });

  it('strips horizontal rules', () => {
    expect(markdownToPlainText('---')).toBe('');
    expect(markdownToPlainText('----')).toBe('');
  });

  it('handles Fountain forced markers', () => {
    expect(markdownToPlainText('.FORCED HEADING\n@CHARACTER\n>TRANSITION'))
      .toBe('FORCED HEADING\nCHARACTER\nTRANSITION');
  });

  it('collapses multiple blank lines', () => {
    expect(markdownToPlainText('line one\n\n\n\nline two')).toBe('line one\n\nline two');
  });
});

// ── markdownToBlocks ─────────────────────────────────────

describe('markdownToBlocks', () => {
  it('returns empty array for null', () => {
    expect(markdownToBlocks(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(markdownToBlocks('')).toEqual([]);
  });

  it('parses headings with correct levels', () => {
    const blocks = markdownToBlocks('# Title\n## Subtitle\n### Sub-sub');
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1, text: 'Title' });
    expect(blocks[1]).toMatchObject({ type: 'heading', level: 2, text: 'Subtitle' });
    expect(blocks[2]).toMatchObject({ type: 'heading', level: 3, text: 'Sub-sub' });
  });

  it('parses plain paragraphs', () => {
    const blocks = markdownToBlocks('Hello world');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'paragraph', text: 'Hello world' });
  });

  it('parses bullet list items', () => {
    const blocks = markdownToBlocks('- first\n* second\n+ third');
    expect(blocks).toHaveLength(3);
    blocks.forEach(b => expect(b.type).toBe('bulletItem'));
    expect(blocks[0].text).toBe('first');
    expect(blocks[1].text).toBe('second');
    expect(blocks[2].text).toBe('third');
  });

  it('parses ordered list items', () => {
    const blocks = markdownToBlocks('1. alpha\n2. beta');
    expect(blocks).toHaveLength(2);
    blocks.forEach(b => expect(b.type).toBe('orderedItem'));
    expect(blocks[0].text).toBe('alpha');
    expect(blocks[1].text).toBe('beta');
  });

  it('parses blockquotes', () => {
    const blocks = markdownToBlocks('> quoted line');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'blockquote', text: 'quoted line' });
  });

  it('parses empty blockquote marker', () => {
    const blocks = markdownToBlocks('>');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'blockquote', text: '' });
  });

  it('parses code blocks', () => {
    const blocks = markdownToBlocks('```js\nconst x = 1;\nconst y = 2;\n```');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('codeBlock');
    expect(blocks[0].text).toBe('const x = 1;\nconst y = 2;');
  });

  it('parses horizontal rules', () => {
    const blocks = markdownToBlocks('---');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'horizontalRule', text: '' });
  });

  it('parses *** horizontal rule', () => {
    const blocks = markdownToBlocks('***');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('horizontalRule');
  });

  it('parses images', () => {
    const blocks = markdownToBlocks('![my image](http://example.com/img.png)');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'image', text: 'my image' });
  });

  it('skips blank lines', () => {
    const blocks = markdownToBlocks('line one\n\nline two');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].text).toBe('line one');
    expect(blocks[1].text).toBe('line two');
  });

  it('produces inline runs with bold', () => {
    const blocks = markdownToBlocks('**bold** text');
    expect(blocks).toHaveLength(1);
    const boldRun = blocks[0].runs.find(r => r.bold);
    expect(boldRun).toBeDefined();
    expect(boldRun!.text).toBe('bold');
  });

  it('produces inline runs with italic', () => {
    const blocks = markdownToBlocks('*italic* text');
    expect(blocks).toHaveLength(1);
    const italicRun = blocks[0].runs.find(r => r.italic);
    expect(italicRun).toBeDefined();
    expect(italicRun!.text).toBe('italic');
  });

  it('produces inline runs with strikethrough', () => {
    const blocks = markdownToBlocks('~~struck~~ text');
    expect(blocks).toHaveLength(1);
    const strikeRun = blocks[0].runs.find(r => r.strike);
    expect(strikeRun).toBeDefined();
    expect(strikeRun!.text).toBe('struck');
  });

  it('produces inline runs with underline', () => {
    const blocks = markdownToBlocks('<u>underline</u> text');
    expect(blocks).toHaveLength(1);
    const underlineRun = blocks[0].runs.find(r => r.underline);
    expect(underlineRun).toBeDefined();
    expect(underlineRun!.text).toBe('underline');
  });

  it('produces inline runs with bold+italic', () => {
    const blocks = markdownToBlocks('***both***');
    expect(blocks).toHaveLength(1);
    const run = blocks[0].runs.find(r => r.bold && r.italic);
    expect(run).toBeDefined();
    expect(run!.text).toBe('both');
  });
});

// ── markdownToScreenplayBlocks ───────────────────────────

describe('markdownToScreenplayBlocks', () => {
  it('returns empty array for null', () => {
    expect(markdownToScreenplayBlocks(null)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(markdownToScreenplayBlocks('')).toEqual([]);
  });

  it('parses INT. scene headings', () => {
    const blocks = markdownToScreenplayBlocks('INT. OFFICE - DAY');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'scene-heading', text: 'INT. OFFICE - DAY' });
  });

  it('parses EXT. scene headings', () => {
    const blocks = markdownToScreenplayBlocks('EXT. PARK - NIGHT');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'scene-heading', text: 'EXT. PARK - NIGHT' });
  });

  it('parses forced scene headings with dot prefix', () => {
    const blocks = markdownToScreenplayBlocks('.CUSTOM HEADING');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'scene-heading', text: 'CUSTOM HEADING' });
  });

  it('does not treat double dots as scene heading', () => {
    const blocks = markdownToScreenplayBlocks('..not a heading');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('action');
  });

  it('parses TO: transitions', () => {
    const blocks = markdownToScreenplayBlocks('CUT TO:');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'transition', text: 'CUT TO:' });
  });

  it('parses DISSOLVE TO: transitions', () => {
    const blocks = markdownToScreenplayBlocks('DISSOLVE TO:');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'transition', text: 'DISSOLVE TO:' });
  });

  it('parses forced transitions with > prefix', () => {
    const blocks = markdownToScreenplayBlocks('>FADE OUT.');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'transition', text: 'FADE OUT.' });
  });

  it('does not treat blockquote ("> ") as transition', () => {
    // "> text" with a space is a blockquote in markdown, not a Fountain transition
    const blocks = markdownToScreenplayBlocks('> some quote');
    expect(blocks).toHaveLength(1);
    // This should NOT be a transition (the code checks !trimmed.startsWith('> '))
    expect(blocks[0].type).not.toBe('transition');
  });

  it('parses parentheticals', () => {
    const blocks = markdownToScreenplayBlocks('(whispering)');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'parenthetical', text: '(whispering)' });
  });

  it('parses forced character with @ prefix', () => {
    const blocks = markdownToScreenplayBlocks('@McAVOY');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'character', text: 'McAVOY' });
  });

  it('parses all-caps character after blank line', () => {
    const blocks = markdownToScreenplayBlocks('\nJOHN');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'character', text: 'JOHN' });
  });

  it('parses character with parenthetical extension', () => {
    const blocks = markdownToScreenplayBlocks('\nJOHN (V.O.)');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'character', text: 'JOHN (V.O.)' });
  });

  it('parses dialogue after character', () => {
    const blocks = markdownToScreenplayBlocks('\nJOHN\nHello, how are you?');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'character', text: 'JOHN' });
    expect(blocks[1]).toMatchObject({ type: 'dialogue', text: 'Hello, how are you?' });
  });

  it('parses dialogue after parenthetical', () => {
    const blocks = markdownToScreenplayBlocks('\nJOHN\n(quietly)\nI am fine.');
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('character');
    expect(blocks[1].type).toBe('parenthetical');
    expect(blocks[2]).toMatchObject({ type: 'dialogue', text: 'I am fine.' });
  });

  it('defaults to action for unrecognized lines', () => {
    const blocks = markdownToScreenplayBlocks('The door creaks open.');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'action', text: 'The door creaks open.' });
  });

  it('skips blank lines', () => {
    const blocks = markdownToScreenplayBlocks('\n\nINT. ROOM - DAY\n\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('scene-heading');
  });

  it('handles a full Fountain scene', () => {
    const fountain = [
      'INT. KITCHEN - MORNING',
      '',
      'SARAH',
      '(smiling)',
      'Good morning!',
      '',
      'The sun streams through the window.',
      '',
      'CUT TO:',
    ].join('\n');

    const blocks = markdownToScreenplayBlocks(fountain);
    expect(blocks.map(b => b.type)).toEqual([
      'scene-heading',
      'character',
      'parenthetical',
      'dialogue',
      'action',
      'transition',
    ]);
  });
});

// ── extractDialogueBySpeaker ─────────────────────────────

describe('extractDialogueBySpeaker', () => {
  it('returns empty object for null', () => {
    expect(extractDialogueBySpeaker(null)).toEqual({});
  });

  it('returns empty object for empty string', () => {
    expect(extractDialogueBySpeaker('')).toEqual({});
  });

  it('extracts dialogue from Fountain format', () => {
    const content = [
      '',
      'ALICE',
      'Hello there.',
      '',
      'BOB',
      'Hi Alice!',
    ].join('\n');

    const result = extractDialogueBySpeaker(content);
    expect(result['ALICE']).toEqual(['Hello there.']);
    expect(result['BOB']).toEqual(['Hi Alice!']);
  });

  it('groups multiple dialogue lines per speaker', () => {
    const content = [
      '',
      'ALICE',
      'First line.',
      '',
      'BOB',
      'Response.',
      '',
      'ALICE',
      'Second line.',
    ].join('\n');

    const result = extractDialogueBySpeaker(content);
    expect(result['ALICE']).toEqual(['First line.', 'Second line.']);
    expect(result['BOB']).toEqual(['Response.']);
  });

  it('strips parenthetical extensions from character names', () => {
    const content = [
      '',
      'ALICE (V.O.)',
      'Narrating from afar.',
    ].join('\n');

    const result = extractDialogueBySpeaker(content);
    expect(result['ALICE']).toEqual(['Narrating from afar.']);
  });

  it('preserves parentheticals without breaking speaker tracking', () => {
    const content = [
      '',
      'ALICE',
      '(softly)',
      'Whispered words.',
    ].join('\n');

    const result = extractDialogueBySpeaker(content);
    expect(result['ALICE']).toEqual(['Whispered words.']);
  });

  it('resets speaker on non-dialogue non-parenthetical blocks', () => {
    const content = [
      '',
      'ALICE',
      'Hello.',
      '',
      'She walks away.',
      'This is not dialogue.',
    ].join('\n');

    const result = extractDialogueBySpeaker(content);
    expect(result['ALICE']).toEqual(['Hello.']);
  });

  it('extracts from "SPEAKER: text" prose format', () => {
    const content = 'JOHN: I have something to say.\nMARY: Tell me about it.';
    const result = extractDialogueBySpeaker(content);
    expect(result['JOHN']).toContain('I have something to say.');
    expect(result['MARY']).toContain('Tell me about it.');
  });

  it('combines Fountain and prose dialogue for the same speaker', () => {
    const content = [
      '',
      'ALICE',
      'Fountain dialogue.',
      '',
      'ALICE: Prose dialogue.',
    ].join('\n');

    const result = extractDialogueBySpeaker(content);
    expect(result['ALICE']).toContain('Fountain dialogue.');
    expect(result['ALICE']).toContain('Prose dialogue.');
  });
});
