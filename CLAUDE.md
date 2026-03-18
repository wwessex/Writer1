# CLAUDE.md - AI Assistant Guide for DraftHarbour Studio

## Project Overview

DraftHarbour Studio is an **offline-first Progressive Web Application (PWA)** for writing novels and screenplays, with cross-platform desktop (Tauri) and mobile (Capacitor/iOS) builds. It is a React + TypeScript application built with Vite, featuring rich text editing via CodeMirror 6, chapter/scene management, multi-format export, AI writing assistance, writing analysis tools, and optional cloud sync integrations.

**Key characteristics:**
- React 19 + TypeScript with Vite build tooling
- CodeMirror 6 rich text editor with Markdown-based content storage
- IndexedDB for local data persistence (Dexie ORM)
- Dual project types: **Book** and **Screenplay**
- CSS Modules + Tailwind CSS 4 for styling
- PWA via `vite-plugin-pwa` + Workbox
- Tauri 2 desktop app (macOS, Windows, Linux)
- Capacitor 8 mobile app (iOS)
- Server-side integration broker (PHP proxy + TypeScript handler)
- ~287 TypeScript/TSX files (including ~103 test files) and ~25 CSS files

## Architecture

```
Writer1/
├── index.html                  # Vite entry HTML (mounts #root)
├── vite.config.ts              # Vite + React + Tailwind + PWA plugin config
├── tsconfig.json               # TypeScript config (strict, ES2022, @/* alias)
├── eslint.config.js            # ESLint flat config (typescript-eslint + react-hooks)
├── capacitor.config.ts         # Capacitor mobile config (iOS)
├── package.json                # npm deps, scripts
├── public/                     # Static assets served as-is
│   ├── assets/                 # PWA icons, branding images
│   ├── brand/                  # Logo SVGs
│   └── CNAME                   # GitHub Pages custom domain
├── api/                        # PHP server proxy for AI/integrations
│   ├── index.php               # Entry point: CORS, routing, rate limiting
│   ├── _config.php             # API keys, rate limits, allowed origins
│   ├── _rateLimit.php          # Rate limiting implementation
│   └── _chatHandler.php        # AI chat request handler
├── desktop/                    # Tauri desktop application
│   ├── package.json            # Desktop build scripts
│   └── src-tauri/              # Rust source + Tauri config
│       ├── tauri.conf.json     # Bundle targets, signing, deep links
│       ├── src/main.rs         # Rust entry point
│       └── Cargo.toml          # Rust dependencies
├── ios/                        # Capacitor iOS project
│   └── App/                    # Xcode project (AppDelegate, storyboards)
├── llm/                        # LLM fine-tuning / training configs
│   └── Narratryx/              # Narratryx model configs, docs, scripts
├── scripts/                    # Build & QA scripts
│   ├── check-bundle-size.mjs   # Bundle size validation
│   ├── check-asset-duplicates.mjs
│   ├── check-touched-coverage.mjs
│   ├── test-inventory.mjs      # Test file organization check
│   ├── test-rate-limit.php     # Rate limiting integration test
│   ├── verify-vite-config.mjs
│   └── verify-release-artifacts.mjs
├── docs/                       # Operational documentation
│   ├── design-error-handling.md
│   ├── asset-audit.md
│   └── releases/              # Release checklists, runbooks, manifests
├── src/
│   ├── main.tsx                # React entry point, StrictMode mount
│   ├── App.tsx                 # Root component: editor setup, keyboard shortcuts, layout
│   ├── App.module.css          # Root layout styles
│   ├── styles/index.css        # Global CSS: reset, design tokens, themes
│   ├── types/index.ts          # All TypeScript interfaces and type aliases
│   ├── declarations.d.ts       # CSS module type declarations
│   ├── vite-env.d.ts           # Vite client types
│   ├── context/
│   │   ├── AppContext.tsx       # React Context provider (delegates to services/state)
│   │   ├── appSettings.ts      # Settings type definitions and defaults
│   │   ├── services/           # Side-effect services (storage, secrets)
│   │   │   ├── appServices.ts  # Novel/chapter loading, settings persistence
│   │   │   └── workspaceService.ts  # Workspace & last-opened tracking
│   │   └── state/
│   │       └── appReducer.ts   # Pure reducer for AppState
│   ├── hooks/
│   │   ├── useAppKeyboardShortcuts.ts  # Global keyboard shortcut handler
│   │   ├── useCommentActions.ts  # Comment CRUD actions
│   │   ├── useCrashRecovery.ts   # Crash recovery logic
│   │   ├── useDesktopRuntime.ts  # Tauri desktop runtime detection
│   │   ├── useDragReorder.ts     # Drag-and-drop reorder logic
│   │   ├── useEditorSelectionTracking.ts  # Editor selection state
│   │   ├── useFocusModeClass.ts  # Focus mode CSS class toggle
│   │   ├── useIsMobile.ts        # Mobile viewport detection
│   │   ├── useLoadNovel.ts       # Novel loading orchestration
│   │   ├── useModalAccessibility.ts  # Modal a11y (focus trap, etc.)
│   │   ├── useModalState.ts      # Modal open/close/toggle reducer
│   │   ├── useOnboardingTrigger.ts  # First-run onboarding trigger
│   │   ├── useProjectFileActions.ts  # File import/export actions
│   │   ├── useResizable.ts       # Draggable panel resize hook
│   │   ├── useResponsivePanels.ts  # Responsive panel visibility
│   │   └── useVoiceAlerts.ts     # Voice-related alert notifications
│   ├── server/
│   │   └── integrationBroker.ts  # Node.js/Lambda backend handler
│   ├── test/
│   │   └── setup.ts            # Vitest global setup (matchMedia stub)
│   ├── components/
│   │   ├── AppShell/           # Main layout grid component
│   │   ├── Editor/             # CodeMirror editor wrapper, screenplay extension
│   │   ├── FindReplace/        # In-editor find & replace (Ctrl+F/H)
│   │   ├── Header/             # Top header bar + formatting toolbar
│   │   ├── Inspector/          # Right panel: chapter metadata, stats
│   │   ├── Menu/               # Application menu bar
│   │   ├── Modals/             # Modal dialogs (export, settings, AI, etc.)
│   │   │   └── AIWritingModal/ # Multi-provider AI writing assistant
│   │   ├── Panels/             # AI suggestions sliding panel
│   │   ├── QuickSwitcher/      # Ctrl+K quick chapter/action/search switcher
│   │   ├── Sidebar/            # Left panel: chapter list, outline, scene planner
│   │   ├── UI/                 # Shared primitives: Button, Dialog, Input, Pill, Toast, Tooltip
│   │   ├── Windows/            # Settings and About floating windows
│   │   ├── layout/             # Layout sub-components (editor, inspector, sidebar)
│   │   ├── PanelErrorBoundary.tsx
│   │   └── ErrorBoundary.tsx   # Top-level React error boundary
│   ├── lib/
│   │   ├── commands.ts         # Typed command registry (COMMAND_IDS + handlers)
│   │   ├── utils.ts            # Text analysis, word count, Flesch score, debounce, IDs
│   │   ├── import.ts           # DOCX, RTF, TXT, Fountain import with chapter detection
│   │   ├── search.ts           # Content search for quick switcher
│   │   ├── adapters.ts         # Data shape adapters between formats
│   │   ├── encryption.ts       # AES-GCM encryption helpers for sync
│   │   ├── errors.ts           # Centralized error handling & sanitization
│   │   ├── exportHistory.ts    # Export history tracking
│   │   ├── exportValidation.ts # Post-export validation
│   │   ├── featureFlags.ts     # Runtime feature toggles (env-based)
│   │   ├── menuConfig.ts       # Menu bar configuration definitions
│   │   ├── plugins.ts          # Plugin system manifest + hooks
│   │   ├── policy.ts           # Managed settings policy enforcement
│   │   ├── progressTracker.ts  # Daily word goal and progress tracking
│   │   ├── projectMetrics.ts   # Novel/project-level metrics computation
│   │   ├── telemetry.ts        # Privacy-respecting usage telemetry
│   │   ├── nativeMenuAdapter.ts  # Tauri native menu ↔ React command bridge
│   │   ├── desktopSecrets.ts   # Tauri keychain secret storage
│   │   ├── desktopUpdater.ts   # Desktop auto-update (channels: stable/beta/nightly)
│   │   ├── secureCache.ts      # AES-GCM encrypted local caching
│   │   ├── aiRevisionLog.ts    # History of AI-assisted text revisions
│   │   ├── voiceFingerprint.ts # Character voice consistency analysis
│   │   ├── narrativeWeather.ts # Emotional tone & pacing tracking
│   │   ├── sceneChemistry.ts   # Scene dynamics & conflict analysis
│   │   ├── continuityMemory.ts # Continuity & consistency tracking
│   │   ├── settingsMigration.ts # Settings schema migration helpers
│   │   ├── storage.ts          # Legacy storage utilities
│   │   ├── storageKeys.ts      # Centralized localStorage key constants
│   │   ├── timelineConsistency.ts  # Timeline event ordering validation
│   │   ├── translation.ts      # i18n / translation utilities
│   │   ├── updaterGuardrails.ts  # Desktop updater safety checks
│   │   ├── editor/             # Editor abstraction layer
│   │   │   ├── EditorContext.tsx    # React context for editor state
│   │   │   ├── codemirrorAdapter.ts # CodeMirror ↔ app adapter
│   │   │   ├── commentExtension.ts  # Comment mark extension
│   │   │   ├── fountainExtension.ts # Fountain/screenplay editor extension
│   │   │   ├── jsonToMarkdown.ts    # Tiptap JSON → Markdown converter
│   │   │   ├── markdownParser.ts    # Markdown → editor document parser
│   │   │   ├── richPreviewExtension.ts  # Rich text preview extension
│   │   │   ├── theme.ts            # Editor theme configuration
│   │   │   ├── types.ts            # Editor type definitions
│   │   │   ├── typewriterExtension.ts  # Typewriter scroll mode extension
│   │   │   └── useCodeMirrorEditor.ts  # CodeMirror React hook
│   │   ├── fixtures/           # Test fixtures
│   │   │   ├── export/         # Export test data
│   │   │   └── import/         # Import test data
│   │   ├── storage/            # Modularized data persistence
│   │   │   ├── db.ts           # Dexie database instance
│   │   │   ├── novels.ts       # Novel CRUD
│   │   │   ├── chapters.ts     # Chapter CRUD
│   │   │   ├── snapshots.ts    # Snapshot CRUD
│   │   │   └── migrations.ts   # Schema migrations
│   │   ├── export/             # Modularized export system
│   │   │   ├── types.ts        # Export type definitions
│   │   │   ├── shared.ts       # Shared export utilities
│   │   │   ├── manuscriptDocx.ts  # DOCX manuscript export
│   │   │   ├── pdf.ts          # PDF export
│   │   │   ├── rtf.ts          # RTF export
│   │   │   ├── fountain.ts     # Fountain format export
│   │   │   ├── screenplay.ts   # Screenplay-specific export
│   │   │   └── boundary/       # External library adapters
│   │   │       ├── docxCompat.ts
│   │   │       └── pdfmake.ts
│   │   ├── ai/                 # AI provider abstraction
│   │   │   ├── chromeAI.ts     # Browser-native window.ai provider
│   │   │   ├── openaiProvider.ts  # OpenAI-compatible API provider
│   │   │   ├── serverProxyProvider.ts  # Server broker proxy provider
│   │   │   ├── customLlmProvider.ts  # Custom/self-hosted LLM provider
│   │   │   ├── fallbackProvider.ts   # Provider fallback chain logic
│   │   │   ├── providerManager.ts  # Provider auto-detection & config
│   │   │   ├── availability.ts # Runtime provider availability detection
│   │   │   ├── pipelines.ts    # Staged AI revision workflows
│   │   │   ├── evalFramework.ts  # AI output evaluation framework
│   │   │   ├── storyBible.ts   # Story bible context for AI prompts
│   │   │   ├── types.ts        # AI provider type definitions
│   │   │   └── index.ts        # Barrel re-exports
│   │   └── integrations/       # Cloud sync
│   │       ├── dropbox.ts      # Dropbox OAuth2 sync
│   │       ├── googleDrive.ts  # Google Drive OAuth2 sync
│   │       ├── dropboxDirect.ts   # Direct Dropbox API client
│   │       ├── googleDriveDirect.ts  # Direct Google Drive API client
│   │       ├── scrivener.ts    # Scrivener project import/export
│   │       ├── sync.ts         # Bidirectional sync with conflict detection
│   │       ├── orchestration.ts  # Multi-provider sync coordination
│   │       ├── api.ts          # Integration API client utilities
│   │       ├── brokerClient.ts # Client for server-side integration broker
│   │       ├── helpers.ts      # Integration helper utilities
│   │       ├── oauth.ts        # OAuth flow helpers
│   │       ├── providerClient.ts  # HTTP client with retry policy
│   │       ├── service.ts      # Integration service layer
│   │       ├── types.ts        # Integration type definitions
│   │       └── index.ts        # Barrel re-exports
│   └── assets/                 # Imported assets (icons, images)
└── .github/workflows/
    ├── deploy.yml              # Deploy to GitHub Pages
    ├── build-static-zip.yml    # Build dist/ ZIP artifact
    ├── pr-check.yml            # Pull request validation
    └── desktop-release.yml     # Desktop app release builds
```

