# Test Coverage Analysis — DraftHarbour Studio

**Date:** 2026-03-10
**Test suite:** 73 test files, 496 tests (491 passing, 5 failing)

## Current State

The project has **73 test files** covering roughly **35–40%** of the ~209 source files. Tests are well-organized and co-located with source code.

### Existing failures (pre-existing, not introduced by this analysis)

| File | Failure | Root Cause |
|------|---------|------------|
| `AppContext.actions.test.tsx` | 1 test failing | Mock missing `getStoryBlueprint` export from `@/lib/storage` |
| `AppContext.hooks.test.tsx` | 3 tests failing | Same mock issue as above |
| `Modals/index.test.ts` | 1 test failing | Barrel export count assertion outdated (expects 18, got 19) |

These should be fixed first — they indicate the mocks and assertions have drifted from the source.

---

## Coverage Gaps — Prioritized Recommendations

### Priority 1: Critical / Security-Sensitive (test immediately)

#### 1. `src/lib/encryption.ts` (158 LOC, 9 exports) — **No tests**
AES-GCM encryption/decryption with PBKDF2 key derivation for sync data. Bugs here mean silent data corruption or security failures.

**What to test:**
- Round-trip encrypt/decrypt with known inputs
- `verifySyncPassphrase()` with correct and incorrect passphrases
- `isEncryptionSupported()` in environments with/without Web Crypto
- Salt + IV concatenation and extraction from ciphertext
- Edge cases: empty data, very large payloads, invalid keys

#### 2. `src/lib/errors.ts` (351 LOC, 13+ exports) — **No tests**
Centralized error handling with API key/token redaction, safe mode, crash reporting, and global error handlers.

**What to test:**
- `reportAppError()` redacts API keys, tokens, and secrets from error messages
- `createAppError()` produces correct error categories
- Safe mode flag lifecycle: `enableSafeModeForNextRestart()` → `consumeSafeModeFlag()` → `isSafeModeEnabledForSession()`
- `createDiagnosticsReport()` output structure
- `StorageErrors`, `NetworkErrors`, `ContentErrors` helper namespaces

---

### Priority 2: High Risk / Complex Logic

#### 3. `src/lib/continuityMemory.ts` (187 LOC, 5 exports) — **No tests**
Regex-based extraction of character ages, relationships, timeline events, and world rules from chapter text. Conflict detection for continuity.

