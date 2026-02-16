import type { JSONContent } from '@tiptap/core';

export type ProjectType = 'book' | 'screenplay';

export type ScreenplayBlockType = 'scene-heading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition';

export type ChapterStatus = 'planned' | 'draft' | 'revised' | 'final';

export interface Scene {
  id: string;
  title: string;
  summary: string;
  pov: string;
  status: ChapterStatus;
  tags: string[];
  wordGoal: number;
  slugLine?: string;
  location?: string;
  interiorExterior?: 'INT' | 'EXT' | 'INT/EXT';
  timeOfDay?: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';
  pageEstimate?: number;
  productionTags?: string[];
}

export type ScreenplayElementType = 'slugLine' | 'action' | 'characterCue' | 'parenthetical' | 'dialogue';

export interface ScreenplayElement {
  id: string;
  type: ScreenplayElementType;
  text: string;
}

export interface ScreenplayScene {
  id: string;
  title: string;
  summary: string;
  order: number;
  elements: ScreenplayElement[];
}

export interface ScreenplaySection {
  id: string;
  novelId: string;
  order: number;
  title: string;
  updatedAt: number;
  content: JSONContent | null;
  summary: string;
  scenes: ScreenplayScene[];
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
  act?: number;
  sequence?: number;
  sync?: ChapterSyncMetadata;
}

export interface ChapterSyncMetadata {
  providerRevisionIds: Partial<Record<IntegrationType, string>>;
  lastPushedHash?: string;
  lastPulledAt?: number;
  lastSyncedContent?: JSONContent | null;
}

export interface Novel {
  id: string;
  title: string;
  projectType?: ProjectType;
  updatedAt: number;
}

export type Project = Novel;
export type Section = Chapter;

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

export type SidebarPanelId = 'chapters' | 'scenePlanner' | 'outline';

export interface SidebarPanelsSettings {
  order?: SidebarPanelId[];
  collapsed?: Partial<Record<SidebarPanelId, boolean>>;
  visible?: Partial<Record<SidebarPanelId, boolean>>;
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
  quickSwitcherMode: 'chapter' | 'action' | 'search-result';
  typography: TypographySettings;
  onboardingComplete: boolean;
  sidebarPanels: SidebarPanelsSettings;
}

export interface AppState {
  projectType: ProjectType;
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

export type ExportFormat = 'docx' | 'pdf' | 'screenplayPdf' | 'rtf' | 'fountain';

export interface LegacyBackupData {
  version?: 1 | 2;
  novel: Novel;
  chapters: Chapter[];
  snapshots?: Snapshot[];
  exportedAt: number;
}

export interface BackupDataV3 {
  version: 3;
  projectType: ProjectType;
  project: Project;
  sections: Section[];
  snapshots?: Snapshot[];
  commentThreads?: CommentThread[];
  exportedAt: number;
}

export type BackupData = LegacyBackupData | BackupDataV3;

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
export interface CommentAnchorRange {
  from: number;
  to: number;
  length: number;
  selectedText?: string;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  createdAt: number;
}

export interface CommentReply {
  id: string;
  text: string;
  author: string;
  createdAt: number;
}

export interface CommentThread {
  id: string;
  chapterId: string;
  anchor: CommentAnchorRange;
  resolved: boolean;
  createdAt: number;
  updatedAt: number;
  comments: Comment[];
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
  baseContent?: JSONContent | null;
  mergedContent?: JSONContent | null;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  resolutionOptions: ConflictResolutionOption[];
}

export type ConflictResolutionOption = 'local' | 'remote' | 'merge';

// Integration types
export type IntegrationType = 'dropbox' | 'google-drive' | 'scrivener';

export interface IntegrationConfig {
  type: IntegrationType;
  enabled: boolean;
  connectionId?: string;
  providerUserId?: string;
  scopes?: string[];
  expiresAt?: number;
  status?: 'disconnected' | 'pending' | 'connected' | 'error';
  folderId?: string;
  lastSyncAt?: number;
}
