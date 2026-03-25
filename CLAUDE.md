# CLAUDE.md — DraftHarbour Studio

## Project Overview

Offline-first PWA for writing novels and screenplays. React 19 + TypeScript + Vite, with CodeMirror 6 editor, IndexedDB persistence (Dexie), multi-format export, AI writing assistance, and optional cloud sync. Also ships as Tauri 2 desktop app and Capacitor 8 iOS app.

Two project modes: **Book** (chapters with prose) and **Screenplay** (Fountain format scenes).

## Stack

| Layer | Tech |
|-------|------|
| UI | React 19, TypeScript ~5.6, Vite 6 |
| Editor | CodeMirror 6 (`@codemirror/*`) — Markdown content storage |
| Database | Dexie 4 (IndexedDB) |
| Styling | CSS Modules + Tailwind CSS 4 |
| Testing | Vitest 4, jsdom, @vitest/coverage-v8 |
| Linting | ESLint 9 (flat config) + typescript-eslint, Husky + lint-staged |
| Export | docx, pdfmake, built-in RTF/Fountain |
| Desktop | Tauri 2 |
| Mobile | Capacitor 8 (iOS) |
| PWA | vite-plugin-pwa + Workbox |

## Key Directories

```
src/
├── types/index.ts          # All TypeScript interfaces
├── context/                # AppContext (React Context + useReducer)
│   ├── AppContext.tsx       # Provider: state, dispatch, action methods
│   ├── state/appReducer.ts # Pure reducer
│   └── services/           # Side-effect services (storage, workspace)
├── components/             # UI — each in own dir with .tsx + .module.css + index.ts
│   ├── Editor/             # CodeMirror wrapper
│   ├── Modals/             # Modal dialogs (export, settings, AI, etc.)
│   ├── Sidebar/            # Chapter list, outline, scene planner
│   ├── Inspector/          # Right panel: chapter metadata, stats
│   └── UI/                 # Shared primitives (Button, Dialog, Input, Toast)
├── lib/
│   ├── commands.ts         # Typed command registry (COMMAND_IDS + handlers)
│   ├── utils.ts            # Text analysis, word count, IDs, debounce
│   ├── editor/             # CodeMirror adapter, extensions, markdown parsing
│   ├── storage/            # Dexie DB: db.ts, novels.ts, chapters.ts, snapshots.ts, migrations.ts
│   ├── export/             # Per-format modules: manuscriptDocx, pdf, rtf, fountain
│   ├── ai/                 # AI providers: chromeAI, openai, serverProxy, customLlm, fallback
│   └── integrations/       # Cloud sync: Dropbox, Google Drive, Scrivener
├── hooks/                  # ~15 custom hooks (modals, keyboard, panels, etc.)
└── App.tsx                 # Root component: editor init, keyboard shortcuts, layout
api/                        # PHP server proxy for AI/integrations
desktop/                    # Tauri desktop wrapper
ios/                        # Capacitor iOS project
scripts/                    # QA scripts (bundle size, coverage, test inventory)
```

## Commands

```bash
# Development
npm run dev              # Vite dev server
npm run build            # tsc + vite build → dist/
npm run preview          # Preview production build

# Quality checks
npm run lint             # ESLint (--max-warnings 0)
npm run typecheck        # tsc --noEmit
npm run test             # Vitest single run
npm run test:coverage    # Vitest with coverage

# Full CI (runs everything)
npm run ci               # lint → typecheck → verify:vite-config → test:coverage → build → bundle:check → assets:check

# Quick validation (use during development)
npm run lint && npm run typecheck    # Fast feedback loop
```

## Path Alias

`@/*` → `src/*` in both TypeScript and Vite:
```typescript
import { useApp } from '@/context/AppContext';
import type { Chapter } from '@/types';
```

## Coding Conventions

### TypeScript
- Strict mode enabled, `noUnusedLocals` and `noUnusedParameters` enforced
- All types/interfaces go in `src/types/index.ts`
- Prefix unused function params with `_` (ESLint rule: `argsIgnorePattern: '^_'`)
- Target ES2022; build target es2020 + safari14

### Components
- One component per directory: `ComponentName.tsx` + `ComponentName.module.css` + `index.ts` barrel
- Styles via CSS Modules imported as `styles`: `<div className={styles.editor}>`
- Tailwind available for utility classes; design tokens as CSS custom properties in `src/styles/index.css`
- Three themes: `light`, `dark`, `high-contrast` via `data-theme` on `<html>`

### State
- App state via `useApp()` hook from `src/context/AppContext.tsx`
- All UI actions route through command registry (`src/lib/commands.ts`)
- Modals use `useModalState` hook (reducer-based)

### Data Storage
- **IndexedDB** (Dexie): novels, chapters, snapshots
- **localStorage**: app settings (`draftharbour_settings_v1`), comment threads
- **Tauri keychain** (desktop only): sensitive credentials
- Chapter content stored as Markdown strings (migrated from Tiptap JSON in DB v4)
- Autosave: debounced 800ms writes to IndexedDB

### Performance
- Heavy export libs lazy-loaded: `const docx = await import('docx')`
- Vite manual chunks: `export`, `ai`, `integrations`, `codemirror`

## Testing

- ~105 test files co-located with source (`*.test.ts` / `*.test.tsx`)
- Test setup: `src/test/setup.ts` (stubs `window.matchMedia`)
- Environment: jsdom + fake-indexeddb
- Run `npm run test` before pushing; `npm run test:coverage` for coverage gate

## Adding Things

### New modal
1. Add key to `ModalKey` in `src/hooks/useModalState.ts` + `false` default
2. Create component in `src/components/Modals/`
3. Add command ID in `src/lib/commands.ts` if menu-accessible
4. Render in `App.tsx`

### New command
1. Add to `COMMAND_IDS` in `src/lib/commands.ts`
2. Add handler to `COMMAND_HANDLERS`

### New storage field
1. Add to type in `src/types/index.ts`
2. Update relevant module in `src/lib/storage/`
3. Add migration in `src/lib/storage/migrations.ts` if schema change needed

### New export format
1. Add to `ExportFormat` in `src/types/index.ts`
2. Create module in `src/lib/export/` (lazy-load heavy deps)
3. Add option in `src/components/Modals/ExportModal.tsx`

## Git & PR Conventions

- Branch naming: `claude/feature-name-sessionId` or `codex/feature-name`
- Commit messages: short, present tense ("Add feature", "Fix bug")
- Pre-commit hook: Husky + lint-staged runs ESLint on staged `.ts/.tsx` files
- PR checks: `.github/workflows/pr-check.yml` runs lint, typecheck, tests, build

## Do's

- Read files before modifying them
- Run `npm run lint && npm run typecheck` after changes for fast feedback
- Run `npm run test` before pushing
- Co-locate tests next to source files
- Use `@/*` path aliases for all imports from `src/`
- Use CSS Modules for component styles
- Lazy-load heavy libraries in export/AI code paths
- Add types to `src/types/index.ts`
- Use the command registry for new UI actions

## Don'ts

- Don't add new top-level state management — use AppContext
- Don't import export/AI libraries at top level (they're code-split)
- Don't store sensitive data in localStorage — use Tauri keychain on desktop
- Don't skip the pre-commit hook (`--no-verify`)
- Don't create standalone CSS files — use CSS Modules or Tailwind
- Don't add unused exports or dead code
- Don't modify DB schema without adding a migration
