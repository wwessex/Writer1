import { generateId } from '@/lib/utils';
import { AI_REVISION_LOG_STORAGE_KEY } from '@/lib/constants/storageKeys';
const MAX_RECORDS = 100;

export interface AIRevisionStageLog {
  stageId: string;
  label: string;
  action: string;
  insertionMode: 'replace' | 'append' | 'side-by-side';
}

export interface AIRevisionRecord {
  id: string;
  novelId: string;
  chapterId: string;
  chapterTitle: string;
  timestamp: number;
  pipelineLabel: string;
  beforeText: string;
  afterText: string;
  stages: AIRevisionStageLog[];
}

function loadRevisionLog(): AIRevisionRecord[] {
  try {
    const raw = localStorage.getItem(AI_REVISION_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AIRevisionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRevisionLog(records: AIRevisionRecord[]): void {
  localStorage.setItem(AI_REVISION_LOG_STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
}

export function recordAIRevision(record: Omit<AIRevisionRecord, 'id' | 'timestamp'>): AIRevisionRecord {
  const history = loadRevisionLog();
  const entry: AIRevisionRecord = {
    ...record,
    id: generateId(),
    timestamp: Date.now(),
  };

  history.unshift(entry);
  saveRevisionLog(history);
  return entry;
}

export function getAIRevisionLog(chapterId?: string): AIRevisionRecord[] {
  const history = loadRevisionLog();
  if (!chapterId) return history;
  return history.filter(entry => entry.chapterId === chapterId);
}
