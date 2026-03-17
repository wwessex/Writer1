/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { detectBlockType, maybeUppercase, getEnterFlow, getNextBlockType, fountainDecoPlugin, fountainKeymap } from './fountainExtension';

describe('detectBlockType', () => {
  describe('empty/whitespace lines', () => {
    it('returns action for empty string', () => {
      expect(detectBlockType('', '')).toBe('action');
    });

    it('returns action for whitespace-only line', () => {
      expect(detectBlockType('   ', '')).toBe('action');
    });
  });

  describe('scene-heading detection', () => {
    it('detects INT. prefix as scene-heading', () => {
      expect(detectBlockType('INT. HOUSE - DAY', '')).toBe('scene-heading');
    });

    it('detects EXT. prefix as scene-heading', () => {
      expect(detectBlockType('EXT. PARK - NIGHT', '')).toBe('scene-heading');
    });

    it('detects EST. prefix as scene-heading', () => {
      expect(detectBlockType('EST. CITY SKYLINE - DUSK', '')).toBe('scene-heading');
    });

    it('detects I/E prefix as scene-heading', () => {
      expect(detectBlockType('I/E. CAR - DAY', '')).toBe('scene-heading');
    });

    it('detects case-insensitive INT prefix', () => {
      expect(detectBlockType('int. office - morning', '')).toBe('scene-heading');
    });

    it('detects forced scene-heading with leading dot', () => {
      expect(detectBlockType('.FLASHBACK', '')).toBe('scene-heading');
    });

    it('does not treat double dots as scene-heading', () => {
      expect(detectBlockType('..some text', '')).toBe('action');
    });

    it('does not treat lone dot as scene-heading', () => {
      expect(detectBlockType('.', '')).toBe('action');
    });
  });

  describe('transition detection', () => {
    it('detects > prefix as transition', () => {
      expect(detectBlockType('>FADE OUT', '')).toBe('transition');
    });

    it('does not treat > followed by space as transition', () => {
      expect(detectBlockType('> centered text', '')).toBe('action');
    });

    it('detects ALL CAPS TO: pattern as transition', () => {
      expect(detectBlockType('CUT TO:', '')).toBe('transition');
    });

    it('detects SMASH CUT TO: as transition', () => {
      expect(detectBlockType('SMASH CUT TO:', '')).toBe('transition');
    });

    it('detects FADE TO: as transition', () => {
      expect(detectBlockType('FADE TO:', '')).toBe('transition');
    });
  });

  describe('parenthetical detection', () => {
    it('detects text wrapped in parentheses as parenthetical', () => {
      expect(detectBlockType('(softly)', '')).toBe('parenthetical');
    });

    it('detects multi-word parenthetical', () => {
      expect(detectBlockType('(under her breath)', '')).toBe('parenthetical');
    });

    it('does not detect unmatched opening paren as parenthetical', () => {
      expect(detectBlockType('(not closed', '')).toBe('action');
    });
  });

  describe('character detection', () => {
    it('detects @ prefix as character', () => {
      expect(detectBlockType('@McCOY', '')).toBe('character');
    });

    it('detects ALL CAPS after blank prevLine as character', () => {
      expect(detectBlockType('JOHN', '')).toBe('character');
    });

    it('detects character name with parenthetical extension', () => {
      expect(detectBlockType('SARAH (V.O.)', '')).toBe('character');
    });

    it('does not detect ALL CAPS as character if prevLine is non-blank', () => {
      expect(detectBlockType('JOHN', 'some previous text')).toBe('action');
    });

    it('does not detect single character as character name', () => {
      // Line must be longer than 1 character
      expect(detectBlockType('A', '')).toBe('action');
    });
  });

  describe('default action', () => {
    it('returns action for regular prose text', () => {
      expect(detectBlockType('He walked across the room.', 'some prev')).toBe('action');
    });

    it('returns action for lowercase text after blank line', () => {
      expect(detectBlockType('he whispered softly', '')).toBe('action');
    });
  });
});

describe('maybeUppercase', () => {
  describe('types that uppercase text', () => {
    it('uppercases text for scene-heading type', () => {
      expect(maybeUppercase('scene-heading', 'int. house - day')).toBe('INT. HOUSE - DAY');
    });

    it('uppercases text for character type', () => {
      expect(maybeUppercase('character', 'john')).toBe('JOHN');
    });

    it('uppercases text for transition type', () => {
      expect(maybeUppercase('transition', 'cut to:')).toBe('CUT TO:');
    });
  });

  describe('types that preserve text unchanged', () => {
    it('returns text unchanged for action type', () => {
      expect(maybeUppercase('action', 'He walked away.')).toBe('He walked away.');
    });

    it('returns text unchanged for dialogue type', () => {
      expect(maybeUppercase('dialogue', 'Hello there.')).toBe('Hello there.');
    });

    it('returns text unchanged for parenthetical type', () => {
      expect(maybeUppercase('parenthetical', '(whispering)')).toBe('(whispering)');
    });
  });
});

describe('getEnterFlow', () => {
  it('scene-heading → action', () => expect(getEnterFlow('scene-heading')).toBe('action'));
  it('character → dialogue', () => expect(getEnterFlow('character')).toBe('dialogue'));
  it('parenthetical → dialogue', () => expect(getEnterFlow('parenthetical')).toBe('dialogue'));
  it('dialogue → character', () => expect(getEnterFlow('dialogue')).toBe('character'));
  it('transition → scene-heading', () => expect(getEnterFlow('transition')).toBe('scene-heading'));
  it('action → action', () => expect(getEnterFlow('action')).toBe('action'));
});

describe('getNextBlockType', () => {
  it('cycles forward through block types', () => {
    expect(getNextBlockType('scene-heading')).toBe('action');
    expect(getNextBlockType('action')).toBe('character');
    expect(getNextBlockType('character')).toBe('parenthetical');
    expect(getNextBlockType('parenthetical')).toBe('dialogue');
    expect(getNextBlockType('dialogue')).toBe('transition');
    expect(getNextBlockType('transition')).toBe('scene-heading');
  });

  it('cycles backward with reverse=true', () => {
    expect(getNextBlockType('scene-heading', true)).toBe('transition');
    expect(getNextBlockType('action', true)).toBe('scene-heading');
  });
});

describe('fountainDecoPlugin', () => {
  it('creates decorations for Fountain content', () => {
    const container = document.createElement('div');
    const state = EditorState.create({
      doc: 'INT. OFFICE - DAY\n\n@JOHN\nHello there.\n\nCUT TO:',
      extensions: [fountainDecoPlugin],
    });
    const view = new EditorView({ state, parent: container });
    // Plugin should have created decorations without error
    expect(view.state.doc.toString()).toContain('INT. OFFICE');
    view.destroy();
  });
});

describe('fountainKeymap', () => {
  it('is a valid keymap extension', () => {
    expect(fountainKeymap).toBeDefined();
    // Can be included as an extension without error
    const container = document.createElement('div');
    const state = EditorState.create({
      doc: 'Some action',
      extensions: [fountainKeymap],
    });
    const view = new EditorView({ state, parent: container });
    expect(view.state.doc.toString()).toBe('Some action');
    view.destroy();
  });
});