**What to test:**
- Character age extraction and conflict detection (e.g., "Alice is 25 years old" vs "Alice is 30 years old")
- Relationship extraction patterns
- `formatContinuityContext()` output for AI prompt injection
- Cache invalidation via `updatedAt` timestamps
- False positive resistance (common name patterns that shouldn't match)

#### 4. `src/lib/projectMetrics.ts` (346 LOC, 7 exports) — **No tests**
Heuristic scoring for opening hook quality, tension, readability, genre inference, and pacing.

**What to test:**
- `buildChapterMetrics()` with chapters of varying lengths and styles
- `inferGenre()` with known genre-indicating vocabulary
- `buildProjectHeuristicInsights()` confidence and scoring bounds
- Edge cases: single chapter, empty chapters, zero word count
- AI blend formula with various confidence levels

#### 5. `src/lib/ai/providerManager.ts` (165 LOC, 4 exports) — **No tests**
Provider factory, config persistence, legacy migration, and managed policy enforcement.

**What to test:**
- `loadAIConfig()` / `saveAIConfig()` round-trip
- Legacy `apiKey` → `sessionToken` migration
- `createProvider()` for each provider type
- `detectBestProvider()` fallback chain
- Managed policy enforcement (`disableAIProviders`, `disabledAIProviderTypes`)
- Config scrubbing (sessionToken not persisted on web)

#### 6. `src/lib/integrations/orchestration.ts` (108 LOC, 2 exports) — **No tests**
Maps app state to provider payloads and normalizes pull responses with conflict detection.

**What to test:**
- `mapAppStateToProviderPayload()` structure with book vs screenplay projects
- `normalizeProviderPullResponse()` for Dropbox, Google Drive, Scrivener formats
- Conflict counting and chapter merge behavior
- Missing chapter ID handling (new chapter creation)

---

### Priority 3: Medium Risk / Business Logic

#### 7. `src/lib/progressTracker.ts` (197 LOC, 7 exports) — **No tests**
Daily word goals, writing streaks, rolling 90-day history.

**What to test:**
- `recordDailyWords()` increments and streak logic
- `getTodayProgress()` / `getWeeklyHistory()` / `getMonthlyHistory()` date math
- Streak boundary conditions (midnight crossover, timezone edge cases)
- Snapshot cap at 180 entries

#### 8. `src/lib/exportValidation.ts` (343 LOC, 5 exports) — **No tests**
12 manuscript validation rules across submission/ebook/print profiles.

**What to test:**
- Each validation rule independently (font size, spacing, margins, indents, alignment)
- Profile defaults correctness
- `validateExport()` aggregation with mixed pass/fail rules
- `hasValidationErrors()` boolean gate

#### 9. `src/lib/ai/availability.ts` (136 LOC, 3 exports) — **No tests**
Chrome Built-in AI detection with version-specific API handling.

**What to test:**
- `isChromeBrowser()` with various user-agent strings (Chrome, Edge, Brave, Firefox)
- Chrome version extraction (≤137 vs 138+ API differences)
- `checkChromeAIAvailability()` with mocked navigator APIs
- Chromium fork exclusion logic

#### 10. `src/lib/export/pdf.ts` (138 LOC, 2 exports) — **No tests**
PDF export for manuscripts and screenplays via pdfmake.

**What to test:**
- `exportToPdf()` generates valid pdfmake document definition
- `exportToScreenplayPdf()` format differences
- Lazy-load failure handling
- Empty chapter handling

#### 11. `src/lib/search.ts` (94 LOC, 4 exports) — **No tests**
Full-text search indexing with Unicode normalization and snippet extraction.

**What to test:**
- `normalizeSearchText()` with accented characters and Unicode
- `buildChapterSearchIndex()` index structure
- `findChapterContentMatches()` scoring (title boost = +12)
- Snippet context extraction (±80 chars)
- Max results cap

---

### Priority 4: Low Risk but Good to Have

#### 12. `src/lib/exportHistory.ts` (71 LOC, 4 exports) — **No tests**
Export audit trail CRUD in localStorage.

#### 13. `src/lib/adapters.ts` (226 LOC, 6+ exports) — **No tests**
Adapter registry pattern (mostly stubs currently).

#### 14. `src/lib/export/shared.ts` (45 LOC, 5 exports) — **No tests**
Unit conversion helpers (`inchesToTwips`, `ptToHalfPt`, etc.).

---

## Untested Components (UI)

These components have no test files at all:

| Component | Risk | Notes |
|-----------|------|-------|
| `Modals/ExportModal` | High | Core user workflow; export format selection and options |
| `Modals/OnboardingModal` | Medium | First-run experience |
| `Modals/ConflictResolutionModal` | High | Data loss risk if conflicts handled incorrectly |
| `Modals/CharacterBibleModal` | Medium | Complex data display |
| `Modals/AdvancedAnalyticsModal` | Medium | Aggregates multiple analysis modules |
| `Modals/CommentModal` | Medium | Comment thread management |
| `Modals/WordCountModal` | Low | Display-only |
| `Sidebar/ChapterList` | Medium | Drag-and-drop reordering |
| `Sidebar/OutlinePanel` | Low | Read-only display |
| `Sidebar/ScenePlanner` | Medium | Scene CRUD operations |
| `Windows/SettingsWindow` | Medium | Settings persistence |
| `ErrorBoundary` | High | Crash recovery UX |
| `PanelErrorBoundary` | Medium | Graceful panel failure |
| UI primitives (Button, Input, Toast, Tooltip) | Low | Simple presentational components |

---

## Untested Hooks

| Hook | Risk | Notes |
|------|------|-------|
| `useCrashRecovery` | High | Recovery from IndexedDB failures |
| `useProjectFileActions` | Medium | File import/export orchestration |
| `useModalAccessibility` | Medium | Focus trapping, aria attributes |
| `useResizable` | Low | Drag-to-resize panels |

---

## Recommended Action Plan

### Phase 1 — Fix existing failures + critical gaps (1–2 days)
1. Fix the 5 failing tests (mock drift for `getStoryBlueprint`, barrel export count)
2. Add tests for `encryption.ts` (security-critical)
3. Add tests for `errors.ts` (error redaction, safe mode)

### Phase 2 — High-risk business logic (2–3 days)
4. Add tests for `continuityMemory.ts` (regex patterns, conflict detection)
5. Add tests for `projectMetrics.ts` (scoring heuristics)
6. Add tests for `ai/providerManager.ts` (config migration, policy)
7. Add tests for `integrations/orchestration.ts` (sync normalization)
8. Add tests for `ErrorBoundary` component (crash recovery UX)

### Phase 3 — Medium-risk modules (2–3 days)
9. Add tests for `progressTracker.ts` (streaks, date math)
10. Add tests for `exportValidation.ts` (validation rules)
11. Add tests for `ai/availability.ts` (browser detection)
12. Add tests for `search.ts` (indexing, scoring)
13. Add tests for `ExportModal` and `ConflictResolutionModal` components

### Phase 4 — Fill remaining gaps
14. Remaining untested modals, hooks, and utility modules
15. Increase reducer test coverage (currently only 2 tests for `appReducer`)

---

## Summary

| Category | Files | Tested | Coverage |
|----------|-------|--------|----------|
| Hooks | 15 | 10 | 67% |
| Context/State | 5 | 4 | 80% |
| Library modules | ~55 | ~20 | ~36% |
| AI modules | 8 | 1 | 13% |
| Export modules | 9 | 1 | 11% |
| Integration modules | 15 | 5 | 33% |
| Components | 72 | 30 | 42% |
| **Total** | **~209** | **~73** | **~35%** |

The biggest risks are in **encryption**, **error handling**, **continuity analysis**, and **AI provider management** — all of which are untested and contain complex, security-sensitive, or data-critical logic.
