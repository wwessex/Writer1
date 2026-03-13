import type { Chapter } from './models';
import type { ProjectType } from './models';
import type { AppSettings } from './settings';

export interface AppState {
  projectType: ProjectType;
  novelId: string;
  novelTitle: string;
  storyBlueprint: StoryBlueprint | null;
  chapters: Chapter[];
  activeChapterId: string | null;
  isOnline: boolean;
  isSaving: boolean;
  settings: AppSettings;
}

export type StoryStructurePreference = 'three-act' | 'save-the-cat' | 'hero-journey';

export type PacingProfile = 'fast' | 'balanced' | 'slow-burn';

export interface StoryBlueprint {
  genre: string;
  subgenre: string;
  targetAudience: string;
  ageBand: string;
  tone: string;
  voice: string;
  structure: StoryStructurePreference;
  targetWordCount: number;
  pacingProfile: PacingProfile;
}
