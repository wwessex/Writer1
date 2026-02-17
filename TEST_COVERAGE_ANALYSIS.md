# Test Coverage Analysis

> **Maintenance note:** Update this document whenever a new test suite (`*.test.ts` / `*.test.tsx`) is added, renamed, or removed so the baseline inventory stays accurate.

## Current baseline

The repository is **not** at “0 tests / 0% coverage.” It already includes multiple Vitest suites under `src/lib`.

### Existing unit/integration-style tests already in repo

Generated inventory from current test files:

| Test file | `describe` blocks | `it` cases | Primary coverage area |
|---|---:|---:|---|
| `src/lib/utils.test.ts` | 10 | 34 | text/statistics utilities, editor text extraction, helper functions |
| `src/lib/import.screenplay.test.ts` | 1 | 3 | screenplay import parsing |
| `src/lib/export.screenplay.test.ts` | 1 | 6 | screenplay export formatting |
| `src/lib/integrations/sync.test.ts` | 5 | 21 | sync merge/conflict resolution logic |

**Baseline inventory totals:** **4** suites, **17** `describe` blocks, **64** `it` cases.

### Untested critical modules (high priority)

The following areas appear to have no direct colocated test suites yet and should be considered priority targets:

- `src/components/*` (UI/editor/interaction surface)
- `src/context/AppContext.tsx` (state container and app-wide orchestration)
- `src/lib/storage.ts` (persistence and data integrity)

## Recommended next steps

1. Add tests around `src/lib/storage.ts` first (data safety risk).
2. Add focused tests for `src/context/AppContext.tsx` behaviors (state transitions and side effects).
3. Add component-level tests for key UI flows in `src/components/*` (editor, sidebar, modals).
4. Keep this file synchronized with test-suite changes as part of PR hygiene.
