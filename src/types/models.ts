import type { JSONContent } from '@tiptap/core';
import type { IntegrationType } from './integrations';

export type ProjectType = 'book' | 'screenplay';

export type ScreenplayBlockType = 'scene-heading' | 'action' | 'character' | 'parenthetical' | 'dialogue' | 'transition';

export type ChapterStatus = 'planned' | 'draft' | 'revised' | 'final';

/** Runtime-accessible status values for validation and UI rendering. */
export const CHAPTER_STATUSES: ChapterStatus[] = ['planned', 'draft', 'revised', 'final'];

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
  part?: string;
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
  label?: string;
}
