# CLAUDE.md - AI Assistant Guide for DraftHarbour Studio

## Project Overview

DraftHarbour Studio is an **offline-first Progressive Web Application (PWA)** for writing novels and screenplays. It is a React + TypeScript application built with Vite, featuring rich text editing via Tiptap, chapter/scene management, multi-format export, AI writing assistance, and optional cloud sync integrations.

**Key characteristics:**
- React 19 + TypeScript with Vite build tooling
- Tiptap 2 (ProseMirror) rich text editor via `@tiptap/react`
- IndexedDB for local data persistence (Dexie ORM)
- Dual project types: **Book** and **Screenplay**
- CSS Modules for component-scoped styling
- PWA via `vite-plugin-pwa` + Workbox
- ~24,100 lines of source code across ~95 TypeScript/TSX and ~23 CSS files

## Architecture

```
Writer1/
├── index.html                  # Vite entry HTML (mounts #root)
├── vite.config.ts              # Vite + React + PWA plugin config
├── tsconfig.json               # TypeScript config (strict, ES2022, @/* alias)
├── eslint.config.js            # ESLint flat config (typescript-eslint + react-hooks)
├── package.json                # npm deps, scripts
├── public/                     # Static assets served as-is
│   ├── assets/                 # PWA icons, branding images
│   ├── brand/                  # Logo SVGs
│   └── CNAME                   # GitHub Pages custom domain
├── src/
│   ├── main.tsx                # React entry point, StrictMode mount
│   ├── App.tsx                 # Root component: editor setup, keyboard shortcuts, layout
│   ├── App.module.css          # Root layout styles
│   ├── styles/index.css        # Global CSS: reset, design tokens, themes
│   ├── types/index.ts          # All TypeScript interfaces and type aliases
│   ├── context/AppContext.tsx   # React Context + useReducer state management
│   ├── declarations.d.ts       # CSS module type declarations
│   ├── vite-env.d.ts           # Vite client types
│   ├── hooks/
│   │   ├── useModalState.ts    # Modal open/close/toggle reducer
│   │   └── useResizable.ts     # Draggable panel resize hook
│   ├── components/
│   │   ├── Editor/             # Tiptap editor wrapper, screenplay extension
│   │   ├── FindReplace/        # In-editor find & replace (Ctrl+F/H)
│   │   ├── Header/             # Top header bar + formatting toolbar
│   │   ├── Inspector/          # Right panel: chapter metadata, stats
│   │   ├── Menu/               # Application menu bar
│   │   ├── Modals/             # 14 modal dialogs (export, settings, AI, etc.)
│   │   ├── Panels/             # AI suggestions sliding panel
│   │   ├── QuickSwitcher/      # Ctrl+K quick chapter/action/search switcher
│   │   ├── Sidebar/            # Left panel: chapter list, outline, scene planner
│   │   ├── UI/                 # Shared primitives: Button, Dialog, Input, Pill, Toast, Tooltip
│   │   ├── Windows/            # Settings and About floating windows
│   │   └── ErrorBoundary.tsx   # Top-level React error boundary
│   ├── lib/
│   │   ├── storage.ts          # Dexie DB schema, CRUD for novels/chapters/snapshots
│   │   ├── commands.ts         # Typed command registry (COMMAND_IDS + handlers)
│   │   ├── export.ts           # DOCX, PDF, screenplay PDF, RTF, Fountain export
│   │   ├── import.ts           # DOCX, RTF, TXT, Fountain import with chapter detection
│   │   ├── utils.ts            # Text analysis, word count, Flesch score, debounce, IDs
│   │   ├── search.ts           # Content search for quick switcher
│   │   ├── adapters.ts         # Data shape adapters between formats
│   │   ├── encryption.ts       # AES-GCM encryption helpers for sync
│   │   ├── exportHistory.ts    # Export history tracking
│   │   ├── findReplaceExtension.ts  # Tiptap ProseMirror find/replace plugin
│   │   ├── plugins.ts          # Plugin system manifest + hooks
│   │   ├── progressTracker.ts  # Daily word goal and progress tracking
│   │   ├── projectMetrics.ts   # Novel/project-level metrics computation
│   │   ├── telemetry.ts        # Privacy-respecting usage telemetry
│   │   ├── ai/                 # AI provider abstraction (Chrome AI, OpenAI)
│   │   └── integrations/       # Cloud sync: Dropbox, Google Drive, Scrivener
│   └── assets/                 # Imported assets (icons, images)
└── .github/workflows/
    ├── deploy.yml              # Deploy to GitHub Pages (npm ci → build → deploy)
    └── build-static-zip.yml    # Build dist/ and upload ZIP artifact
```