## Technology Stack

| Category | Technology | Version |
|----------|------------|---------|
| UI Framework | React | 19.x |
| Language | TypeScript | ~5.6 |
| Build Tool | Vite | 6.x |
| Editor | CodeMirror 6 (`@codemirror/*`) | 6.x |
| Database | Dexie (IndexedDB) | 4.0.8 |
| Styling | CSS Modules + Tailwind CSS | 4.2 |
| Export | docx, pdfmake, built-in RTF/Fountain | 9.5.0 / 0.2.10 |
| Import | jszip (DOCX), custom RTF/TXT/Fountain parsers | 3.10.1 |
| Testing | Vitest + @vitest/coverage-v8 | 4.x |
| Linting | ESLint (flat config) + typescript-eslint | 9.x |
| PWA | vite-plugin-pwa + Workbox | 0.21.x |
| Icons | lucide-react + Material Symbols (Google Fonts CDN) | 0.575.0 |
| Desktop | Tauri | 2.x |
| Mobile | Capacitor (iOS) | 8.x |
| Pre-commit | Husky + lint-staged | 9.x |

## Development Workflow

### Setup
```bash
npm install
```

### Scripts
```bash
# Core development
npm run dev          # Vite dev server with HMR
npm run build        # TypeScript check + Vite production build → dist/
npm run preview      # Preview production build locally
npm run lint         # ESLint across all .ts/.tsx files (--max-warnings 0)
npm run typecheck    # TypeScript --noEmit type checking only
npm run test         # Vitest test runner (single run)

# Full CI pipeline (runs all checks)
npm run ci           # lint → typecheck → verify:vite-config → test:coverage → build → bundle:check → assets:check

# Testing & coverage
npm run test:coverage     # Vitest with coverage enabled
npm run coverage:changed  # Coverage check for changed files only
npm run test:inventory    # Validate test file organization

# Bundle & asset analysis
npm run bundle:analyze    # Build + check bundle sizes
npm run bundle:check      # Check bundle sizes (CI mode)
npm run assets:check      # Detect duplicate assets

# Desktop (Tauri)
npm run desktop:dev       # Tauri dev mode
npm run desktop:build     # Tauri production build
npm run desktop:build:debug  # Tauri debug build
npm run desktop:build:mac # macOS universal build
npm run desktop:build:win # Windows build
npm run desktop:build:linux  # Linux build

# Mobile (Capacitor)
npm run build:native      # Build + cap sync
npm run cap:sync          # Sync web assets to native projects
npm run cap:open:ios      # Open in Xcode

# Release
npm run release:verify-artifacts  # Validate release artifacts
```

