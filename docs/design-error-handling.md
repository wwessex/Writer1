# Error Handling Design - DraftHarbour Studio

> **Status:** Draft
> **Date:** 2026-02-18
> **Scope:** Application-wide error handling strategy

---

## 1. Current State Audit

### What works today

| Area | Mechanism | Quality |
|------|-----------|---------|
| React render crashes | `ErrorBoundary` at app root | Basic (reload-only recovery) |
| Toast notifications | `useToast()` hook, 4 variants | Good infra, inconsistent use |
| Export operations | try/catch + toast in `ExportModal` | Solid |
| File import/export | try/catch in `useProjectFileActions` | Solid |
| AI providers | Typed errors, HTTP status mapping | Good |
| Integration API | `IntegrationApiError` class with codes | Good |
| Settings persistence | try/catch with fallback to defaults | Good |

### Critical gaps

| Area | Problem | Risk |
|------|---------|------|
| Chapter CRUD | Fire-and-forget `storage.*` calls, no try/catch | **Data loss** - UI shows success, DB fails silently |
| Scene operations | No error handling at all | **Data loss** - same fire-and-forget pattern |
| Novel title updates | `storage.updateNovel()` not awaited | **Data inconsistency** |
| Chapter reorder | No try/catch around DB write | **UI/DB divergence** |
| Snapshot save/delete | No try/catch | **Silent failure** |
| Debounced autosave | Errors in `debouncedSave` unhandled | **Content loss** on IndexedDB failure |
| IntegrationsModal | Multiple unguarded `await` calls | **Modal crash** |
| Dynamic imports | `await import('docx')` etc. not caught | **Export crash** on network/load failure |
| IndexedDB quota | No monitoring or handling | **Write failures** with no user feedback |

### Error handling patterns found (inconsistent)

```
Pattern A: try/catch + console.error + showToast     (ExportModal, useProjectFileActions)
Pattern B: try/catch + console.error only             (AppContext settings)
Pattern C: try/catch + silent fallback                (IntegrationsModal config load)
Pattern D: No error handling at all                   (Chapter CRUD, scene ops, reorder)
Pattern E: Errors thrown but caller must catch         (import.ts, storage.ts)
```

---

## 2. Error Taxonomy

Categorize every error the app can encounter into one of these **five domains**. Each domain has different severity, recovery strategies, and user messaging.

### 2.1 Storage Errors

Failures in IndexedDB (Dexie) or localStorage operations.

| Error | Cause | Severity | User impact |
|-------|-------|----------|-------------|
| `StorageWriteFailed` | IndexedDB write rejected | Critical | Content not saved |
| `StorageReadFailed` | IndexedDB read failure | Critical | Cannot load project |
| `StorageQuotaExceeded` | Browser storage limit hit | Critical | All saves fail |
| `StorageTransactionFailed` | Dexie transaction abort | High | Multi-step op partially applied |
| `LocalStorageFull` | localStorage quota | Medium | Settings not persisted |

**Recovery strategies:**
- Retry once on transient failures
- Show persistent (non-auto-dismiss) toast for write failures
- Suggest "Export Backup" when quota is near limit
- Never update UI state if DB write fails (rollback pattern)

### 2.2 Network/Integration Errors

Failures in cloud sync, OAuth, API calls.

| Error | Cause | Severity | User impact |
|-------|-------|----------|-------------|
| `NetworkOffline` | No connectivity | Medium | Sync unavailable |
| `AuthExpired` | OAuth token expired | Medium | Re-auth required |
| `RateLimited` | Provider throttling (429) | Low | Temporary delay |
| `ProviderUnavailable` | Provider API down | Medium | Sync unavailable |
| `SyncConflict` | Local and remote diverged | High | Manual resolution needed |
| `PopupBlocked` | OAuth popup blocked | Low | User action needed |

**Recovery strategies:**
- Auto-retry with exponential backoff for transient network errors (max 3 retries)
- Queue sync operations when offline, flush when back online
- Prompt re-auth on 401/403; don't retry silently
- Existing `IntegrationApiError` codes map directly to these

### 2.3 Content/Validation Errors

Errors in data integrity, import parsing, export validation.

| Error | Cause | Severity | User impact |
|-------|-------|----------|-------------|
| `ImportParseFailed` | Malformed DOCX/RTF/TXT file | Medium | Import aborted |
| `ExportFailed` | Library error during export | Medium | File not generated |
| `ContentCorrupted` | Invalid Tiptap JSON in DB | High | Chapter unreadable |
| `ValidationFailed` | Export pre-flight check failed | Low | Must fix before export |
| `LibraryLoadFailed` | Dynamic import failed (docx, pdfmake) | Medium | Export unavailable |

