import { describe, expect, it } from 'vitest';
import {
  countWords,
  countSentences,
  calculateFleschScore,
  findRepetitions,
  findLongSentences,
  analyzeText,
  editorToPlainText,
  formatRelativeTime,
  clamp,
  generateId,
} from './utils';

describe('countWords', () => {
  it('counts words in a simple sentence', () => {
    expect(countWords('Hello world')).toBe(2);
  });

  it('returns 0 for empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('returns 0 for whitespace-only string', () => {
    expect(countWords('   \t\n  ')).toBe(0);
  });

  it('handles multiple spaces between words', () => {
    expect(countWords('one   two   three')).toBe(3);
  });

  it('handles newlines as word separators', () => {
    expect(countWords('one\ntwo\nthree')).toBe(3);
  });
});

describe('countSentences', () => {
  it('counts sentences by terminal punctuation', () => {
    expect(countSentences('Hello. World! How?')).toBe(3);
  });

  it('returns 0 for text with no sentence endings', () => {
    expect(countSentences('no punctuation here')).toBe(0);
  });

  it('handles ellipsis as one sentence ending', () => {
    expect(countSentences('Wait... really?')).toBe(2);
  });
});

describe('calculateFleschScore', () => {
  it('returns 0 for empty text', () => {
    expect(calculateFleschScore('')).toBe(0);
  });

  it('returns a score between 0 and 100 for normal text', () => {
    const score = calculateFleschScore(
      'The cat sat on the mat. It was a good day. The sun was shining brightly.'
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('gives higher scores for simpler text', () => {
    const simpleScore = calculateFleschScore('The dog ran. The cat sat. It was fun.');
    const complexScore = calculateFleschScore(
      'The implementation of sophisticated algorithmic approaches necessitates comprehensive methodological consideration.'
    );
    expect(simpleScore).toBeGreaterThan(complexScore);
  });
});

describe('findRepetitions', () => {
  it('finds repeated words above threshold', () => {
    const text = 'word word word word castle castle castle';
    const reps = findRepetitions(text, 3);
    expect(reps.get('word')).toBe(4);
    expect(reps.get('castle')).toBe(3);
  });

  it('excludes stop words', () => {
    const text = 'the the the the the said said said said';
    const reps = findRepetitions(text, 3);
    expect(reps.has('the')).toBe(false);
    expect(reps.has('said')).toBe(false);
  });

  it('excludes short words under 4 characters', () => {
    const text = 'cat cat cat cat cat';
    const reps = findRepetitions(text, 3);
    expect(reps.has('cat')).toBe(false);
  });

  it('returns empty map for text with no repetitions', () => {
    const reps = findRepetitions('each word is unique here', 3);
    expect(reps.size).toBe(0);
  });
});

describe('findLongSentences', () => {
  it('returns sentences exceeding the word limit', () => {
    const longSentence = Array(35).fill('word').join(' ');
    const text = `Short sentence. ${longSentence}. Another short one.`;
    const result = findLongSentences(text, 30);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('word');
  });

  it('returns empty array when all sentences are short', () => {
    const text = 'Short. Also short. Very short too.';
    expect(findLongSentences(text, 30)).toHaveLength(0);
  });
});

describe('analyzeText', () => {
  it('returns all expected analysis fields', () => {
    const result = analyzeText('The cat sat on the mat. It was good.');
    expect(result).toHaveProperty('wordCount');
    expect(result).toHaveProperty('sentenceCount');
    expect(result).toHaveProperty('avgSentenceLength');
    expect(result).toHaveProperty('fleschScore');
    expect(result).toHaveProperty('repetitions');
    expect(result).toHaveProperty('longSentences');
    expect(result.wordCount).toBe(9);
    expect(result.sentenceCount).toBe(2);
  });

  it('returns zero averages for empty text', () => {
    const result = analyzeText('');
    expect(result.wordCount).toBe(0);
    expect(result.sentenceCount).toBe(0);
    expect(result.avgSentenceLength).toBe(0);
  });
});

describe('editorToPlainText', () => {
  it('extracts text from a simple Tiptap document', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second paragraph' }],
        },
      ],
    };
    expect(editorToPlainText(doc)).toBe('Hello world\nSecond paragraph');
  });

  it('returns empty string for null input', () => {
    expect(editorToPlainText(null)).toBe('');
  });

  it('returns empty string for doc with no content', () => {
    expect(editorToPlainText({ type: 'doc' })).toBe('');
  });

  it('handles empty paragraphs', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Text' }] },
      ],
    };
    expect(editorToPlainText(doc)).toBe('\nText');
  });
});

describe('formatRelativeTime', () => {
  it('returns "Just now" for recent timestamps', () => {
    expect(formatRelativeTime(Date.now() - 5000)).toBe('Just now');
  });

  it('returns minutes for timestamps a few minutes ago', () => {
    expect(formatRelativeTime(Date.now() - 5 * 60 * 1000)).toBe('5m ago');
  });

  it('returns hours for timestamps a few hours ago', () => {
    expect(formatRelativeTime(Date.now() - 3 * 60 * 60 * 1000)).toBe('3h ago');
  });

  it('returns days for timestamps a few days ago', () => {
    expect(formatRelativeTime(Date.now() - 3 * 24 * 60 * 60 * 1000)).toBe('3d ago');
  });

  it('returns a date string for timestamps older than 7 days', () => {
    const result = formatRelativeTime(Date.now() - 10 * 24 * 60 * 60 * 1000);
    // Should be a date string, not a relative time
    expect(result).not.toContain('ago');
  });
});

describe('clamp', () => {
  it('clamps a value below min to min', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it('clamps a value above max to max', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('returns the value when within range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('handles equal min and max', () => {
    expect(clamp(50, 10, 10)).toBe(10);
  });
});

describe('generateId', () => {
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
