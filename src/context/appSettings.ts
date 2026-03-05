import type { AppSettings, ProjectType, SidebarPanelId, SidebarPanelsSettings } from '@/types';

export type SettingsUpdate = Partial<Omit<AppSettings, 'sync' | 'assist' | 'typography' | 'sidebarPanels' | 'goalConfiguration'>> & {
  sync?: Partial<AppSettings['sync']>;
  assist?: Partial<AppSettings['assist']>;
  typography?: Partial<AppSettings['typography']>;
  sidebarPanels?: Partial<AppSettings['sidebarPanels']> & {
    collapsed?: Partial<NonNullable<AppSettings['sidebarPanels']['collapsed']>>;
    visible?: Partial<NonNullable<AppSettings['sidebarPanels']['visible']>>;
  };
  goalConfiguration?: Partial<AppSettings['goalConfiguration']> & {
    milestoneCheckpoints?: AppSettings['goalConfiguration']['milestoneCheckpoints'];
  };
};

const BASE_SIDEBAR_PANEL_ORDER: SidebarPanelId[] = ['chapters', 'scenePlanner', 'outline'];

export const sidebarPanelsForProjectType = (projectType: ProjectType): SidebarPanelsSettings => ({
  order: projectType === 'screenplay'
    ? ['chapters', 'outline', 'scenePlanner']
    : [...BASE_SIDEBAR_PANEL_ORDER],
  collapsed: {
    chapters: false,
    scenePlanner: false,
    outline: false
  },
  visible: {
    chapters: true,
    scenePlanner: true,
    outline: true
  }
});

export const normalizeSidebarPanels = (
  rawPanels: SidebarPanelsSettings | undefined,
  projectType: ProjectType
): SidebarPanelsSettings => {
  const defaults = sidebarPanelsForProjectType(projectType);
  const rawOrder = rawPanels?.order || [];
  const dedupedKnown = rawOrder.filter((id, index): id is SidebarPanelId =>
    BASE_SIDEBAR_PANEL_ORDER.includes(id) && rawOrder.indexOf(id) === index
  );
  const missing = BASE_SIDEBAR_PANEL_ORDER.filter(id => !dedupedKnown.includes(id));

  return {
    order: [...dedupedKnown, ...missing],
    collapsed: {
      ...defaults.collapsed,
      ...rawPanels?.collapsed
    },
    visible: {
      ...defaults.visible,
      ...rawPanels?.visible
    }
  };
};

export const createDefaultSettings = (isMobile: boolean): AppSettings => ({
  autosaveMs: 800,
  dailyWordGoal: 0,
  novelWordGoal: 0,
  novelDeadline: '',
  sync: {
    novelId: '',
    url: '',
    auth: ''
  },
  assist: {
    languageToolEnabled: false,
    languageToolUrl: 'https://api.languagetool.org/v2/check',
    languageToolLanguage: 'en-US'
  },
  theme: 'light',
  sidebarHidden: isMobile,
  pageView: true,
  focusMode: false,
  quickSwitcherMode: 'all',
  typography: {
    fontFamily: 'system',
    fontSize: 16,
    lineHeight: 1.75
  },
  onboardingComplete: false,
  typewriterMode: false,
  releaseChannel: 'stable',
  sidebarPanels: {},
  goalConfiguration: {
    dailyWordTarget: 0,
    weeklyWordTarget: 0,
    draftCompletionDeadline: '',
    milestoneCheckpoints: []
  }
});

export const mergeSettings = (current: AppSettings, updates: SettingsUpdate): AppSettings => ({
  ...current,
  ...updates,
  sync: {
    ...current.sync,
    ...updates.sync
  },
  assist: {
    ...current.assist,
    ...updates.assist
  },
  typography: {
    ...current.typography,
    ...updates.typography
  },
  sidebarPanels: {
    ...current.sidebarPanels,
    ...updates.sidebarPanels,
    collapsed: {
      ...current.sidebarPanels.collapsed,
      ...updates.sidebarPanels?.collapsed
    },
    visible: {
      ...current.sidebarPanels.visible,
      ...updates.sidebarPanels?.visible
    }
  },
  goalConfiguration: {
    ...current.goalConfiguration,
    ...updates.goalConfiguration,
    milestoneCheckpoints: updates.goalConfiguration?.milestoneCheckpoints ?? current.goalConfiguration.milestoneCheckpoints
  }
});
