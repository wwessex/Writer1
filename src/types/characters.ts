export interface CharacterVoiceProfile {
  characterId: string;
  sampleCount: number;
  fingerprint: {
    speaker: string;
    utteranceCount: number;
    combinedText: string;
    features: {
      sampleTokens: number;
      sentenceCount: number;
      avgSentenceLength: number;
      uniqueTokenRatio: number;
      repeatedPhrases: Record<string, number>;
      punctuationPattern: Record<string, number>;
    };
  };
  updatedAt: number;
}

// Character and World Bible types
export interface CharacterEntity {
  id: string;
  novelId: string;
  name: string;
  aliases: string[];
  description: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor' | 'other';
  traits: string[];
  notes: string;
  relationships: { targetId: string; type: string }[];
  createdAt: number;
  updatedAt: number;
  voiceProfile?: CharacterVoiceProfile;
}

export interface WorldEntry {
  id: string;
  novelId: string;
  category: 'location' | 'lore' | 'item' | 'event' | 'organisation' | 'other';
  name: string;
  description: string;
  tags: string[];
  linkedCharacters: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}
