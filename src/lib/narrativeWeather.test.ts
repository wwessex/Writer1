import { describe, expect, it } from 'vitest';
import { buildNarrativeWeather, getDialogueDensity, getPacingIntensity, getSentimentProxyScore } from './narrativeWeather';
import type { Chapter } from '@/types';

function makeChapter(id: string, order: number, title: string, text: string): Chapter {
  return {
    id,
    novelId: 'novel-1',
    order,
    title,
    updatedAt: 0,
    content: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text }] },
      ],
    },
    summary: '',
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 0,
    scenes: [],
  };
}

describe('narrativeWeather scoring', () => {
  it('computes positive/negative sentiment proxy deterministically', () => {
    expect(getSentimentProxyScore('hope joy calm love')).toBe(100);
    expect(getSentimentProxyScore('fear grief dark hate')).toBe(-100);
    expect(getSentimentProxyScore('hope fear joy')).toBe(33);
  });

  it('raises pacing when punctuation spikes and variance rise', () => {
    const calm = getPacingIntensity('This is a short sentence. This one is calm.');
    const intense = getPacingIntensity('Run! Run now!!! Wait... no, move — move quickly before the storm finds us!');
    expect(intense).toBeGreaterThan(calm);
  });

  it('measures dialogue density from quoted text', () => {
    expect(getDialogueDensity('He walked home quietly.')).toBe(0);
    expect(getDialogueDensity('"Hello there" she said. "How are you"')).toBeGreaterThan(50);
  });
});

describe('buildNarrativeWeather', () => {
  it('builds sorted chapter points and aggregate climate bands', () => {
    const chapters = [
      makeChapter('b', 2, 'Second', '"Leave now" he said! fear storm pain.'),
      makeChapter('a', 1, 'First', 'hope joy calm love and warm light.'),
    ];

    const result = buildNarrativeWeather(chapters);

    expect(result.points.map(point => point.chapterId)).toEqual(['a', 'b']);
    expect(result.climateBands).toHaveLength(3);
    expect(result.climateBands.map(band => band.id)).toEqual(['sentiment', 'pacing', 'dialogue']);
    expect(result.points[0].sentimentProxy).toBeGreaterThan(result.points[1].sentimentProxy);
  });
});
