/**
 * Export history tracking.
 * Records each export with format, timestamp, and file metadata.
 */

const STORAGE_KEY = 'draftharbour_export_history_v1';
const MAX_HISTORY = 50;

export interface ExportRecord {
  id: string;
  format: string;
  filename: string;
  novelTitle: string;
  chapterCount: number;
  wordCount: number;
  timestamp: number;
  preset?: string;
  fileSize?: number;
}

function loadHistory(): ExportRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveHistory(records: ExportRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_HISTORY)));
}

export function getExportHistory(): ExportRecord[] {
  return loadHistory();
}

export function recordExport(record: Omit<ExportRecord, 'id' | 'timestamp'>): ExportRecord {
  const history = loadHistory();
  const entry: ExportRecord = {
    ...record,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  history.unshift(entry);
  saveHistory(history);
  return entry;
}

export function clearExportHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function deleteExportRecord(id: string): void {
  const history = loadHistory().filter(r => r.id !== id);
  saveHistory(history);
}

export function downloadExportHistoryAsJson(): void {
  const history = loadHistory();
  const json = JSON.stringify(history, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'draftharbour-export-history.json';
  a.click();
  URL.revokeObjectURL(url);
}
