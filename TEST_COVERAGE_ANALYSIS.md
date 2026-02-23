# Test Coverage Analysis — DraftHarbour Studio

> **Last updated:** 2026-02-23
> **Maintenance note:** Update this document whenever a test suite (`*.test.ts` / `*.test.tsx`) is added, renamed, or removed.

## Current State

**Framework:** Vitest 4.x
**Test files:** 13
**Total test cases:** 105 (all passing)
**Estimated module coverage:** ~15% of source modules have any tests

### Existing Test Inventory

| Test File | Module Under Test | Tests | Assessment |
|-----------|-------------------|------:|------------|
| `utils.test.ts` | `countWords`, `countSentences`, `calculateFleschScore`, `findRepetitions`, `findLongSentences`, `analyzeText`, `editorToPlainText`, `formatRelativeTime`, `clamp`, `generateId` | 34 | **Good** — broadest coverage in the project |
| `integrations/sync.test.ts` | `mergeChapterFromRemote`, `resolveSyncConflict`, `buildPushSyncMetadata`, `mapAppStateToProviderPayload`, `normalizeProviderPullResponse` | 21 | **Good** — solid three-way merge and conflict resolution |
| `import.test.ts` | `importFile` (DOCX import, chapter heading detection) | 16 | **Moderate** — strong heading detection, no RTF/TXT/Fountain |
| `export.screenplay.test.ts` | `screenplayJsonToBlocks`, `screenplayChapterToFountain`, `screenplayChapterToPdfContent`, `exportToFountain` | 6 | **Moderate** — screenplay path only; no DOCX/PDF/RTF |
| `timelineConsistency.test.ts` | `analyzeTimelineConsistency` | 5 | **Thin** — covers main paradox types, few edge cases |
| `narrativeWeather.test.ts` | `buildNarrativeWeather`, `getDialogueDensity`, `getPacingIntensity`, `getSentimentProxyScore` | 4 | **Thin** — basic happy-path only |
| `useAppKeyboardShortcuts.test.ts` | `handleKeyboardShortcut` | 3 | **Thin** — 3 of ~12 shortcuts tested |
| `AppContext.settings.test.tsx` | `createDefaultSettings`, `loadSettingsFromStorage`, `mergeSettings`, `normalizeSidebarPanels` | 3 | **Thin** — settings round-trip, no reducer tests |
| `import.screenplay.test.ts` | `importFountain`, `mapImportedContentToProjectType` | 3 | **Thin** — only 2 fixture files |
| `storage.backup.test.ts` | `upgradeBackup`, `mergeImportedSettings`, `mergeImportedIntegrations` | 3 | **Thin** — backup upgrade only, no CRUD |
| `voiceFingerprint.test.ts` | `computeFingerprint`, `similarityScore`, `buildCharacterVoiceProfiles`, `getDialogueSimilarityAlerts` | 3 | **Thin** — stability + threshold, lacks edge cases |
| `sceneChemistry.test.ts` | `simulateSceneChemistry` | 2 | **Minimal** — determinism + missing-metadata only |
| `useCommentActions.test.ts` | `createCommentThreadFromSelection` | 2 | **Minimal** — thread creation only |

**Totals:** 13 suites, 105 test cases.

---

## Critical Gaps — Untested Modules

### Tier 1: Core Data Path (Highest Risk)

These modules form the critical data path — user content flows through them for persistence, import, and export. Bugs here cause **data loss**.

#### 1. `src/lib/storage.ts` (941 lines) — NO TESTS

The entire IndexedDB persistence layer is untested:
- `createNovel()`, `createChapter()`, `updateChapter()`, `deleteChapter()`
- `reorderChapters()`, `getChaptersByNovel()`
- `exportBackup()`, `importBackup()`
- `exportDhproj()`, `importDhproj()`
- `saveGoalTrend()`, snapshot CRUD

**Recommended tests:**
- Chapter CRUD round-trips (create → read → update → delete)
- Reorder logic preserves all chapters with no gaps or duplicates in `order`
- Backup export → import produces identical data
- `.dhproj` format round-trip
- Behavior on missing/corrupted DB entries
- Snapshot creation and retrieval by chapter

**Approach:** Use `fake-indexeddb` to mock Dexie in a Node/Vitest environment.

#### 2. `src/lib/export.ts` (1,259 lines) — PARTIALLY TESTED (screenplay only)