**Recovery strategies:**
- Import: Show specific parse error with line/position if available
- Export: Already has try/catch + toast (keep as-is, improve messages)
- Content corruption: Attempt auto-recovery from last snapshot
- Library load: Retry dynamic import once, then show actionable error

### 2.4 AI/External Service Errors

Failures in AI writing assistance and grammar checking.

| Error | Cause | Severity | User impact |
|-------|-------|----------|-------------|
| `AIProviderUnavailable` | No AI provider configured/detected | Low | AI features disabled |
| `AIRequestFailed` | API call error | Low | Suggestion not generated |
| `AIRequestAborted` | User cancelled | None | Expected behavior |
| `GrammarCheckFailed` | LanguageTool unreachable | Low | Grammar check unavailable |

**Recovery strategies:**
- Already handled reasonably in `AIWritingModal` (distinguishes abort vs. error)
- Keep current pattern; extend with retry button in UI

### 2.5 Application Errors

React rendering errors, unexpected runtime exceptions.

| Error | Cause | Severity | User impact |
|-------|-------|----------|-------------|
| `RenderError` | Component crash | Critical | UI broken |
| `UnhandledRejection` | Unhandled async error | High | Silent failure |
| `UnhandledException` | Unexpected throw | High | Feature broken |

**Recovery strategies:**
- Error boundaries at multiple levels (not just app root)
- Global `unhandledrejection` listener
- Log to telemetry system

---

## 3. Proposed Type Definitions

Add to `src/types/index.ts`:

```typescript
// ── Error handling types ──

/** Domains that errors belong to, for categorization and UI treatment. */
export type ErrorDomain =
  | 'storage'
  | 'network'
  | 'content'
  | 'ai'
  | 'application';

/** Severity determines UI treatment: how prominently and persistently to show. */
export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Structured application error.
 * Extends native Error with domain, severity, and recovery metadata.
 */
export interface AppErrorInfo {
  /** Unique error code for programmatic handling (e.g. 'STORAGE_WRITE_FAILED'). */
  code: string;
  /** Human-readable message safe to show the user. */
  message: string;
  /** Which subsystem produced the error. */
  domain: ErrorDomain;
  /** How severe — drives toast persistence and UI treatment. */
  severity: ErrorSeverity;
  /** The original error, if wrapping a caught exception. */
  cause?: unknown;
  /** Whether automatic retry is possible. */
  retryable: boolean;
  /** Suggested user action (shown in toast or error panel). */
  userAction?: string;
  /** Timestamp of occurrence. */
  timestamp: number;
}

/**
 * Result type for operations that can fail.
 * Use instead of naked try/catch for storage and async operations.
 */
export type OperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AppErrorInfo };
```

---

## 4. Architecture Design

### 4.1 Error creation helper

Create `src/lib/errors.ts`:

```typescript
import type { AppErrorInfo, ErrorDomain, ErrorSeverity } from '@/types';

export function createAppError(
  code: string,
  message: string,
  domain: ErrorDomain,
  severity: ErrorSeverity,
  options?: {
    cause?: unknown;
    retryable?: boolean;
    userAction?: string;
  }
): AppErrorInfo {
  return {
    code,
    message,
    domain,
    severity,
    cause: options?.cause,
    retryable: options?.retryable ?? false,
    userAction: options?.userAction,
    timestamp: Date.now(),
  };
}

// Pre-defined error factories for common cases:

export const StorageErrors = {
  writeFailed: (cause?: unknown) => createAppError(
    'STORAGE_WRITE_FAILED',
    'Failed to save your changes.',
    'storage', 'critical',
    { cause, retryable: true, userAction: 'Your work may not be saved. Try again or export a backup.' }
  ),
  readFailed: (cause?: unknown) => createAppError(
    'STORAGE_READ_FAILED',
    'Failed to load data from storage.',
    'storage', 'critical',
    { cause, retryable: true, userAction: 'Try reloading the page.' }
  ),
  quotaExceeded: (cause?: unknown) => createAppError(
    'STORAGE_QUOTA_EXCEEDED',
    'Storage is full.',
    'storage', 'critical',
    { cause, retryable: false, userAction: 'Export a backup and clear old projects to free space.' }
  ),
};

export const NetworkErrors = {
  offline: () => createAppError(
    'NETWORK_OFFLINE',
    'You are offline.',
    'network', 'medium',
    { retryable: true, userAction: 'Changes are saved locally. Sync will resume when you reconnect.' }
  ),
  authExpired: (provider: string) => createAppError(
    'AUTH_EXPIRED',
    `${provider} session expired.`,
    'network', 'medium',
    { retryable: false, userAction: 'Reconnect in Integrations settings.' }
  ),
};

export const ContentErrors = {
  importFailed: (format: string, cause?: unknown) => createAppError(
    'IMPORT_PARSE_FAILED',
    `Failed to parse ${format} file.`,
    'content', 'medium',
    { cause, retryable: false, userAction: 'Check that the file is valid and try again.' }
  ),
  libraryLoadFailed: (lib: string, cause?: unknown) => createAppError(
    'LIBRARY_LOAD_FAILED',
    `Failed to load ${lib} library.`,
    'content', 'medium',
    { cause, retryable: true, userAction: 'Check your connection and try again.' }
  ),
};
```