## Technology Stack

| Category | Technology | Version |
|----------|------------|---------|
| UI Framework | React | 19.x |
| Language | TypeScript | ~5.6 |
| Build Tool | Vite | 6.x |
| Editor | Tiptap (ProseMirror) via `@tiptap/react` | 2.11.5 |
| Database | Dexie (IndexedDB) | 4.0.8 |
| Export | docx, pdfmake, built-in RTF/Fountain | 9.5.0 / 0.2.10 |
| Import | jszip (DOCX), custom RTF/TXT/Fountain parsers | 3.10.1 |
| Testing | Vitest | 4.x |
| Linting | ESLint (flat config) + typescript-eslint | 9.x |
| PWA | vite-plugin-pwa + Workbox | 0.21.x |
| Icons | Material Symbols Rounded (Google Fonts CDN) | — |

## Development Workflow

### Setup
```bash
npm install
```

### Scripts
```bash
npm run dev          # Vite dev server with HMR
npm run build        # TypeScript check + Vite production build → dist/
npm run preview      # Preview production build locally
npm run lint         # ESLint across all .ts/.tsx files
npm run typecheck    # TypeScript --noEmit type checking only
npm run test         # Vitest test runner (single run)
```

### Path Aliases
TypeScript and Vite are configured with `@/*` → `src/*`:
```typescript
import { useApp } from '@/context/AppContext';
import type { Chapter } from '@/types';
```

### PWA During Development
The PWA service worker is auto-registered by `vite-plugin-pwa`. During development, Workbox manages caching. If stale caches cause issues, clear Application → Cache Storage in DevTools.

## State Management

### AppContext (React Context + useReducer)
All application state lives in `src/context/AppContext.tsx`:

```typescript
interface AppState {
  projectType: 'book' | 'screenplay';
  novelId: string;
  novelTitle: string;
  chapters: Chapter[];
  activeChapterId: string | null;
  isOnline: boolean;
  isSaving: boolean;
  settings: AppSettings;
}
```

The `AppProvider` component exposes:
- `state` and `dispatch` for the reducer
- Action methods: `loadNovel`, `createChapter`, `deleteChapter`, `updateChapter`, `reorderChapters`, `setActiveChapter`, etc.
- Scene CRUD: `addScene`, `updateScene`, `deleteScene`, `reorderScenes`
- `updateSettings` for persisting settings to localStorage

Access via the `useApp()` hook:
```typescript
const { state, activeChapter, createChapter, dispatch } = useApp();
```

### Settings Persistence
- **localStorage** (`draftharbour_settings_v1`): App settings, theme, typography prefs, goal trends, comment threads
- **IndexedDB** (`DraftHarbourDB`): Novels, chapters (with content), snapshots

### Command System
All UI actions go through a typed command registry in `src/lib/commands.ts`:
```typescript
import { COMMAND_IDS, runCommand } from '@/lib/commands';
runCommand(COMMAND_IDS.NEW_CHAPTER, context);
```

## Data Schema (IndexedDB via Dexie)

```typescript
// Database: DraftHarbourDB — version 3
db.version(3).stores({
  novels: 'id, title, projectType, updatedAt',
  chapters: 'id, novelId, order, title, updatedAt',
  snapshots: 'id, chapterId, createdAt'
});
```

### Chapter structure:
```typescript
interface Chapter {
  id: string;              // crypto.randomUUID()
  novelId: string;         // FK to novel
  order: number;           // Display order
  title: string;
  updatedAt: number;       // Timestamp
  content: JSONContent | null;  // Tiptap JSON document
  summary: string;
  pov: string;             // Point-of-view character
  status: 'planned' | 'draft' | 'revised' | 'final';
  tags: string[];
  wordGoal: number;
  scenes: Scene[];         // Sub-scenes within chapter
  act?: number;            // Screenplay act number
  sequence?: number;       // Screenplay sequence
  sync?: ChapterSyncMetadata;
}
```

