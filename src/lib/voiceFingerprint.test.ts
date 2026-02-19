import { describe, expect, it } from 'vitest';
import type { Chapter, CharacterEntity } from '@/types';
import {
  buildCharacterVoiceProfiles,
  computeFingerprint,
  getDialogueSimilarityAlerts,
  similarityScore,
} from './voiceFingerprint';

function screenplayChapter(id: string, contentRows: Array<{ type: 'character' | 'dialogue'; text: string }>): Chapter {
  return {
    id,
    novelId: 'novel-1',
    order: 1,
    title: id,
    updatedAt: 0,
    content: {
      type: 'doc',
      content: contentRows.map(row => ({
        type: 'paragraph',
        attrs: { screenplayType: row.type },
        content: [{ type: 'text', text: row.text }],
      })),
    },
    summary: '',
    pov: '',
    status: 'draft',
    tags: [],
    wordGoal: 0,
    scenes: [],
  };
}

const characters: CharacterEntity[] = [
  {
    id: 'char-1',
    novelId: 'novel-1',
    name: 'ALICE',
    aliases: [],
    description: '',
    role: 'protagonist',
    traits: [],
    notes: '',
    relationships: [],
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'char-2',
    novelId: 'novel-1',
    name: 'BOB',
    aliases: [],
    description: '',
    role: 'supporting',
    traits: [],
    notes: '',
    relationships: [],
    createdAt: 0,
    updatedAt: 0,
  },
];

describe('voice fingerprints', () => {
  it('creates stable fingerprints for unchanged text', () => {
    const lines = ['We move quickly now. Keep up, keep up!'];
    const a = computeFingerprint('ALICE', lines);
    const b = computeFingerprint('ALICE', lines);
    expect(a.features).toEqual(b.features);
    expect(similarityScore(a, b)).toBeCloseTo(1, 5);
  });

  it('triggers similarity alerts only above configured threshold', () => {
    const baselineChapter = screenplayChapter('baseline', [
      { type: 'character', text: 'BOB' },
      { type: 'dialogue', text: 'We should move now, right now, right now. Keep moving fast! Keep moving fast!' },
      { type: 'dialogue', text: 'No pauses, no delays. We move now!' },
    ]);

    const profiles = buildCharacterVoiceProfiles([baselineChapter], characters);

    const activeCloseMatch = screenplayChapter('active', [
      { type: 'character', text: 'ALICE' },
      { type: 'dialogue', text: 'We should move now, right now, right now. Keep moving fast! Keep moving fast!' },
      { type: 'dialogue', text: 'No pauses, no delays. We move now!' },
    ]);

    const activeDifferent = screenplayChapter('active-2', [
      { type: 'character', text: 'ALICE' },
      { type: 'dialogue', text: 'I will stay and think quietly about this plan.' },
      { type: 'dialogue', text: 'Maybe tomorrow we can revisit it in calm detail.' },
    ]);

    const warningAlerts = getDialogueSimilarityAlerts(activeCloseMatch.content, profiles, {
      similarityThreshold: 0.65,
      minSampleTokens: 10,
    });
    const noAlerts = getDialogueSimilarityAlerts(activeDifferent.content, profiles, {
      similarityThreshold: 0.95,
      minSampleTokens: 10,
    });

    expect(warningAlerts.some(alert => alert.comparedSpeaker === 'BOB')).toBe(true);
    expect(noAlerts).toHaveLength(0);
  });

  it('suppresses warnings for low dialogue sample sizes', () => {
    const baselineChapter = screenplayChapter('baseline', [
      { type: 'character', text: 'BOB' },
      { type: 'dialogue', text: 'Keep moving now keep moving now keep moving now keep moving now.' },
    ]);

    const profiles = buildCharacterVoiceProfiles([baselineChapter], characters);

    const tinySample = screenplayChapter('active', [
      { type: 'character', text: 'ALICE' },
      { type: 'dialogue', text: 'Keep moving now.' },
    ]);

    const alerts = getDialogueSimilarityAlerts(tinySample.content, profiles, {
      similarityThreshold: 0.4,
      minSampleTokens: 20,
    });

    expect(alerts).toHaveLength(0);
  });
});