### 4.2 Error-aware toast integration

Extend the existing `useToast` to handle `AppErrorInfo` directly:

```typescript
// In useToast.ts or a new useErrorToast.ts wrapper:

function showErrorToast(error: AppErrorInfo): void {
  const message = error.userAction
    ? `${error.message} ${error.userAction}`
    : error.message;

  // Critical/high errors stay visible longer (persistent until dismissed)
  // Medium/low errors use standard 3s auto-dismiss
  const persistent = error.severity === 'critical' || error.severity === 'high';

  showToast(message, 'error', undefined, persistent);
}
```

This requires a small addition to the Toast component: support for a `persistent` flag that disables auto-dismiss.

### 4.3 Safe storage wrapper

Wrap Dexie operations so every write path catches errors uniformly:

```typescript
// In src/lib/storage.ts — wrap the public API functions:

export async function safeUpdateChapter(
  id: string,
  updates: Partial<Chapter>
): Promise<OperationResult<void>> {
  try {
    await db.chapters.update(id, { ...updates, updatedAt: Date.now() });
    return { ok: true, value: undefined };
  } catch (cause) {
    const error = isQuotaError(cause)
      ? StorageErrors.quotaExceeded(cause)
      : StorageErrors.writeFailed(cause);
    console.error(`[storage] updateChapter(${id}) failed:`, cause);
    return { ok: false, error };
  }
}

function isQuotaError(err: unknown): boolean {
  return err instanceof DOMException && (
    err.name === 'QuotaExceededError' ||
    err.code === 22
  );
}
```

### 4.4 AppContext error handling pattern

Modify the CRUD operations in `AppContext.tsx` to follow a consistent pattern:

```typescript
// BEFORE (current — fire-and-forget):
const deleteChapter = useCallback(async (id: string) => {
  await storage.deleteChapter(id);
  dispatch({ type: 'DELETE_CHAPTER', payload: id });
}, []);

// AFTER (proposed — catch, report, rollback):
const deleteChapter = useCallback(async (id: string) => {
  try {
    await storage.deleteChapter(id);
    dispatch({ type: 'DELETE_CHAPTER', payload: id });
  } catch (cause) {
    const error = StorageErrors.writeFailed(cause);
    showErrorToast(error);
    // Do NOT dispatch — DB failed, keep UI consistent
  }
}, [showErrorToast]);
```

Key principle: **dispatch only after successful DB write** (except for reads/loads where optimistic UI makes sense).

### 4.5 Granular error boundaries

Add section-level error boundaries around the three main panels so a crash in one doesn't take down the whole app:

```
<ErrorBoundary>          ← app root (existing, keep as last resort)
  <ToastProvider>
    <AppProvider>
      <PanelErrorBoundary panel="sidebar">
        <Sidebar />
      </PanelErrorBoundary>

      <PanelErrorBoundary panel="editor">
        <Editor />
      </PanelErrorBoundary>

      <PanelErrorBoundary panel="inspector">
        <Inspector />
      </PanelErrorBoundary>
    </AppProvider>
  </ToastProvider>
</ErrorBoundary>
```

`PanelErrorBoundary` renders a compact "This panel encountered an error — click to retry" message instead of a full-screen crash page.

### 4.6 Global unhandled rejection handler

Add to `src/main.tsx`:

```typescript
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandled rejection]', event.reason);
  // Optionally record to telemetry
  recordTelemetryEvent({
    action: 'error.unhandled_rejection',
    success: false,
    errorType: event.reason?.name || 'UnhandledRejection',
  });
});
```

This is a safety net, not a replacement for proper error handling.

---

## 5. Implementation Plan

