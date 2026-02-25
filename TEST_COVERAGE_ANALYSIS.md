# Test Coverage Analysis

> **Maintenance note:** Run `npm run test:inventory` and paste the output table/totals into this document whenever a new suite (`*.test.ts` / `*.test.tsx`) is added, renamed, or removed.

## Current baseline

The repository is **not** at “0 tests / 0% coverage.” It currently includes tests across app shell, components, context, hooks, lib utilities/services, and server contracts.

### Existing unit/integration-style tests already in repo

Generated from `npm run test:inventory` (source-of-truth workflow):

| Test file | `describe` blocks | `it` cases |
|---|---:|---:|
| `src/App.test.tsx` | 1 | 1 |
| `src/components/AppShell/AppShell.test.tsx` | 1 | 3 |
| `src/components/Editor/Editor.persistence.test.tsx` | 1 | 1 |
| `src/components/Header/Header.test.tsx` | 1 | 1 |
| `src/components/Menu/MenuBar.test.tsx` | 1 | 1 |
| `src/components/Modals/AIWritingModal.test.tsx` | 1 | 1 |
| `src/components/Modals/ProjectsModal.test.tsx` | 1 | 1 |
| `src/context/AppContext.actions.test.tsx` | 1 | 1 |
| `src/context/AppContext.settings.test.tsx` | 1 | 3 |
| `src/context/state/appReducer.test.ts` | 1 | 2 |
| `src/hooks/useAppKeyboardShortcuts.test.ts` | 1 | 3 |
| `src/hooks/useCommentActions.test.ts` | 1 | 2 |
| `src/hooks/useDesktopRuntime.test.tsx` | 1 | 3 |
| `src/hooks/useEditorSelectionTracking.test.tsx` | 1 | 2 |
| `src/hooks/useFocusModeClass.test.tsx` | 1 | 1 |
| `src/hooks/useLoadNovel.test.tsx` | 1 | 2 |
| `src/hooks/useOnboardingTrigger.test.tsx` | 1 | 2 |
| `src/hooks/useVoiceAlerts.test.tsx` | 1 | 2 |
| `src/lib/commands.test.ts` | 1 | 3 |
| `src/lib/export.screenplay.test.ts` | 1 | 6 |
| `src/lib/highRisk.characterization.test.ts` | 1 | 3 |
| `src/lib/import.screenplay.test.ts` | 1 | 3 |
| `src/lib/import.test.ts` | 4 | 17 |
| `src/lib/integrations/sync.test.ts` | 5 | 21 |
| `src/lib/narrativeWeather.test.ts` | 2 | 4 |
| `src/lib/nativeMenuAdapter.test.ts` | 1 | 2 |
| `src/lib/sceneChemistry.test.ts` | 1 | 2 |
| `src/lib/storage.backup.test.ts` | 1 | 3 |
| `src/lib/storage.crud.test.ts` | 1 | 2 |
| `src/lib/timelineConsistency.test.ts` | 1 | 5 |
| `src/lib/updaterGuardrails.test.ts` | 1 | 3 |
| `src/lib/utils.test.ts` | 10 | 34 |
| `src/lib/voiceFingerprint.test.ts` | 1 | 3 |
| `src/server/integrationBroker.contract.test.ts` | 1 | 4 |

**Baseline inventory totals:** **34** suites, **51** `describe` blocks, **147** `it` cases.

## Untested critical modules (high priority)

Recently covered areas now include `AppContext`, multiple UI components/modals, and storage paths (`storage.crud` / `storage.backup`). Current high-priority gaps are concentrated in still-untested orchestration-heavy surfaces:

- `src/components/Sidebar/*.tsx` (chapter/outline/scene planning user flows)
- `src/components/Inspector/Inspector.tsx` and `src/components/Windows/*.tsx` (editing metadata and window workflows)
- `src/lib/export/*.ts` implementations beyond screenplay path (PDF/RTF/DOCX/fountain/manuscript boundary behavior)
- `src/lib/integrations/*.ts` provider clients/adapters (`dropbox`, `googleDrive`, OAuth, orchestration)
- `src/context/services/*.ts` (`appServices`, `workspaceService`) and persistence/integration wiring paths

## Recommended next steps

1. Add component interaction tests for sidebar/inspector workflows (high UX impact areas with no direct suites).
2. Add focused tests for export backends (`pdf.ts`, `rtf.ts`, `manuscriptDocx.ts`, `fountain.ts`) to protect output correctness.
3. Add targeted integration/provider tests for cloud sync adapters and auth workflow code paths.
4. Keep this file synchronized via `npm run test:inventory` as part of PR hygiene.
