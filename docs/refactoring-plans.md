# DraftHarbour Studio — Refactoring Plans

> Generated: 2026-03-13 | Branch: `claude/refactoring-plans-tqgG2`

---

## Executive Summary

The DraftHarbour Studio codebase (42,900+ lines across ~241 TS/TSX files) has grown organically and accumulated several areas of technical debt. This document identifies **10 refactoring initiatives** organized by impact and effort, with concrete file paths, line counts, and actionable steps.

**Top 3 priorities:**
1. Decompose monolithic modules (`export.ts`, `storage.ts`, `AIWritingModal`)
2. Consolidate scattered state and constants
3. Expand test coverage for critical untested modules

---

## Refactoring Initiatives at a Glance

| # | Initiative | Impact | Effort | Risk | Key Files |
|---|-----------|--------|--------|------|-----------|
| 1 | [Split export.ts](#1-split-exportts-into-modular-format-files) | High | Medium | Low | `src/lib/export.ts` (1,357 LOC) |
| 2 | [Split AIWritingModal](#2-decompose-aiwritingmodal) | High | Medium | Med | `src/components/Modals/AIWritingModal/index.tsx` (1,126 LOC) |
| 3 | [Redistribute storage.ts](#3-redistribute-storagets-to-modular-files) | High | Medium | Low | `src/lib/storage.ts` (1,001 LOC) |
| 4 | [Split SettingsWindow](#4-extract-settingswindow-tab-panels) | Med | Low | Low | `src/components/Windows/SettingsWindow.tsx` (987 LOC) |
| 5 | [Refactor state-heavy modals](#5-refactor-state-heavy-modals-to-usereducer) | High | High | Med | ExportModal, IntegrationsModal, AdvancedAnalyticsModal |
| 6 | [Organize types](#6-organize-typesindexts-by-domain) | Med | Med | Low | `src/types/index.ts` (571 LOC) |
| 7 | [Split AppContext actions](#7-decompose-appcontext-action-methods) | Med | High | High | `src/context/AppContext.tsx` (462 LOC) |
| 8 | [Consolidate constants](#8-consolidate-scattered-constants-and-presets) | Low | Low | Low | Multiple modals, toolbars |
| 9 | [Add missing test coverage](#9-add-missing-test-coverage) | High | High | Low | export, import, analysis modules |
| 10 | [Extract component responsibilities](#10-extract-multi-responsibility-components) | Med | Med | Med | Inspector, Toolbar, ScenePlanner |

---

## Detailed Plans

### 1. Split export.ts into Modular Format Files

**Current state:** `src/lib/export.ts` is a 1,357-line monolith containing 15 export functions + 15 helpers for DOCX, PDF, RTF, Fountain, Markdown, plaintext, publishing bundle, and screenplay PDF.

**Target state:** The modular directory `src/lib/export/` already exists with stub files. Move actual implementations there.

**Steps:**
- [ ] Move DOCX logic to `src/lib/export/manuscriptDocx.ts`
- [ ] Move PDF logic to `src/lib/export/pdf.ts`
- [ ] Move RTF logic to `src/lib/export/rtf.ts`
- [ ] Move Fountain logic to `src/lib/export/fountain.ts`
- [ ] Move screenplay export logic to `src/lib/export/screenplay.ts`
- [ ] Move shared helpers (HTML-to-text, chapter gathering, validation) to `src/lib/export/shared.ts`
- [ ] Update `src/lib/export/types.ts` with extracted type definitions
- [ ] Update barrel `src/lib/export/index.ts` to re-export all public functions
- [ ] Update all import sites (ExportModal, App.tsx, commands.ts)
- [ ] Verify no circular dependencies introduced
- [ ] Run `npm run lint && npm run typecheck && npm run test`

**Estimated file sizes after split:** 150–250 LOC each (from 1,357 total)

---

### 2. Decompose AIWritingModal

**Current state:** `src/components/Modals/AIWritingModal/index.tsx` is 1,126 lines with ~14 `useState` calls, managing provider config, prompt templates, pipeline execution, streaming responses, and configuration persistence all in one component.

**Target state:** Break into focused sub-components with clear responsibilities.

**Steps:**
- [ ] Extract `AIProviderSelector.tsx` — provider dropdown, endpoint config, BYOK input, connection testing
- [ ] Extract `AIPromptBuilder.tsx` — preset prompts (book + screenplay), custom prompt input, context injection
- [ ] Extract `AIPipelineStages.tsx` — pipeline mode selection, stage configuration, tone-matching
- [ ] Extract `AIResponseViewer.tsx` — streaming response display, accept/reject/edit controls
- [ ] Create `useAIModalState.ts` hook using `useReducer` to replace scattered `useState` calls
- [ ] Keep `index.tsx` as orchestrator (~150 LOC) composing sub-components
- [ ] Create `AIWritingModal.types.ts` for shared types within the modal
- [ ] Update CSS module if needed (or create per-component CSS modules)
- [ ] Smoke test all AI provider flows manually

**Risk:** Prop drilling — mitigate with the shared `useReducer` hook or a local context.

---

### 3. Redistribute storage.ts to Modular Files

**Current state:** `src/lib/storage.ts` is 1,001 lines. The modular structure exists (`storage/db.ts`, `storage/chapters.ts`, `storage/novels.ts`, `storage/snapshots.ts`, `storage/migrations.ts`) but these are tiny stubs — all logic lives in the monolith.

**Target state:** Move implementations into the modular files that already exist.

**Steps:**
- [ ] Move Dexie DB initialization and schema to `storage/db.ts`
- [ ] Move Novel CRUD operations to `storage/novels.ts`
- [ ] Move Chapter CRUD operations to `storage/chapters.ts`
- [ ] Move Snapshot CRUD operations to `storage/snapshots.ts`
- [ ] Move schema migrations to `storage/migrations.ts`
- [ ] Move backup/restore logic to new `storage/backup.ts`
- [ ] Move data-merge logic to new `storage/merge.ts`
- [ ] Update `storage.ts` to become a barrel re-export (or remove and update imports directly)
- [ ] Update all import sites across the codebase
- [ ] Run existing `storage.coverage.test.ts` (821 LOC) to verify no regressions
- [ ] Run `npm run ci`

**Risk:** Low — storage tests already exist and are comprehensive.

---

### 4. Extract SettingsWindow Tab Panels

**Current state:** `src/components/Windows/SettingsWindow.tsx` is 987 lines managing all settings categories in one component.

**Target state:** One component per settings tab.

**Steps:**
- [ ] Extract `TypographySettings.tsx` — font, size, line height, margins
- [ ] Extract `AutosaveSettings.tsx` — debounce interval, backup frequency
- [ ] Extract `AppearanceSettings.tsx` — theme, sidebar position, focus mode
- [ ] Extract `IntegrationSettings.tsx` — cloud sync provider configuration
- [ ] Extract `AISettings.tsx` — AI provider preferences, API keys
- [ ] Extract `KeyboardShortcutSettings.tsx` — shortcut customization
- [ ] Keep `SettingsWindow.tsx` as tab container (~100 LOC)
- [ ] Run `npm run lint && npm run typecheck`

---

### 5. Refactor State-Heavy Modals to useReducer

**Current state:** Several modals use excessive `useState` calls for related state:
- `ExportModal.tsx` (754 LOC) — ~32 `useState` calls
- `IntegrationsModal.tsx` (841 LOC) — ~14 `useState` calls
- `AdvancedAnalyticsModal.tsx` (895 LOC) — multiple analysis result states

**Target state:** Group related state into `useReducer` blocks.

**Steps:**

#### ExportModal
- [ ] Create `useExportState` reducer grouping: format, profile, locale, chapter selection, validation errors, progress
- [ ] Extract format-specific option panels (`DocxOptions`, `PdfOptions`, `FountainOptions`)
- [ ] Extract chapter selector component
- [ ] Extract validation display component

#### IntegrationsModal
- [ ] Extract `ScrivenerPanel.tsx` — file import/export for Scrivener
- [ ] Extract `GoogleDrivePanel.tsx` — OAuth flow, sync status, conflict resolution
- [ ] Extract `DropboxPanel.tsx` — OAuth flow, sync status, conflict resolution
- [ ] Create `useIntegrationState` reducer per provider

#### AdvancedAnalyticsModal
- [ ] Extract tab-specific components: `TimelineTab`, `ContinuityTab`, `NarrativeWeatherTab`, `VoiceAnalysisTab`, `SceneChemistryTab`
- [ ] Each tab manages its own analysis state independently

---

### 6. Organize types/index.ts by Domain

**Current state:** `src/types/index.ts` is 571 lines with 40+ exported types in a single file with no logical grouping.

**Target state:** Domain-organized type files with a barrel re-export.

**Proposed structure:**
```
src/types/
├── models.ts         # Novel, Chapter, Scene, Project (~100 LOC)
├── export.ts         # ExportFormat, ManuscriptExportOptions, ExportProfile (~80 LOC)
├── ai.ts             # AIProviderConfig, AIRevision, AvailabilityStatus (~60 LOC)
├── integrations.ts   # IntegrationConfig, SyncConfig, ConflictInfo (~60 LOC)
├── settings.ts       # AppSettings, TypographySettings, GoalConfiguration (~80 LOC)
├── analysis.ts       # VoiceSimilarityAlert, TimelineParadox, SceneSimulation (~70 LOC)
├── editor.ts         # Editor-specific types (~40 LOC)
├── ui.ts             # Modal/panel-specific types (~40 LOC)
└── index.ts          # Barrel re-export (~20 LOC)
```

**Steps:**
- [ ] Create domain-specific type files
- [ ] Move types to appropriate files (maintain all exports)
- [ ] Create barrel `index.ts` that re-exports everything
- [ ] Existing `import type { X } from '@/types'` should continue to work
- [ ] Run `npm run typecheck` to verify no breakage
- [ ] Update `import type` statements to use specific files where beneficial (optional)

---

### 7. Decompose AppContext Action Methods

**Current state:** `src/context/AppContext.tsx` (462 LOC) exposes 26+ action methods in a massive `useMemo` block. Manual undo/redo stacks via `useRef` arrays. Some state logic lives outside the reducer (e.g., scene creation).

**Target state:** Focused action hooks grouped by domain.

**Steps:**
- [ ] Extract `useChapterActions` hook — createChapter, deleteChapter, updateChapter, reorderChapters
- [ ] Extract `useSceneActions` hook — addScene, updateScene, deleteScene, reorderScenes
- [ ] Extract `useSettingsActions` hook — updateSettings, settings persistence
- [ ] Extract `useUndoRedo` hook — encapsulate reorder undo/redo stack logic
- [ ] Move scene creation logic from AppContext into the reducer for consistency
- [ ] Keep AppContext as a thin composition layer that combines these hooks
- [ ] Ensure `useApp()` continues to work (backwards compatible)

**Risk:** High — AppContext is the heart of the app. Needs careful incremental migration.

**Mitigation:** Use the "strangler fig" pattern — new hooks wrap existing logic, gradually move callers.

---

### 8. Consolidate Scattered Constants and Presets

**Current state:** Preset arrays and option constants are scattered:
- `ExportModal.tsx` — `EXPORT_PRESETS` (12+ objects)
- `AIWritingModal.tsx` — `BOOK_PRESET_PROMPTS`, `SCREENPLAY_PRESET_PROMPTS`, `ENDPOINT_PRESETS`
- `Inspector.tsx` — `STATUS_OPTIONS`
- `Toolbar.tsx` — `STYLE_OPTIONS`, `LINE_SPACING_OPTIONS`, `FONT_FAMILY_OPTIONS`
- Multiple files — localStorage key strings

**Steps:**
- [ ] Create `src/lib/constants/storageKeys.ts` — all `draftharbour_*` localStorage keys
- [ ] Create `src/lib/constants/statusOptions.ts` — chapter status values
- [ ] Create `src/lib/constants/editorOptions.ts` — font families, line spacing, styles
- [ ] Create `src/lib/constants/index.ts` — barrel export
- [ ] Update import sites
- [ ] Run `npm run lint && npm run typecheck`

---

### 9. Add Missing Test Coverage

**Current state:** 78 test files exist, but critical modules lack coverage:

| Module | LOC | Has Tests? | Priority |
|--------|-----|-----------|----------|
| `src/lib/export.ts` | 1,357 | No | **Critical** |
| `src/lib/import.ts` | 498 | Partial (`import.test.ts` exists) | High |
| `src/lib/voiceFingerprint.ts` | ~200 | No | Medium |
| `src/lib/narrativeWeather.ts` | ~200 | No | Medium |
| `src/lib/sceneChemistry.ts` | ~200 | No | Medium |
| `src/lib/continuityMemory.ts` | ~200 | No | Medium |
| `src/lib/timelineConsistency.ts` | 380 | Yes | OK |
| `src/context/AppContext.tsx` | 462 | No (only reducer tested) | High |
| `src/lib/plugins.ts` | 325 | No | Medium |

**Steps:**
- [ ] Write unit tests for each export format in `export.ts` (or per-module after split)
- [ ] Expand import tests to cover DOCX, RTF, Fountain parsing edge cases
- [ ] Write tests for writing analysis modules (voiceFingerprint, narrativeWeather, sceneChemistry, continuityMemory)
- [ ] Write integration tests for AppContext action methods
- [ ] Write tests for plugin system
- [ ] Target: 50%+ coverage on all modified files (per CI requirement)

---

### 10. Extract Multi-Responsibility Components

**Current state:** Several components handle 5+ distinct responsibilities:

| Component | LOC | Responsibilities |
|-----------|-----|-----------------|
| `Inspector.tsx` | 579 | Metadata, scenes, analysis, timeline, continuity, voice alerts |
| `Toolbar.tsx` | 569 | Formatting, styles, fonts, spacing, screenplay types, mobile menu |
| `ScenePlanner.tsx` | 509 | Scene list, CRUD, expand/collapse, conflict types, simulation |
| `QuickSwitcher.tsx` | 499 | Search, chapter navigation, command palette, action execution |

**Steps:**

#### Inspector
- [ ] Extract `InspectorMetadata.tsx` — title, POV, status, tags, summary editing
- [ ] Extract `InspectorScenes.tsx` — scene list, add/edit/delete/reorder
- [ ] Extract `InspectorAnalytics.tsx` — word count, readability, narrative weather
- [ ] Extract `InspectorTimeline.tsx` — timeline consistency display

#### Toolbar
- [ ] Extract `FormattingButtons.tsx` — bold, italic, underline, strikethrough
- [ ] Extract `StyleSelector.tsx` — paragraph style / heading level dropdown
- [ ] Extract `ScreenplayTypeSelector.tsx` — screenplay-specific type dropdown

#### ScenePlanner
- [ ] Extract `SceneListItem.tsx` — individual scene card with expand/collapse
- [ ] Extract `SceneSimulationPanel.tsx` — reorder suggestions and simulation

---

## Suggested Execution Order

```
Phase 1 — Quick Wins (1-2 days each)
├── Initiative 8: Consolidate constants
├── Initiative 4: Split SettingsWindow tabs
└── Initiative 10: Extract component responsibilities (Toolbar first)

Phase 2 — Core Decomposition (2-3 days each)
├── Initiative 1: Split export.ts ← highest ROI
├── Initiative 3: Redistribute storage.ts
└── Initiative 6: Organize types

Phase 3 — Complex Refactors (3-5 days each)
├── Initiative 2: Decompose AIWritingModal
├── Initiative 5: Refactor state-heavy modals
└── Initiative 7: Decompose AppContext

Phase 4 — Quality & Coverage (ongoing)
└── Initiative 9: Add missing test coverage
```

---

## Guiding Principles

1. **One PR per initiative** — keep changes reviewable
2. **No behavior changes** — refactoring only, same functionality
3. **Green CI at every step** — `npm run ci` must pass after each change
4. **Backwards-compatible imports** — barrel re-exports preserve existing import paths
5. **Incremental migration** — don't try to refactor everything at once
6. **Test before and after** — run existing tests, add new ones for untested code

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking existing imports | Medium | High | Use barrel re-exports; run typecheck after every move |
| Introducing circular deps | Low | High | Use dependency graph tools; keep data flow unidirectional |
| AppContext refactor breaks state | Medium | Critical | Strangler fig pattern; comprehensive test coverage first |
| CSS Module scope changes | Low | Medium | Keep original class names; test visual output |
| Storage migration regression | Low | Critical | Existing 821-line test suite; run full coverage suite |

---

*This document should be treated as a living plan. Update checkboxes as work progresses. Each initiative can be executed independently.*