### Phase 1: Foundation (highest impact, lowest risk)

**Goal:** Stop silent data loss in core CRUD operations.

| # | Task | Files | Impact |
|---|------|-------|--------|
| 1.1 | Add error types (`AppErrorInfo`, `OperationResult`, `ErrorDomain`, `ErrorSeverity`) | `src/types/index.ts` | Foundation for everything |
| 1.2 | Create `src/lib/errors.ts` with `createAppError` + domain error factories | New file | Reusable error creation |
| 1.3 | Add `persistent` flag to Toast + `showErrorToast` helper | `src/components/UI/Toast.tsx`, `useToast.ts` | Critical errors don't vanish in 3s |
| 1.4 | Wrap all AppContext CRUD in try/catch (deleteChapter, createChapter, reorderChapters, updateNovelTitle, addScene, updateScene, deleteScene) | `src/context/AppContext.tsx` | **Stops silent data loss** |
| 1.5 | Handle errors in debounced autosave | `src/context/AppContext.tsx` | **Stops silent content loss** |
| 1.6 | Add global `unhandledrejection` listener | `src/main.tsx` | Safety net |

### Phase 2: Panel resilience

**Goal:** Prevent single-component crashes from taking down the entire app.

| # | Task | Files | Impact |
|---|------|-------|--------|
| 2.1 | Create `PanelErrorBoundary` component with retry | New: `src/components/PanelErrorBoundary.tsx` | Isolated crash recovery |
| 2.2 | Wrap Sidebar, Editor, Inspector in panel boundaries | `src/App.tsx` | Partial-app recovery |
| 2.3 | Enhance root ErrorBoundary with "Export Backup" action | `src/components/ErrorBoundary.tsx` | Data rescue on fatal crash |

### Phase 3: Integration & sync hardening

**Goal:** Make cloud sync operations robust.

| # | Task | Files | Impact |
|---|------|-------|--------|
| 3.1 | Add try/catch to all IntegrationsModal async calls | `src/components/Modals/IntegrationsModal.tsx` | Prevents modal crash |
| 3.2 | Add retry logic for transient network errors in sync | `src/lib/integrations/sync.ts` | Resilient sync |
| 3.3 | Handle OAuth popup timeout (30s max) | `src/lib/integrations/oauth.ts` | No infinite polling |
| 3.4 | Surface `IntegrationApiError.code` in user-facing messages | Integration modals | Actionable error messages |

### Phase 4: Content safety

**Goal:** Protect against import/export edge cases.

| # | Task | Files | Impact |
|---|------|-------|--------|
| 4.1 | Wrap dynamic `import()` calls in try/catch | `src/lib/export.ts` | Handles library load failure |
| 4.2 | Add try/catch to snapshot save/delete in SnapshotModal | `src/components/Modals/SnapshotModal.tsx` | User feedback on failure |
| 4.3 | Validate Tiptap JSON before writing to IndexedDB | `src/lib/storage.ts` | Prevents content corruption |
| 4.4 | Add structured errors to import result type | `src/lib/import.ts`, `src/types/index.ts` | Clear import failure reporting |

### Phase 5: Observability

**Goal:** Know when errors happen in production.

| # | Task | Files | Impact |
|---|------|-------|--------|
| 5.1 | Extend telemetry to record all `AppErrorInfo` events | `src/lib/telemetry.ts` | Error visibility |
| 5.2 | Add error count badge or indicator in UI (optional) | `src/components/Header/` | User awareness |

---

## 6. Implementation Checklist

Use this to track progress. Each item maps to the plan above.

### Phase 1: Foundation
- [ ] 1.1 Add error types to `src/types/index.ts`
- [ ] 1.2 Create `src/lib/errors.ts`
- [ ] 1.3 Add persistent toast support
- [ ] 1.4 Wrap AppContext CRUD operations
- [ ] 1.5 Handle debounced autosave errors
- [ ] 1.6 Add unhandledrejection listener

### Phase 2: Panel Resilience
- [ ] 2.1 Create PanelErrorBoundary component
- [ ] 2.2 Wrap main panels in boundaries
- [ ] 2.3 Enhance root ErrorBoundary with backup export

### Phase 3: Integration Hardening
- [ ] 3.1 Guard IntegrationsModal async calls
- [ ] 3.2 Add retry logic to sync operations
- [ ] 3.3 Add OAuth popup timeout
- [ ] 3.4 Surface error codes in user messages

### Phase 4: Content Safety
- [ ] 4.1 Wrap dynamic import() calls
- [ ] 4.2 Guard snapshot operations
- [ ] 4.3 Validate Tiptap JSON before save
- [ ] 4.4 Structured import error reporting