The largest file in the codebase has zero tests for its three most-used export paths:
- `exportToDocx()` — DOCX generation via the `docx` library
- `exportToPdf()` — PDF via pdfmake
- `exportToRtf()` — raw RTF string construction

**Recommended tests:**
- DOCX: verify document structure (paragraph count, heading levels, page breaks between chapters)
- PDF: verify content blocks contain expected text and correct styles
- RTF: snapshot test the raw string output for a known input
- All formats: empty novel, single chapter, multi-chapter, chapters with no content
- Metadata correctness (title, author in document properties)
- Special character escaping in all formats

**Approach:** For DOCX, inspect the JSZip output or use `docx` Packer to verify XML. For PDF, test the pdfmake document definition object before rendering. For RTF, use snapshot/string comparison.

#### 3. `src/lib/import.ts` (479 lines) — PARTIALLY TESTED (DOCX + heading detection only)

Missing test coverage for:
- `parseRtf()` — RTF format parsing
- Plain text (`.txt`) import with chapter detection
- Fountain (`.fountain`) import for non-screenplay projects
- File type detection edge cases (unknown extensions, wrong MIME types)
- Encoding edge cases (BOM markers, non-UTF-8)

**Recommended tests:**
- RTF import: basic formatting preservation, chapter splitting
- TXT import: plain text chapter detection, whitespace handling
- Error cases: unsupported format, corrupted file, empty file
- Content fidelity: verify imported content matches source

#### 4. `src/context/AppContext.tsx` (591 lines) — SETTINGS ONLY

The app reducer handles 20+ action types and none are tested:
- `SET_CHAPTERS`, `UPDATE_CHAPTER`, `REORDER_CHAPTERS`
- `SET_ACTIVE_CHAPTER`, `ADD_SCENE`, `DELETE_SCENE`, `UPDATE_SCENE`
- Theme switching, autosave debouncing, novel loading

**Recommended tests:**
- Reducer unit tests for every action type
- State transitions: creating a chapter updates the array and sets it active
- Edge cases: deleting the active chapter, reordering to same position, updating nonexistent chapter
- Settings persistence round-trip through localStorage

**Approach:** Extract the reducer function and test it directly with state + action assertions, without rendering React components.

---

### Tier 2: Business Logic (High Risk)

#### 5. `src/lib/exportValidation.ts` (342 lines) — NO TESTS

Manuscript format validation rules engine. Incorrect validation misleads authors preparing submissions.

**Recommended tests:**
- Each validation rule produces correct pass/fail for known inputs
- Profile defaults are correct for each format (manuscript, ebook, screenplay)
- `hasValidationErrors()` correctly distinguishes errors from warnings
- Edge cases: empty chapters, extremely long paragraphs, no title page

#### 6. `src/lib/commands.ts` (200 lines) — NO TESTS

The command registry routes all keyboard shortcuts and menu actions.

**Recommended tests:**
- Every `COMMAND_ID` has a corresponding handler
- `runCommand()` dispatches to the correct handler
- Handler receives the correct context
- Unknown command ID fails gracefully

#### 7. `src/lib/settingsMigration.ts` (183 lines) — NO TESTS

Settings schema evolution. Migration failures break app boot.

**Recommended tests:**
- v1 → v2 migration preserves known fields
- Unknown version falls back to defaults
- Malformed JSON returns defaults without crashing
- `sanitizeSettings()` fixes out-of-range values

#### 8. `src/lib/progressTracker.ts` (137 lines) — NO TESTS

Writing streak and daily progress tracking.

**Recommended tests:**
- Recording daily words increments correctly
- Streak calculation: consecutive days, broken streak, resumed streak
- 90-day history trimming
- Date boundary edge cases (midnight, timezone)

**Approach:** Use `vi.useFakeTimers()` to control `Date.now()`.

#### 9. `src/lib/plugins.ts` (321 lines) — NO TESTS

Plugin lifecycle manager.

**Recommended tests:**
- `register()` / `unregister()` lifecycle
- `emit()` notifies all listeners in order
- `applyFilters()` chains transform functions correctly
- `createStorage()` sandboxes localStorage per plugin
- Error in one plugin handler doesn't crash others

#### 10. `src/lib/encryption.ts` (158 lines) — NO TESTS

AES-GCM encryption for sync — security-critical code with zero verification.

**Recommended tests:**
- Encrypt → decrypt round-trip produces original plaintext
- Different passwords produce different ciphertexts
- Tampered ciphertext fails decryption
- Empty input handling
- Key derivation consistency (same password + salt → same key)