### Comment threads:
Stored in localStorage (keyed by chapter ID), not IndexedDB. Each thread anchors to a text range in the editor content.

## Key Patterns

### Component Structure
Each component directory follows the pattern:
```
ComponentName/
├── ComponentName.tsx          # React component
├── ComponentName.module.css   # Scoped CSS Module
└── index.ts                   # Re-export barrel
```

### CSS Modules
All component styles use CSS Modules (`.module.css`) imported as `styles`:
```typescript
import styles from './Editor.module.css';
<div className={styles.editor}>
```

Global styles and design tokens live in `src/styles/index.css`.

### Theming
Three themes controlled via `data-theme` attribute on `<html>`:
- `light` (warm editorial paper — default)
- `dark`
- `high-contrast`

Design tokens use CSS custom properties (`--bg`, `--text`, `--accent`, etc.) defined per theme in `src/styles/index.css`.

### Modal Management
Modals use `useModalState` hook (reducer-based):
```typescript
const { modals, openModal, closeModal, toggleModal } = useModalState();
```

Adding a new modal:
1. Add key to `ModalKey` in `src/hooks/useModalState.ts`
2. Add initial state entry
3. Create modal component in `src/components/Modals/`
4. Wire up in `App.tsx`

### Editor Extensions
The Tiptap editor is configured in `App.tsx` with:
- `StarterKit` (headings H1/H2, lists, blockquote, etc.)
- `ScreenplayParagraph` — custom paragraph node with `screenplayType` attribute for screenplay mode
- `Underline`, `HorizontalRule`
- `CommentAnchorMark` — inline mark for comment thread anchors
- `FindReplaceExtension` — ProseMirror plugin for in-editor search

