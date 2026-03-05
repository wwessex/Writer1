/**
 * Writing progress tracker with daily streaks and session tracking.
 * All data is stored in localStorage for offline-first behavior.
 */

import { PROGRESS_STORAGE_KEY, PROGRESS_SNAPSHOTS_STORAGE_KEY } from '@/lib/storageKeys';

const STORAGE_KEY = PROGRESS_STORAGE_KEY;
const MAX_PROGRESS_SNAPSHOTS = 180;


export interface ProgressSnapshot {
  date: string;
  totalWords: number;
  dailyGoal: number;
  weeklyGoal: number;
  novelGoal: number;
}

function loadProgressSnapshots(): ProgressSnapshot[] {
  try {
    const raw = localStorage.getItem(PROGRESS_SNAPSHOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(entry => entry && typeof entry === 'object')
      .map(entry => ({
        date: typeof entry.date === 'string' ? entry.date : '',
        totalWords: typeof entry.totalWords === 'number' ? entry.totalWords : 0,
        dailyGoal: typeof entry.dailyGoal === 'number' ? entry.dailyGoal : 0,
        weeklyGoal: typeof entry.weeklyGoal === 'number' ? entry.weeklyGoal : 0,
        novelGoal: typeof entry.novelGoal === 'number' ? entry.novelGoal : 0,
      }))
      .filter(entry => entry.date);
  } catch {
    return [];
  }
}

function saveProgressSnapshots(snapshots: ProgressSnapshot[]): void {
  localStorage.setItem(PROGRESS_SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
}

export function recordProgressSnapshot(snapshot: ProgressSnapshot): ProgressSnapshot[] {
  const snapshots = loadProgressSnapshots();
  const existingIndex = snapshots.findIndex(entry => entry.date === snapshot.date);

  if (existingIndex >= 0) {
    snapshots[existingIndex] = snapshot;
  } else {
    snapshots.push(snapshot);
  }

  snapshots.sort((a, b) => a.date.localeCompare(b.date));
  const truncated = snapshots.slice(-MAX_PROGRESS_SNAPSHOTS);
  saveProgressSnapshots(truncated);
  return truncated;
}

export function getProgressSnapshots(days: number = 30): ProgressSnapshot[] {
  const snapshots = loadProgressSnapshots();
  if (days <= 0) return snapshots;
  return snapshots.slice(-days);
}

export interface DailyProgress {
  date: string; // YYYY-MM-DD
  wordsWritten: number;
  wordsAtStart: number;
  goalMet: boolean;
  sessions: number;
}

export interface WritingStreak {
  current: number;
  longest: number;
  lastActiveDate: string;
}

export interface ProgressData {
  dailyHistory: DailyProgress[];
  streak: WritingStreak;
  totalSessions: number;
  totalWordsAllTime: number;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function loadProgressData(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    dailyHistory: [],
    streak: { current: 0, longest: 0, lastActiveDate: '' },
    totalSessions: 0,
    totalWordsAllTime: 0,
  };
}

function saveProgressData(data: ProgressData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getProgressData(): ProgressData {
  return loadProgressData();
}

export function recordDailyWords(totalWordsNow: number, dailyGoal: number): ProgressData {
  const data = loadProgressData();
  const today = getToday();

  let todayEntry = data.dailyHistory.find(d => d.date === today);
  if (!todayEntry) {
    todayEntry = {
      date: today,
      wordsWritten: 0,
      wordsAtStart: totalWordsNow,
      goalMet: false,
      sessions: 1,
    };
    data.dailyHistory.push(todayEntry);
    data.totalSessions++;
  }

  const wordsToday = Math.max(0, totalWordsNow - todayEntry.wordsAtStart);
  todayEntry.wordsWritten = wordsToday;
  todayEntry.goalMet = dailyGoal > 0 ? wordsToday >= dailyGoal : false;

  // Update streak
  const yesterday = getYesterday();
  if (data.streak.lastActiveDate === today) {
    // Already updated today, just refresh
  } else if (data.streak.lastActiveDate === yesterday) {
    data.streak.current++;
    data.streak.lastActiveDate = today;
  } else if (data.streak.lastActiveDate !== today) {
    data.streak.current = 1;
    data.streak.lastActiveDate = today;
  }

  if (data.streak.current > data.streak.longest) {
    data.streak.longest = data.streak.current;
  }

  // Keep only last 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  data.dailyHistory = data.dailyHistory.filter(d => d.date >= cutoffStr);

  saveProgressData(data);
  return data;
}

export function getTodayProgress(totalWordsNow: number): { wordsToday: number; goalMet: boolean } {
  const data = loadProgressData();
  const today = getToday();
  const todayEntry = data.dailyHistory.find(d => d.date === today);

  if (!todayEntry) {
    return { wordsToday: 0, goalMet: false };
  }

  return {
    wordsToday: Math.max(0, totalWordsNow - todayEntry.wordsAtStart),
    goalMet: todayEntry.goalMet,
  };
}

export function getWeeklyHistory(): DailyProgress[] {
  const data = loadProgressData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.dailyHistory.filter(d => d.date >= cutoffStr);
}

export function getMonthlyHistory(): DailyProgress[] {
  const data = loadProgressData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.dailyHistory.filter(d => d.date >= cutoffStr);
}