**Approach:** Web Crypto API is available in Node 20+ via `globalThis.crypto` — no mocking needed.

---

### Tier 3: Supporting Modules (Medium Risk)

| Module | Lines | Recommended Tests |
|--------|------:|-------------------|
| `projectMetrics.ts` | 78 | Metric aggregation accuracy, empty chapter handling, status counting |
| `search.ts` | 94 | Unicode normalization (accents), snippet extraction boundaries, empty query, no matches |
| `exportHistory.ts` | 71 | Record creation, 50-record cap, deletion, localStorage round-trip |
| `translation.ts` | 275 | NLLB code validation, prompt building with various language pairs, invalid code handling |
| `adapters.ts` | 225 | Adapter registration/deregistration, capability querying, duplicate handling |

---

### Tier 4: Gaps in Existing Tests

Even tested modules have notable holes:

| Module | Gap |
|--------|-----|
| `utils.ts` | No Unicode/emoji tests; no abbreviation handling in `countSentences` ("Mr. Smith"); no `clamp(min > max)` |
| `import.test.ts` | No RTF, TXT, or Fountain parser coverage |
| `sync.test.ts` | No network error handling; no concurrent sync scenarios |
| `useAppKeyboardShortcuts.test.ts` | Only 3 of ~12 shortcuts; no Mac `metaKey` vs Windows `ctrlKey` |
| `AppContext.settings.test.tsx` | No reducer action tests; no theme switching; no autosave debounce |
| `export.screenplay.test.ts` | No malformed content tests; no page break handling |
| `sceneChemistry.test.ts` | Only 2 tests for a complex simulation; no value range assertions |
| `voiceFingerprint.test.ts` | No tests for similar speakers; no empty-profile handling |

---

## Recommended Priority Order

| Priority | Module | Risk if Untested | Effort |
|----------|--------|------------------|--------|
| **P0** | `storage.ts` | Data loss — all user content flows through here | Medium (mock Dexie) |
| **P0** | `export.ts` (DOCX/PDF/RTF) | Export corruption loses manuscripts | Medium-High |
| **P0** | `AppContext.tsx` reducer | State bugs cascade throughout the app | Medium |
| **P1** | `import.ts` (RTF/TXT parsers) | Import failures corrupt structure | Medium |
| **P1** | `exportValidation.ts` | Misleading submission guidance | Low |
| **P1** | `commands.ts` | Shortcuts and menus break silently | Low |
| **P1** | `settingsMigration.ts` | App boot failures | Low |
| **P2** | `progressTracker.ts` | Streak/goal tracking inaccuracy | Low |
| **P2** | `plugins.ts` | Plugin crashes take down the app | Medium |
| **P2** | `encryption.ts` | Security-critical with no verification | Low |
| **P2** | `search.ts` | Quick Switcher search broken | Low |
| **P3** | `projectMetrics.ts` | Dashboard inaccuracy | Low |
| **P3** | `exportHistory.ts` | Minor feature | Low |
| **P3** | `translation.ts` | Language code validation | Low |
| **P3** | Existing test gaps (Tier 4) | Edge cases and regressions | Low-Medium |

---

## Quick Wins (High Value, Low Effort)

These modules are pure functions with no external dependencies — ideal for fast test authoring:

1. **`exportValidation.ts`** — Rule evaluation is deterministic; test each rule with passing/failing input
2. **`projectMetrics.ts`** — Simple aggregation over arrays of chapters
3. **`search.ts`** — Pure string search and normalization
4. **`commands.ts`** — Verify handler registry completeness
5. **`progressTracker.ts`** — Date logic with `vi.useFakeTimers()`
6. **`exportHistory.ts`** — Simple localStorage CRUD with cap

---

## Infrastructure Recommendations

1. **Add `fake-indexeddb`** as a dev dependency to enable `storage.ts` testing
2. **Enable Vitest coverage reporting** (`vitest --coverage` with `@vitest/coverage-v8`) to track progress quantitatively
3. **Consider `@testing-library/react`** for component-level and context integration tests
4. **Add `npm run test` to CI** — the GitHub Actions `deploy.yml` runs `build` but not `test`; gating deploys on tests prevents regressions
5. **Create a fixtures directory** (`src/__fixtures__/`) for sample DOCX, RTF, TXT, and Fountain files shared across import tests