### Keyboard Shortcuts
Global shortcuts in `App.tsx`:
| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+F` | Find |
| `Ctrl/Cmd+H` | Find & Replace |
| `Ctrl/Cmd+K` | Quick Switcher |
| `Ctrl/Cmd+Shift+N` | New Chapter |
| `Ctrl/Cmd+Shift+E` | Export |
| `Ctrl/Cmd+Shift+B` | Toggle Sidebar |
| `Ctrl/Cmd+Shift+F` | Toggle Focus Mode |
| `Ctrl/Cmd+Shift+I` | Toggle Inspector |
| `Ctrl/Cmd+Shift+M` | Add Comment |
| `Escape` | Exit Focus Mode |

### Lazy Loading
Export libraries are imported on-demand inside export functions:
```typescript
const docx = await import('docx');
const pdfMake = await import('pdfmake/build/pdfmake.min.js');
```

### Autosave
Chapter content changes are debounced (default 800ms) before writing to IndexedDB. The debounce interval is configurable via settings.

## Testing

### Framework: Vitest
```bash
npm run test         # Run all tests once
```

### Test Files
Test files are co-located with source using `.test.ts` suffix:
- `src/lib/utils.test.ts` — utility function tests
- `src/lib/export.screenplay.test.ts` — screenplay export tests
- `src/lib/import.screenplay.test.ts` — screenplay import tests
- `src/lib/integrations/sync.test.ts` — sync integration tests

### Manual Testing
For UI features without automated tests, test in browser:
- **Application tab**: Inspect IndexedDB, Service Worker, localStorage
- **Console**: Check for runtime errors
- **Network tab**: Verify asset loading

## Common Tasks

### Adding a New Feature
1. Identify which files need modification
2. Add TypeScript types in `src/types/index.ts` if needed
3. Add UI component in `src/components/` with CSS Module
4. Add business logic in `src/lib/`
5. Wire into `App.tsx` or relevant parent component
6. If persisted, update `src/lib/storage.ts` schema/operations
7. Run `npm run lint && npm run typecheck` to verify

### Adding a New Modal
1. Add key to `ModalKey` in `src/hooks/useModalState.ts`
2. Add `false` default in `initialState` record
3. Create `src/components/Modals/MyModal.tsx`
4. Export from `src/components/Modals/index.ts`
5. Add command ID in `src/lib/commands.ts` if menu-accessible
6. Render in `App.tsx`

### Adding a New Command
1. Add constant to `COMMAND_IDS` in `src/lib/commands.ts`
2. Add handler to `COMMAND_HANDLERS` record
3. Wire into `CommandContext` interface if it needs new dependencies

### Adding Storage Fields
1. Add field to type in `src/types/index.ts`
2. Update `createChapter()` or `createNovel()` in `src/lib/storage.ts`
3. Handle in relevant components

### Adding Export Formats
1. Add format to `ExportFormat` type in `src/types/index.ts`
2. Implement export function in `src/lib/export.ts` (lazy-load heavy deps)
3. Add option in `src/components/Modals/ExportModal.tsx`

### Adding Import Formats
1. Add parser function in `src/lib/import.ts`
2. Update accepted file extensions in `App.tsx` file input

## AI Integration

Two provider types in `src/lib/ai/`:
- **Chrome AI** (`chromeAI.ts`): Uses the browser-native `window.ai` API (Chrome Canary/Dev)
- **OpenAI** (`openaiProvider.ts`): Uses OpenAI-compatible API endpoints

Provider management via `providerManager.ts`: auto-detects best available provider, persists config to localStorage.

## Cloud Integrations

Located in `src/lib/integrations/`:
- **Dropbox** (`dropbox.ts`): OAuth2 file sync
- **Google Drive** (`googleDrive.ts`): OAuth2 file sync
- **Scrivener** (`scrivener.ts`): Project file import/export
- **Sync engine** (`sync.ts`): Bidirectional sync with conflict detection
- **Orchestration** (`orchestration.ts`): Coordinates multi-provider sync

## Project Types

The app supports two project modes:
- **Book**: Chapters with prose content, traditional export formats
- **Screenplay**: Scenes with screenplay-typed paragraphs (scene-heading, action, character, dialogue, parenthetical, transition), Fountain format support, screenplay PDF export

The `projectType` field is stored on the novel and affects chapter creation, editor behavior, export options, and UI labels.

## CI/CD

### GitHub Actions
- **deploy.yml**: On push to `main` → `npm ci` → `npm run build` → deploy `dist/` to GitHub Pages
- **build-static-zip.yml**: On push to `main` → build → create ZIP artifact for cPanel deployment

Both use Node.js 20.

## Git Conventions

### Branch Naming
- Feature branches: `claude/feature-name-sessionId` or `codex/feature-name`
- Always create from main branch

### Commit Messages
- Short, descriptive summary in present tense ("Add feature" not "Added feature")
- Reference issue numbers if applicable

## Security Considerations

- All data stored locally by default (IndexedDB + localStorage)
- No tracking or analytics beyond optional privacy-respecting telemetry
- AES-GCM encryption available for sync data (`src/lib/encryption.ts`)
- Optional cloud sync requires explicit user configuration
- User-provided content in exports is escaped to prevent injection
- HTML escaping utility in `src/lib/utils.ts` (`escapeHtml`)

## Quick Reference

| Task | Location |
|------|----------|
| Add/modify types | `src/types/index.ts` |
| App state management | `src/context/AppContext.tsx` |
| Data persistence | `src/lib/storage.ts` |
| Command registry | `src/lib/commands.ts` |
| Editor config | `src/App.tsx` (extensions), `src/components/Editor/` |
| Export formats | `src/lib/export.ts` |
| Import formats | `src/lib/import.ts` |
| UI components | `src/components/` (each in own directory) |
| Shared UI primitives | `src/components/UI/` |
| Global styles & tokens | `src/styles/index.css` |
| AI providers | `src/lib/ai/` |
| Cloud integrations | `src/lib/integrations/` |
| Tests | Co-located `*.test.ts` files, run with `npm run test` |
| Build config | `vite.config.ts` |
| TypeScript config | `tsconfig.json` |
| Linting | `eslint.config.js` |
| CI/CD | `.github/workflows/` |
