import { describe, expect, it } from 'vitest';
import {
  extractTextFromNode,
  isSceneBreakLine,
  inchesToTwips,
  ptToHalfPt,
  lineSpacingTo240ths,
  SCREENPLAY_PDF_FONTS,
} from './shared';

describe('extractTextFromNode', () => {
  it('returns empty string for null', () => {
    expect(extractTextFromNode(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(extractTextFromNode(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(extractTextFromNode('')).toBe('');
  });

  it('returns plain text from simple string', () => {
    expect(extractTextFromNode('Hello world')).toBe('Hello world');
  });

  it('strips bold markdown', () => {
    expect(extractTextFromNode('Some **bold** text')).toBe('Some bold text');
  });

  it('strips italic markdown', () => {
    expect(extractTextFromNode('Some *italic* text')).toBe('Some italic text');
  });

  it('strips heading markers', () => {
    expect(extractTextFromNode('## Chapter One')).toBe('Chapter One');
  });

  it('strips links but keeps text', () => {
    expect(extractTextFromNode('[click here](https://example.com)')).toBe('click here');
  });

  it('strips inline code', () => {
    expect(extractTextFromNode('Use `console.log` here')).toBe('Use console.log here');
  });

  it('strips blockquote markers', () => {
    expect(extractTextFromNode('> A quoted line')).toBe('A quoted line');
  });
});

describe('isSceneBreakLine', () => {
  it('matches three asterisks', () => {
    expect(isSceneBreakLine('***')).toBe(true);
  });

  it('matches spaced asterisks', () => {
    expect(isSceneBreakLine('* * *')).toBe(true);
  });

  it('matches three dashes', () => {
    expect(isSceneBreakLine('---')).toBe(true);
  });

  it('matches spaced dashes', () => {
    expect(isSceneBreakLine('- - -')).toBe(true);
  });

  it('matches three hashes', () => {
    expect(isSceneBreakLine('###')).toBe(true);
  });

  it('matches spaced hashes', () => {
    expect(isSceneBreakLine('# # #')).toBe(true);
  });

  it('matches three tildes', () => {
    expect(isSceneBreakLine('~~~')).toBe(true);
  });

  it('matches spaced tildes', () => {
    expect(isSceneBreakLine('~ ~ ~')).toBe(true);
  });

  it('matches lone hash', () => {
    expect(isSceneBreakLine('#')).toBe(true);
  });

  it('matches with surrounding whitespace', () => {
    expect(isSceneBreakLine('  ***  ')).toBe(true);
  });

  it('rejects regular text', () => {
    expect(isSceneBreakLine('Hello world')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSceneBreakLine('')).toBe(false);
  });

  it('rejects single asterisk', () => {
    expect(isSceneBreakLine('*')).toBe(false);
  });

  it('rejects two asterisks', () => {
    expect(isSceneBreakLine('**')).toBe(false);
  });
});

describe('inchesToTwips', () => {
  it('converts 1 inch to 1440 twips', () => {
    expect(inchesToTwips(1)).toBe(1440);
  });

  it('converts 0 inches to 0 twips', () => {
    expect(inchesToTwips(0)).toBe(0);
  });

  it('converts 0.5 inches to 720 twips', () => {
    expect(inchesToTwips(0.5)).toBe(720);
  });

  it('converts 2.5 inches to 3600 twips', () => {
    expect(inchesToTwips(2.5)).toBe(3600);
  });

  it('rounds the result', () => {
    expect(inchesToTwips(1.0001)).toBe(Math.round(1.0001 * 1440));
  });
});

describe('ptToHalfPt', () => {
  it('converts 12pt to 24 half-points', () => {
    expect(ptToHalfPt(12)).toBe(24);
  });

  it('converts 0pt to 0', () => {
    expect(ptToHalfPt(0)).toBe(0);
  });

  it('converts 6.5pt to 13 half-points', () => {
    expect(ptToHalfPt(6.5)).toBe(13);
  });
});

describe('lineSpacingTo240ths', () => {
  it('converts single spacing (1) to 240', () => {
    expect(lineSpacingTo240ths(1)).toBe(240);
  });

  it('converts double spacing (2) to 480', () => {
    expect(lineSpacingTo240ths(2)).toBe(480);
  });

  it('converts 0 to 0', () => {
    expect(lineSpacingTo240ths(0)).toBe(0);
  });

  it('converts 1.5 spacing to 360', () => {
    expect(lineSpacingTo240ths(1.5)).toBe(360);
  });

  it('rounds the result', () => {
    expect(lineSpacingTo240ths(1.333)).toBe(Math.round(1.333 * 240));
  });
});

describe('SCREENPLAY_PDF_FONTS', () => {
  it('contains Helvetica font family', () => {
    expect(SCREENPLAY_PDF_FONTS.Helvetica).toEqual({
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    });
  });

  it('contains Courier font family', () => {
    expect(SCREENPLAY_PDF_FONTS.Courier).toEqual({
      normal: 'Courier',
      bold: 'Courier-Bold',
      italics: 'Courier-Oblique',
      bolditalics: 'Courier-BoldOblique',
    });
  });
});
