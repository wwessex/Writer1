import { GOAL_TRENDS_STORAGE_KEY } from '@/lib/storageKeys';

const MAX_GOAL_TREND_ENTRIES = 90;

export interface GoalTrendSnapshot {
  date: string;
  wordsToday: number;
  dailyGoal: number;
  goalMet: boolean;
}

export function loadGoalTrendSnapshots(): GoalTrendSnapshot[] {
  try {
    const raw = localStorage.getItem(GOAL_TRENDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is GoalTrendSnapshot => (
      typeof item?.date === 'string'
      && typeof item?.wordsToday === 'number'
      && typeof item?.dailyGoal === 'number'
      && typeof item?.goalMet === 'boolean'
    ));
  } catch {
    return [];
  }
}

function saveGoalTrendSnapshots(entries: GoalTrendSnapshot[]): void {
  localStorage.setItem(GOAL_TRENDS_STORAGE_KEY, JSON.stringify(entries.slice(-MAX_GOAL_TREND_ENTRIES)));
}

export function upsertGoalTrendSnapshot(snapshot: GoalTrendSnapshot): GoalTrendSnapshot[] {
  const entries = loadGoalTrendSnapshots();
  const existingIdx = entries.findIndex(item => item.date === snapshot.date);

  if (existingIdx >= 0) {
    entries[existingIdx] = snapshot;
  } else {
    entries.push(snapshot);
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  saveGoalTrendSnapshots(entries);
  return entries;
}

export function getGoalTrendSnapshots(days: number = 8): GoalTrendSnapshot[] {
  const entries = loadGoalTrendSnapshots();
  if (days <= 0) return entries;
  return entries.slice(-days);
}