### Path Aliases
TypeScript and Vite are configured with `@/*` → `src/*`:
```typescript
import { useApp } from '@/context/AppContext';
import type { Chapter } from '@/types';
```

### PWA During Development
The PWA service worker is auto-registered by `vite-plugin-pwa`. During development, Workbox manages caching. If stale caches cause issues, clear Application → Cache Storage in DevTools.

### Feature Flags
Runtime toggles via environment variables in `src/lib/featureFlags.ts`:
- `VITE_INTEGRATIONS_DEVELOPER_MODE` — enables integration dev tools
- `VITE_AI_DEVELOPER_MODE` — enables AI debug features
- `VITE_BROKER_BASE_URL` — server broker endpoint URL

## State Management

### AppContext (React Context + useReducer)
Application state is managed through `src/context/AppContext.tsx`, which delegates to:

- **`src/context/state/appReducer.ts`** — pure reducer function with all action types
- **`src/context/services/appServices.ts`** — side-effect services for storage I/O, settings persistence, and desktop secrets integration
- **`src/context/services/workspaceService.ts`** — workspace tracking and last-opened chapter persistence
- **`src/context/appSettings.ts`** — settings type definitions and defaults

```typescript
interface AppState {
  projectType: 'book' | 'screenplay';
  novelId: string;
  novelTitle: string;
  storyBlueprint: StoryBlueprint | null;
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
- `updateSettings` for persisting settings to localStorage (with desktop keychain support)

Access via the `useApp()` hook:
```typescript
const { state, activeChapter, createChapter, dispatch } = useApp();
```

### Settings Persistence
- **localStorage** (`draftharbour_settings_v1`): App settings, theme, typography prefs, goal trends, comment threads
- **IndexedDB** (`DraftHarbourDB`): Novels, chapters (with content), snapshots
- **Tauri keychain** (desktop only): Sensitive credentials via `src/lib/desktopSecrets.ts`

### Command System
All UI actions go through a typed command registry in `src/lib/commands.ts`:
```typescript
import { COMMAND_IDS, runCommand } from '@/lib/commands';
runCommand(COMMAND_IDS.NEW_CHAPTER, context);
```

## Data Schema (IndexedDB via Dexie)

Storage is modularized in `src/lib/storage/`:
- `db.ts` — Dexie database instance and initialization
- `novels.ts` — Novel CRUD operations
- `chapters.ts` — Chapter CRUD operations
- `snapshots.ts` — Snapshot/version control CRUD
- `migrations.ts` — Schema migrations between DB versions

```typescript
// Database: DraftHarbourDB — version 4
// v3 added projectType index on novels
// v4 migrated chapter content from Tiptap JSONContent to Markdown strings
db.version(4).stores({
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
  content: string | null;  // Markdown string (migrated from Tiptap JSON in v4)
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

### CSS Modules + Tailwind
Component styles use CSS Modules (`.module.css`) imported as `styles`:
```typescript
import styles from './Editor.module.css';
<div className={styles.editor}>
```

Tailwind CSS 4 is also available for utility classes. Global styles and design tokens live in `src/styles/index.css`.

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

### Editor System
The editor uses **CodeMirror 6** as its sole editing backend. Content is stored as Markdown strings in IndexedDB (migrated from Tiptap JSON in DB v4). The editor is initialized via `useCodeMirrorEditor` hook in `App.tsx` and exposed through an `EditorAdapter` interface.

Editor modules in `src/lib/editor/`:
- `types.ts` — `EditorAdapter` interface abstracting the editor API
- `EditorContext.tsx` — React context for shared editor state
- `useCodeMirrorEditor.ts` — CodeMirror React hook (primary editor initialization)
- `codemirrorAdapter.ts` — CodeMirror 6 ↔ app adapter implementing `EditorAdapter`
- `commentExtension.ts` — Comment anchor mark extension
- `fountainExtension.ts` — Fountain/screenplay editor support
- `richPreviewExtension.ts` — Rich text preview mode
- `typewriterExtension.ts` — Typewriter scrolling mode
- `theme.ts` — Editor theming
- `jsonToMarkdown.ts` — Legacy Tiptap JSON → Markdown converter (used in DB migration)
- `markdownParser.ts` — Markdown → editor document parser
- `index.ts` — Barrel re-exports

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

### Code Splitting
Vite config defines manual chunks for large feature areas:
- `export` — export libraries (docx, pdfmake)
- `ai` — AI provider modules
- `integrations` — cloud sync modules
- `codemirror` — CodeMirror and Lezer packages

## Cross-Platform (Desktop & Mobile)

### Tauri Desktop App
The `desktop/` directory contains a Tauri 2 wrapper for cross-platform desktop distribution.

**Features:**
- Single-instance enforcement
- Window state restoration
- `.dhproj` file associations
- `draftharbour://` deep links
- Native menu integration via `src/lib/nativeMenuAdapter.ts`
- Auto-update system via `src/lib/desktopUpdater.ts` (stable/beta/nightly channels)
- Secure credential storage via `src/lib/desktopSecrets.ts` (OS keychain)

**Platform detection:**
```typescript
import { isDesktop } from '@/lib/desktopSecrets';
if (isDesktop()) { /* Tauri-specific behavior */ }
```

### Capacitor iOS App
The `ios/` directory contains a Capacitor project for iOS distribution. Build with `npm run build:native` then open in Xcode via `npm run cap:open:ios`.

## Writing Analysis Tools

Located in `src/lib/`, these modules provide AI-powered writing insights:

| Module | Purpose |
|--------|---------|
| `voiceFingerprint.ts` | Detects similar character voices across chapters by analyzing speech patterns, vocabulary, and sentence structure |
| `narrativeWeather.ts` | Tracks emotional tone (sentiment) and pacing intensity through chapters to visualize the narrative arc |
| `sceneChemistry.ts` | Analyzes scene dynamics — tension, stakes, readability, conflict types — and suggests reordering |
| `continuityMemory.ts` | Tracks character appearances, relationships, timeline events, and world rules; detects continuity conflicts |
| `timelineConsistency.ts` | Validates event ordering and detects timeline gaps |

## AI Integration

### Providers
Located in `src/lib/ai/`:
- **Chrome AI** (`chromeAI.ts`): Browser-native `window.ai` API (Chrome Canary/Dev)
- **OpenAI** (`openaiProvider.ts`): OpenAI-compatible API endpoints
- **Server Proxy** (`serverProxyProvider.ts`): Routes through the server-side integration broker, supporting Groq, OpenRouter, and Gemini
- **Custom LLM** (`customLlmProvider.ts`): Custom/self-hosted LLM provider support
- **Fallback** (`fallbackProvider.ts`): Provider fallback chain logic for resilience

### Provider Management
- `providerManager.ts` — auto-detects best available provider, persists config to localStorage
- `availability.ts` — runtime detection of which providers are available

### AI Pipelines & Tools
- `pipelines.ts` — staged revision workflows with configurable insertion modes
- `aiRevisionLog.ts` — tracks before/after text for every AI revision (stored in localStorage, max 100 records) for undo/audit
- `evalFramework.ts` — AI output evaluation and quality scoring framework
- `storyBible.ts` — story bible context assembly for AI prompts (characters, world, continuity)

### AI Writing Modal
`src/components/Modals/AIWritingModal/` — multi-provider AI writing interface with preset prompts, continuity context injection, BYOK support, and revision history.

## Server-Side Backend

### PHP Proxy (`api/`)
Server-side proxy that isolates API keys from the client:
- `index.php` — entry point with CORS handling and routing
- `_config.php` — API key storage, rate limits, allowed origins
- `_rateLimit.php` — per-IP rate limiting (default 20 req/60sec)
- `_chatHandler.php` — forwards AI chat requests to providers
- Supports BYOK (bring-your-own-key) mode

### Integration Broker (`src/server/integrationBroker.ts`)
TypeScript request handler deployable as Node.js/Lambda backend:
- Handles OAuth flows for cloud providers
- Processes sync operations (connect, push, pull)
- Routes AI generation requests to multiple providers
- Error mapping and response normalization

## Cloud Integrations

Located in `src/lib/integrations/`:
- **Dropbox** (`dropbox.ts`, `dropboxDirect.ts`): OAuth2 file sync
- **Google Drive** (`googleDrive.ts`, `googleDriveDirect.ts`): OAuth2 file sync
- **Scrivener** (`scrivener.ts`): Project file import/export
- **Sync engine** (`sync.ts`): Bidirectional sync with conflict detection
- **Orchestration** (`orchestration.ts`): Coordinates multi-provider sync
- **Broker client** (`brokerClient.ts`): Client for server-side integration broker
- **Provider client** (`providerClient.ts`): HTTP client with retry policy
- **API client** (`api.ts`): Integration API utilities
- **OAuth** (`oauth.ts`): OAuth flow helpers
- **Service layer** (`service.ts`): Integration service abstraction
- **Helpers** (`helpers.ts`): Shared integration utilities

## Export System

Export functionality is modularized in `src/lib/export/`:
- `manuscriptDocx.ts` — DOCX manuscript export
- `pdf.ts` — PDF export
- `rtf.ts` — RTF export
- `fountain.ts` — Fountain format export
- `screenplay.ts` — Screenplay-specific export
- `shared.ts` — shared utilities
- `types.ts` — type definitions
- `boundary/` — external library adapters (`docxCompat.ts`, `pdfmake.ts`)

## Project Types

The app supports two project modes:
- **Book**: Chapters with prose content, traditional export formats
- **Screenplay**: Scenes with screenplay-typed paragraphs (scene-heading, action, character, dialogue, parenthetical, transition), Fountain format support, screenplay PDF export

The `projectType` field is stored on the novel and affects chapter creation, editor behavior, export options, and UI labels.

## Testing

### Framework: Vitest
```bash
npm run test              # Run all tests once
npm run test:coverage     # Run with coverage
npm run coverage:changed  # Coverage for changed files only
npm run test:inventory    # Validate test organization
```

### Test Setup
Global test setup in `src/test/setup.ts` (stubs `window.matchMedia` for jsdom compatibility).

### Test Files
~103 test files co-located with source using `.test.ts` / `.test.tsx` suffix. Key areas:

**Library tests** (`src/lib/`):
- `utils.test.ts`, `errors.test.ts`, `commands.test.ts`, `adapters.test.ts`
- `export.test.ts`, `export.screenplay.test.ts`, `import.test.ts`, `import.screenplay.test.ts`
- `narrativeWeather.test.ts`, `sceneChemistry.test.ts`, `voiceFingerprint.test.ts`
- `timelineConsistency.test.ts`, `projectMetrics.test.ts`, `secureCache.test.ts`
- `nativeMenuAdapter.test.ts`, `updaterGuardrails.test.ts`
- `storage.crud.test.ts`, `storage.backup.test.ts`, `storage.snapshot.test.ts`, `storage.coverage.test.ts`
- `highRisk.characterization.test.ts` — characterization tests for critical paths

**AI tests** (`src/lib/ai/`):
- `customLlmProvider.test.ts`, `evalFramework.test.ts`, `fallbackProvider.test.ts`
- `pipelines.test.ts`, `providerManager.test.ts`, `storyBible.test.ts`

**Editor tests** (`src/lib/editor/`):
- `codemirrorAdapter.test.ts`, `commentExtension.test.ts`, `fountainExtension.test.ts`
- `jsonToMarkdown.test.ts`, `markdownParser.test.ts`, `richPreviewExtension.test.ts`
- `typewriterExtension.test.ts`, `theme.test.ts`, `types.test.ts`
- `EditorContext.test.tsx`, `useCodeMirrorEditor.test.tsx`

**Integration tests** (`src/lib/integrations/`):
- `sync.test.ts`, `dropbox.test.ts`, `googleDrive.test.ts`, `api.test.ts`, `service.test.ts`

**Component tests** (`src/components/`):
- `AppShell.test.tsx`, `Editor.persistence.test.tsx`, `FindReplace.test.tsx`
- `Header.test.tsx`, `SaveStatus.test.tsx`, `Toolbar.test.tsx`
- `Inspector.test.tsx`, `MenuBar.test.tsx`, `QuickSwitcher.test.tsx`
- Modal tests: `AIWritingModal.test.tsx`, `CommentModal.test.tsx`, `CorkboardModal.test.tsx`, etc.
- Sidebar tests: `ChapterList.test.tsx`, `ScenePlanner.test.tsx`, `VirtualChapterList.test.tsx`
- Layout tests: `AppShellLayout.test.tsx`, `StatusBar.test.tsx`, `TopBar.test.tsx`

**Hook tests** (`src/hooks/`):
- `useModalState.test.ts`, `useAppKeyboardShortcuts.test.ts`, `useDragReorder.test.ts`
- `useCommentActions.test.tsx`, `useDesktopRuntime.test.tsx`, `useLoadNovel.test.tsx`
- `useResponsivePanels.test.tsx`, `useVoiceAlerts.test.tsx`, `useOnboardingTrigger.test.tsx`

**Context tests**: `AppContext.actions.test.tsx`, `AppContext.hooks.test.tsx`, `AppContext.settings.test.tsx`
**Server tests**: `integrationBroker.contract.test.ts`

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
6. If persisted, update relevant module in `src/lib/storage/`
7. Run `npm run ci` for full validation (or `npm run lint && npm run typecheck` for quick checks)

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
2. Update relevant module in `src/lib/storage/` (`chapters.ts`, `novels.ts`, etc.)
3. Add migration if needed in `src/lib/storage/migrations.ts`
4. Handle in relevant components

### Adding Export Formats
1. Add format to `ExportFormat` type in `src/types/index.ts`
2. Create export module in `src/lib/export/` (lazy-load heavy deps)
3. Add library adapter in `src/lib/export/boundary/` if needed
4. Add option in `src/components/Modals/ExportModal.tsx`

### Adding Import Formats
1. Add parser function in `src/lib/import.ts`
2. Update accepted file extensions in `App.tsx` file input

## CI/CD

### GitHub Actions
- **deploy.yml**: On push to `main` → `npm ci` → `npm run build` → deploy `dist/` to GitHub Pages
- **build-static-zip.yml**: On push to `main` → build → create ZIP artifact for cPanel deployment
- **pr-check.yml**: On pull request → runs lint, typecheck, tests, build validation
- **desktop-release.yml**: Desktop app release builds for macOS, Windows, Linux

All use Node.js 20.

### Pre-commit Hooks
Husky + lint-staged runs ESLint on staged `.ts/.tsx` files before each commit.

### QA Scripts (`scripts/`)
- `check-bundle-size.mjs` — validates chunk sizes stay within limits
- `check-asset-duplicates.mjs` — detects duplicate asset files
- `check-touched-coverage.mjs` — ensures test coverage for changed files
- `test-inventory.mjs` — validates test file organization
- `test-rate-limit.php` — rate limiting integration test for PHP proxy
- `verify-vite-config.mjs` — validates Vite config integrity
- `verify-release-artifacts.mjs` — validates release checksums and manifests

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
- Encrypted local caching for sensitive data (`src/lib/secureCache.ts`)
- Desktop keychain integration for credentials (`src/lib/desktopSecrets.ts`)
- Error sanitization redacts API keys and tokens from error messages (`src/lib/errors.ts`)
- Managed settings policy enforcement (`src/lib/policy.ts`)
- Server proxy (`api/`) isolates API keys from client-side code
- Optional cloud sync requires explicit user configuration
- User-provided content in exports is escaped to prevent injection
- HTML escaping utility in `src/lib/utils.ts` (`escapeHtml`)

## Quick Reference

| Task | Location |
|------|----------|
| Add/modify types | `src/types/index.ts` |
| App state management | `src/context/AppContext.tsx` |
| State reducer | `src/context/state/appReducer.ts` |
| State services | `src/context/services/appServices.ts` |
| Data persistence | `src/lib/storage/` (db, novels, chapters, snapshots, migrations) |
| Command registry | `src/lib/commands.ts` |
| Editor config | `src/App.tsx` (CodeMirror init), `src/components/Editor/`, `src/lib/editor/` |
| Export formats | `src/lib/export/` (per-format modules) |
| Import formats | `src/lib/import.ts` |
| UI components | `src/components/` (each in own directory) |
| Layout shell | `src/components/AppShell/` |
| Shared UI primitives | `src/components/UI/` |
| Global styles & tokens | `src/styles/index.css` |
| AI providers | `src/lib/ai/` |
| AI revision tracking | `src/lib/aiRevisionLog.ts` |
| Writing analysis | `src/lib/voiceFingerprint.ts`, `narrativeWeather.ts`, `sceneChemistry.ts`, `continuityMemory.ts`, `timelineConsistency.ts` |
| Cloud integrations | `src/lib/integrations/` |
| Server broker | `src/server/integrationBroker.ts` |
| Desktop features | `src/lib/desktopSecrets.ts`, `desktopUpdater.ts`, `nativeMenuAdapter.ts`, `updaterGuardrails.ts` |
| Feature flags | `src/lib/featureFlags.ts` |
| Error handling | `src/lib/errors.ts` |
| Security/encryption | `src/lib/encryption.ts`, `secureCache.ts` |
| Custom hooks | `src/hooks/` (~15 hooks for keyboard, modals, panels, etc.) |
| Settings migration | `src/lib/settingsMigration.ts` |
| Storage keys | `src/lib/storageKeys.ts` |
| Menu config | `src/lib/menuConfig.ts` |
| i18n / translation | `src/lib/translation.ts` |
| LLM fine-tuning | `llm/Narratryx/` |
| Tests | Co-located `*.test.ts` files (~103 files), run with `npm run test` |
| Build config | `vite.config.ts` |
| TypeScript config | `tsconfig.json` |
| Linting | `eslint.config.js` |
| CI/CD | `.github/workflows/` |
| QA scripts | `scripts/` |
| Desktop config | `desktop/src-tauri/tauri.conf.json` |
| Mobile config | `capacitor.config.ts` |
