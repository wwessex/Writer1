import type { JSONContent } from '@tiptap/core';

export type ChapterStatus = 'planned' | 'draft' | 'revised' | 'final';

export interface Scene {
  id: string;
  title: string;
  summary: string;
  pov: string;
  status: ChapterStatus;
  tags: string[];
  wordGoal: number;
}

export interface Chapter {
  id: string;
  novelId: string;
  order: number;
  title: string;
  updatedAt: number;
  content: JSONContent | null;
  summary: string;
  pov: string;
  status: ChapterStatus;
  tags: string[];
  wordGoal: number;
  scenes: Scene[];
}

export interface Novel {
  id: string;
  title: string;
  updatedAt: number;
}

export interface Snapshot {
  id: string;
  chapterId: string;
  createdAt: number;
  doc: JSONContent;
}

export interface SyncConfig {
  novelId: string;
  url: string;
  auth: string;
}

export interface AssistConfig {
  languageToolEnabled: boolean;
  languageToolUrl: string;
  languageToolLanguage: string;
}

export interface TypographySettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

export interface AppSettings {
  autosaveMs: number;
  dailyWordGoal: number;
  novelWordGoal: number;
  sync: SyncConfig;
  assist: AssistConfig;
  theme: 'dark' | 'light' | 'high-contrast';
  sidebarHidden: boolean;
  pageView: boolean;
  focusMode: boolean;
  typography: TypographySettings;
  onboardingComplete: boolean;
}

export interface AppState {
  novelId: string;
  novelTitle: string;
  chapters: Chapter[];
  activeChapterId: string | null;
  isOnline: boolean;
  isSaving: boolean;
  settings: AppSettings;
}

export interface LanguageToolMatch {
  message: string;
  offset: number;
  length: number;
  replacements: { value: string }[];
  context: {
    text: string;
    offset: number;
    length: number;
  };
  rule: {
    id: string;
    description: string;
  };
}

export interface LanguageToolResponse {
  matches: LanguageToolMatch[];
}

export interface TextAnalysis {
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  fleschScore: number;
  repetitions: Map<string, number>;
  longSentences: string[];
}

export interface WindowPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DailyBaseline {
  date: string;
  words: number;
}

export type ExportFormat = 'docx' | 'pdf' | 'rtf';

export interface BackupData {
  version: number;
  novel: Novel;
  chapters: Chapter[];
  snapshots?: Snapshot[];
  exportedAt: number;
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
}

export interface WorldEntry {
  id: string;
  novelId: string;
  category: 'location' | 'lore' | 'item' | 'event' | 'organization' | 'other';
  name: string;
  description: string;
  tags: string[];
  linkedCharacters: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

// Comment types
export interface Comment {
  id: string;
  chapterId: string;
  anchorOffset: number;
  anchorLength: number;
  text: string;
  author: string;
  resolved: boolean;
  createdAt: number;
  updatedAt: number;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  text: string;
  author: string;
  createdAt: number;
}

// Advanced analytics types
export interface SentimentResult {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
}

export interface SentenceDistribution {
  range: string;
  count: number;
}

export interface AdvancedAnalytics {
  sentenceDistribution: SentenceDistribution[];
  paragraphLengths: number[];
  dialoguePercentage: number;
  avgParagraphLength: number;
  vocabularyRichness: number;
  sentimentByParagraph: SentimentResult[];
}

// Plugin API types
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  hooks: string[];
}

export interface PluginHook {
  event: string;
  handler: (...args: unknown[]) => void;
}

// Conflict resolution
export interface ConflictInfo {
  chapterId: string;
  localVersion: number;
  remoteVersion: number;
  localContent: JSONContent | null;
  remoteContent: JSONContent | null;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
}

// Integration types
export type IntegrationType = 'dropbox' | 'google-drive' | 'scrivener';

export interface IntegrationConfig {
  type: IntegrationType;
  enabled: boolean;
  accessToken?: string;
  folderId?: string;
  lastSyncAt?: number;
}
