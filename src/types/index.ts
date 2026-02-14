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
