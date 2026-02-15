/**
 * AI usage telemetry with opt-in tracking.
 * All data stays local unless the user explicitly opts in.
 * Context length estimates are redacted to character counts only.
 */

const STORAGE_KEY = 'novelwriter_ai_telemetry_v1';
const OPT_IN_KEY = 'novelwriter_ai_telemetry_optin';
const MAX_RECORDS = 200;

export interface TelemetryEvent {
  id: string;
  timestamp: number;
  action: string;
  contextLengthChars: number;
  promptLengthChars: number;
  responseLengthChars: number;
  model?: string;
  latencyMs?: number;
  success: boolean;
  errorType?: string;
}

export interface TelemetrySummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgContextLength: number;
  avgLatencyMs: number;
  totalTokensEstimate: number;
  mostUsedActions: { action: string; count: number }[];
  recentEvents: TelemetryEvent[];
}

export function isTelemetryOptedIn(): boolean {
  return localStorage.getItem(OPT_IN_KEY) === 'true';
}

export function setTelemetryOptIn(enabled: boolean): void {
  localStorage.setItem(OPT_IN_KEY, String(enabled));
  if (!enabled) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadEvents(): TelemetryEvent[] {
  if (!isTelemetryOptedIn()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveEvents(events: TelemetryEvent[]): void {
  if (!isTelemetryOptedIn()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_RECORDS)));
}

export function recordTelemetryEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): void {
  if (!isTelemetryOptedIn()) return;

  const events = loadEvents();
  events.unshift({
    ...event,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
  saveEvents(events);
}

export function getTelemetrySummary(): TelemetrySummary {
  const events = loadEvents();

  const successful = events.filter(e => e.success);
  const failed = events.filter(e => !e.success);

  const avgContext = successful.length > 0
    ? Math.round(successful.reduce((s, e) => s + e.contextLengthChars, 0) / successful.length)
    : 0;

  const avgLatency = successful.filter(e => e.latencyMs).length > 0
    ? Math.round(
        successful.filter(e => e.latencyMs).reduce((s, e) => s + (e.latencyMs || 0), 0)
        / successful.filter(e => e.latencyMs).length
      )
    : 0;

  // Rough token estimate: ~4 chars per token
  const totalChars = events.reduce(
    (s, e) => s + e.contextLengthChars + e.promptLengthChars + e.responseLengthChars,
    0
  );

  // Action frequency
  const actionCounts = new Map<string, number>();
  for (const event of events) {
    actionCounts.set(event.action, (actionCounts.get(event.action) || 0) + 1);
  }
  const mostUsedActions = [...actionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([action, count]) => ({ action, count }));

  return {
    totalRequests: events.length,
    successfulRequests: successful.length,
    failedRequests: failed.length,
    avgContextLength: avgContext,
    avgLatencyMs: avgLatency,
    totalTokensEstimate: Math.round(totalChars / 4),
    mostUsedActions,
    recentEvents: events.slice(0, 20),
  };
}

export function clearTelemetryData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportTelemetryData(): string {
  const events = loadEvents();
  // Redact: only include character counts, not actual content
  return JSON.stringify(events.map(e => ({
    ...e,
    // All fields are already redacted (char counts only)
  })), null, 2);
}