### Phase 5: Observability
- [ ] 5.1 Record AppErrorInfo in telemetry
- [ ] 5.2 Error indicator in UI (optional)

---

## 7. Design Decisions & Rationale

### Why `OperationResult<T>` instead of always throwing?

Thrown errors are invisible at the call site — nothing in the type system forces the caller to handle them. `OperationResult<T>` makes the caller explicitly check `ok` before using the value. Use this for storage operations where failure is a realistic possibility. For truly exceptional cases (out-of-memory, stack overflow), thrown errors caught by error boundaries are fine.

### Why not a global error store in AppState?

Adding an `errors: AppErrorInfo[]` array to `AppState` would couple error handling to the reducer and make every component re-render on every error. Instead, errors flow through two channels:
1. **Toast system** — for transient user notifications (already exists)
2. **Component-local state** — for errors that affect a specific UI area (e.g., `AIWritingModal` already does this well)

### Why dispatch-after-write instead of optimistic updates?

For an offline-first app where IndexedDB is the source of truth, optimistic UI that diverges from storage is dangerous. If the DB write fails, the user sees stale state. The cost of waiting for a local DB write (< 10ms typically) is negligible.

### Why persistent toasts for critical errors?

The current 3-second auto-dismiss means a user who isn't looking at the screen when a save fails will never know. Critical storage errors need to stay visible until acknowledged.

### Why panel-level error boundaries?

A crash in the Inspector panel shouldn't destroy the editor and unsaved work. Panel boundaries let the user continue working (or at least export) even when one section fails.

---

## 8. Error Message Guidelines

All user-facing error messages should follow this structure:

```
[What happened]. [What the user should do].
```

Examples:
- "Failed to save your changes. Try again or export a backup."
- "Dropbox session expired. Reconnect in Integrations settings."
- "Failed to parse DOCX file. Check that the file is valid and try again."
- "Storage is full. Export a backup and clear old projects to free space."

Avoid:
- Technical jargon ("DOMException", "QuotaExceededError", "transaction aborted")
- Vague messages ("Something went wrong", "An error occurred")
- Blame ("You caused an error", "Invalid input")
- Stack traces in user-facing UI (log those to console/telemetry only)

---

## 9. File Change Map

Visual overview of which files are touched in each phase:

```
src/
├── types/index.ts                    ← Phase 1 (new types)
├── main.tsx                          ← Phase 1 (unhandled rejection listener)
├── App.tsx                           ← Phase 2 (panel boundaries)
├── lib/
│   ├── errors.ts                     ← Phase 1 (NEW FILE)
│   ├── storage.ts                    ← Phase 4 (JSON validation)
│   ├── export.ts                     ← Phase 4 (wrap dynamic imports)
│   ├── import.ts                     ← Phase 4 (structured errors)
│   ├── telemetry.ts                  ← Phase 5 (error recording)
│   └── integrations/
│       ├── sync.ts                   ← Phase 3 (retry logic)
│       └── oauth.ts                  ← Phase 3 (popup timeout)
├── context/
│   └── AppContext.tsx                 ← Phase 1 (CRUD error handling)
├── components/
│   ├── ErrorBoundary.tsx             ← Phase 2 (backup export action)
│   ├── PanelErrorBoundary.tsx        ← Phase 2 (NEW FILE)
│   ├── UI/
│   │   ├── Toast.tsx                 ← Phase 1 (persistent flag)
│   │   └── useToast.ts              ← Phase 1 (showErrorToast)
│   └── Modals/
│       ├── IntegrationsModal.tsx     ← Phase 3 (try/catch guards)
│       └── SnapshotModal.tsx         ← Phase 4 (try/catch guards)
```

---

## 10. Testing Strategy

| What to test | How | Where |
|-------------|-----|-------|
| `createAppError` factories | Unit test: verify all fields populated correctly | `src/lib/errors.test.ts` |
| `OperationResult` pattern | Unit test: verify ok/error branches | `src/lib/storage.test.ts` |
| Toast persistence | Manual: trigger critical error, verify toast stays | Browser DevTools |
| Panel error boundaries | Manual: throw in component, verify boundary catches | Browser |
| Autosave failure | Unit test: mock Dexie to throw, verify error toast | `src/context/AppContext.test.ts` |
| Import parse errors | Unit test: feed malformed files | `src/lib/import.test.ts` |
| Unhandled rejection | Manual: reject a promise, verify listener fires | Browser console |
