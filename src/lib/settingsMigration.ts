import type { AppSettings, SidebarPanelId, SidebarPanelsSettings } from '@/types';
import { normalizeThemePreference } from '@/lib/appearance';

export const CURRENT_SETTINGS_VERSION = 2;

export interface PersistedSettingsEnvelope<TData> {
  version: number;
  data: TData;
}

interface MigrationResult {
  version: number;
  data: unknown;
}

const SIDEBAR_PANEL_IDS: SidebarPanelId[] = ['chapters', 'scenePlanner', 'outline'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJsonSafely = (raw: string): unknown | null => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const asString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const asDateString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;

const asPanelOrder = (value: unknown): SidebarPanelId[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const dedupedKnown = value.filter((panelId, index): panelId is SidebarPanelId =>
    SIDEBAR_PANEL_IDS.includes(panelId as SidebarPanelId) && value.indexOf(panelId) === index
  );

  return dedupedKnown.length > 0 ? dedupedKnown : undefined;
};

const asPanelFlags = (value: unknown): Partial<Record<SidebarPanelId, boolean>> | undefined => {
  if (!isRecord(value)) return undefined;

  const flags = SIDEBAR_PANEL_IDS.reduce<Partial<Record<SidebarPanelId, boolean>>>((acc, panelId) => {
    const rawValue = value[panelId];
    if (typeof rawValue === 'boolean') {
      acc[panelId] = rawValue;
    }
    return acc;
  }, {});

  return Object.keys(flags).length > 0 ? flags : undefined;
};


const sanitizeMilestones = (
  rawMilestones: unknown,
  defaults: AppSettings['goalConfiguration']['milestoneCheckpoints']
): AppSettings['goalConfiguration']['milestoneCheckpoints'] => {
  if (!Array.isArray(rawMilestones)) return defaults;

  return rawMilestones
    .filter(isRecord)
    .map((milestone, index) => ({
      id: asString(milestone.id, `milestone-${index + 1}`),
      label: asString(milestone.label, `Milestone ${index + 1}`),
      targetWords: asNumber(milestone.targetWords, 0),
      targetDate: asDateString(milestone.targetDate, '')
    }))
    .filter(milestone => milestone.targetWords > 0);
};

const sanitizeGoalConfiguration = (
  rawGoalConfiguration: unknown,
  defaults: AppSettings['goalConfiguration']
): AppSettings['goalConfiguration'] => {
  if (!isRecord(rawGoalConfiguration)) {
    return defaults;
  }

  return {
    dailyWordTarget: asNumber(rawGoalConfiguration.dailyWordTarget, defaults.dailyWordTarget),
    weeklyWordTarget: asNumber(rawGoalConfiguration.weeklyWordTarget, defaults.weeklyWordTarget),
    draftCompletionDeadline: asDateString(rawGoalConfiguration.draftCompletionDeadline, defaults.draftCompletionDeadline),
    milestoneCheckpoints: sanitizeMilestones(rawGoalConfiguration.milestoneCheckpoints, defaults.milestoneCheckpoints)
  };
};

const sanitizeSidebarPanels = (
  rawPanels: unknown,
  defaults: AppSettings['sidebarPanels']
): SidebarPanelsSettings => {
  if (!isRecord(rawPanels)) {
    return defaults;
  }

  return {
    order: asPanelOrder(rawPanels.order) ?? defaults.order,
    collapsed: asPanelFlags(rawPanels.collapsed) ?? defaults.collapsed,
    visible: asPanelFlags(rawPanels.visible) ?? defaults.visible
  };
};

const sanitizeSettings = (rawSettings: unknown, defaults: AppSettings): AppSettings => {
  if (!isRecord(rawSettings)) {
    return defaults;
  }

  const sync = isRecord(rawSettings.sync) ? rawSettings.sync : {};
  const assist = isRecord(rawSettings.assist) ? rawSettings.assist : {};
  const typography = isRecord(rawSettings.typography) ? rawSettings.typography : {};

  return {
    ...defaults,
    autosaveMs: asNumber(rawSettings.autosaveMs, defaults.autosaveMs),
    dailyWordGoal: asNumber(rawSettings.dailyWordGoal, defaults.dailyWordGoal),
    novelWordGoal: asNumber(rawSettings.novelWordGoal, defaults.novelWordGoal),
    novelDeadline: asDateString(rawSettings.novelDeadline, defaults.novelDeadline),
    sync: {
      novelId: asString(sync.novelId, defaults.sync.novelId),
      url: asString(sync.url, defaults.sync.url),
      auth: asString(sync.auth, defaults.sync.auth)
    },
    assist: {
      languageToolEnabled: asBoolean(assist.languageToolEnabled, defaults.assist.languageToolEnabled),
      languageToolUrl: asString(assist.languageToolUrl, defaults.assist.languageToolUrl),
      languageToolLanguage: asString(assist.languageToolLanguage, defaults.assist.languageToolLanguage)
    },
    theme: normalizeThemePreference(rawSettings.theme, defaults.theme),
    sidebarHidden: asBoolean(rawSettings.sidebarHidden, defaults.sidebarHidden),
    pageView: asBoolean(rawSettings.pageView, defaults.pageView),
    focusMode: asBoolean(rawSettings.focusMode, defaults.focusMode),
    quickSwitcherMode: rawSettings.quickSwitcherMode === 'all'
      || rawSettings.quickSwitcherMode === 'chapter'
      || rawSettings.quickSwitcherMode === 'action'
      || rawSettings.quickSwitcherMode === 'search-result'
      ? rawSettings.quickSwitcherMode
      : defaults.quickSwitcherMode,
    typography: {
      fontFamily: asString(typography.fontFamily, defaults.typography.fontFamily),
      fontSize: asNumber(typography.fontSize, defaults.typography.fontSize),
      lineHeight: asNumber(typography.lineHeight, defaults.typography.lineHeight)
    },
    onboardingComplete: asBoolean(rawSettings.onboardingComplete, defaults.onboardingComplete),
    typewriterMode: asBoolean(rawSettings.typewriterMode, defaults.typewriterMode),
    releaseChannel: rawSettings.releaseChannel === 'stable' || rawSettings.releaseChannel === 'beta' || rawSettings.releaseChannel === 'nightly'
      ? rawSettings.releaseChannel
      : defaults.releaseChannel,
    sidebarPanels: sanitizeSidebarPanels(rawSettings.sidebarPanels, defaults.sidebarPanels),
    goalConfiguration: sanitizeGoalConfiguration(rawSettings.goalConfiguration, defaults.goalConfiguration)
  };
};

const migrateV1ToV2 = (data: unknown): MigrationResult => ({
  version: 2,
  data
});

const runMigrations = (parsed: unknown): MigrationResult | null => {
  if (!isRecord(parsed)) {
    return null;
  }

  let version = 1;
  let data: unknown = parsed;

  if (typeof parsed.version === 'number') {
    if (!('data' in parsed)) {
      return null;
    }

    if (parsed.version > CURRENT_SETTINGS_VERSION || parsed.version < 1) {
      return null;
    }

    version = parsed.version;
    data = parsed.data;
  }

  while (version < CURRENT_SETTINGS_VERSION) {
    if (version === 1) {
      const migrated = migrateV1ToV2(data);
      version = migrated.version;
      data = migrated.data;
      continue;
    }

    return null;
  }

  return { version, data };
};

export const loadSettingsFromStorage = (raw: string | null, defaults: AppSettings): AppSettings => {
  if (!raw) {
    return defaults;
  }

  const parsed = parseJsonSafely(raw);
  if (parsed === null) {
    return defaults;
  }

  const migrated = runMigrations(parsed);
  if (!migrated || migrated.version !== CURRENT_SETTINGS_VERSION) {
    return defaults;
  }

  return sanitizeSettings(migrated.data, defaults);
};

export const createSettingsEnvelope = (settings: AppSettings): PersistedSettingsEnvelope<AppSettings> => ({
  version: CURRENT_SETTINGS_VERSION,
  data: settings
});
