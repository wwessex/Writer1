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

export interface GoalMilestone {
  id: string;
  label: string;
  targetWords: number;
  targetDate: string;
}

export interface GoalConfiguration {
  dailyWordTarget: number;
  weeklyWordTarget: number;
  draftCompletionDeadline: string;
  milestoneCheckpoints: GoalMilestone[];
}

export interface AppSettings {
  autosaveMs: number;
  dailyWordGoal: number;
  novelWordGoal: number;
  novelDeadline: string;
  sync: SyncConfig;
  assist: AssistConfig;
  theme: 'dark' | 'light' | 'high-contrast';
  sidebarHidden: boolean;
  pageView: boolean;
  focusMode: boolean;
  quickSwitcherMode: 'all' | 'chapter' | 'action' | 'search-result';
  typography: TypographySettings;
  onboardingComplete: boolean;
  typewriterMode: boolean;
  releaseChannel: 'stable' | 'beta' | 'nightly';
  sidebarPanels: SidebarPanelsSettings;
  goalConfiguration: GoalConfiguration;
}
