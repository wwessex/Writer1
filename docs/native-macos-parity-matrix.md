# Native macOS Full Web-Parity Audit

Audit date: 2026-05-08; implementation update: 2026-05-09

Scope: the native SwiftUI/AppKit macOS app in `macos/` was audited against the web/PWA feature surface in `README.md`, `src/components`, `src/lib`, and `src/hooks`. Behavior-level parity is treated as sufficient when native storage or UI differs from the web implementation. Provider-backed flows are marked `Not live-verified` unless the audit could verify them without external credentials or service endpoints.

## Verification Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Web feature/test inventory | Pass | `npm run test:inventory` completed with 113 suites, 258 describe blocks, and 1376 test cases. |
| Native unit tests | Pass | `swift test --package-path macos` completed with 66 tests and 0 failures, including `CollaborationAndGuardrailsTests`. |
| Native launch smoke | Pass | `./script/build_and_run.sh --verify` built `dist/DraftHarbour.app`, launched `DraftHarbourNative`, and confirmed the process was running. |
| Strict bundle signature | Pass | `codesign --verify --deep --strict dist/DraftHarbour.app` returns 0 after staging the cache-backed app bundle through `script/build_and_run.sh --no-launch`. |
| Extended metadata inspection | Pass | `xattr -lr dist/DraftHarbour.app` now reports only `com.apple.provenance`; the staged app avoids the file-provider `FinderInfo`/resource-fork metadata that broke strict verification. |
| Gatekeeper assessment | Partial | `spctl -a -vv dist/DraftHarbour.app` still rejects ad-hoc local builds; Developer ID signing and notarization remain required for distributable release builds. |
| Bundle metadata | Pass | `plutil -p dist/DraftHarbour.app/Contents/Info.plist` confirms `.dhproj` document type, `com.draftharbour.project` UTI, and `draftharbour` URL scheme. |
| Manual provider smoke | Not live-verified | `npm run smoke:providers` is available and skips cleanly without credentials. No valid AI, LanguageTool, Dropbox, Google Drive, Generic REST, or Scrivener endpoint credentials were available during the audit. |

## Feature Matrix

### Project And Document Lifecycle

| Web/PWA surface | Native status | Evidence | Gap / notes |
| --- | --- | --- | --- |
| `.dhproj` v1 open/save and document round trip | Pass | `DraftHarbourDocument.swift`, `DhprojCodecTests`, `ProjectStoreParityTests`, `swift test --package-path macos` | Native uses a file-document workflow instead of the web IndexedDB store, but the envelope and project data round trip at behavior level. |
| Create/open/recent project flows | Pass | `DraftHarbourNativeApp.swift`, `WelcomeWindowCoordinator.swift`, `WelcomeView.swift`, `SessionRecoveryService.swift`, `ProjectStoreParityTests` | Native supports document creation/open/recent files, pinned recent projects, read-only file indicators, and an Open in New Window command path. |
| Multi-project flows | Partial | `DocumentGroup`, `WelcomeWindowCoordinator.swift`, web `ProjectsModal.tsx` | Multiple documents can be opened by macOS document behavior, but the web project hub semantics are not fully mirrored. |
| Autosave and crash/session recovery | Partial | `SessionRecoveryService.swift`, `NativeOperationalGuardrails.swift`, `SettingsView.swift`, web `useCrashRecovery.ts` | Native stores recovery snapshots, recent URLs, active section state, current/next-launch safe mode, and redacted diagnostics submission. `autosaveMs` timing behavior was not live-verified. |
| Backup import/export | Pass | `NativeDocumentView.swift`, `ProjectStoreTests`, `DhprojCodecTests` | Native exposes `.dhproj` backup import/export commands. |
| Deep links and file association | Pass | `Info.plist`, `NativeCommandAndDeepLinkTests`, `plutil -p dist/DraftHarbour.app/Contents/Info.plist` | `.dhproj` UTI and `draftharbour` URL scheme are registered in the staged bundle. |
| PWA install, service worker, Capacitor mobile flows | Native N/A | `README.md`, `ios/`, web PWA files | These are not macOS-native app requirements. |

### Editor, Commands, And Workspaces

| Web/PWA surface | Native status | Evidence | Gap / notes |
| --- | --- | --- | --- |
| Core editor editing and persistence | Pass | `NativeDocumentView.swift`, `DraftHarbourDocument.swift`, native tests | Native uses AppKit text editing rather than CodeMirror, with equivalent document editing and save behavior. |
| Formatting commands | Pass | `DraftHarbourCommands.swift`, `MarkdownTools.swift`, `MarkdownToolsTests` | Markdown/Fountain text mutations are covered by native command wiring and tests. |
| Find/replace and native find | Pass | `NativeDocumentView.swift`, `NativeCommandID`, `NativeCommandAndDeepLinkTests` | Native has project find/replace plus responder-chain native find commands. |
| Focus, typewriter, page, theme, sidebar, inspector toggles | Pass | `NativeDocumentView.swift`, `SettingsView.swift`, `ThemePreferenceTests` | Behavior-level parity is present through native UI and settings. |
| Write, corkboard, and review workspaces | Pass | `WorkspaceMode`, `CorkboardWorkspaceView.swift`, `ReviewWorkspaceView.swift` | Native workspace switching is present. |
| CodeMirror-specific rich preview extensions and inline decorations | Partial | web `src/extensions`, native `NativeDocumentView.swift` | Native equivalent behavior exists through AppKit text and panels, but exact CodeMirror extension UI is web-only. |
| Quick switcher and command routing | Pass | `NativeCommandID`, `QuickSwitcherIndex`, `NativeCommandAndDeepLinkTests` | Native command IDs cover web command groups plus macOS-only commands. |
| Native menus and responder integration | Pass | `DraftHarbourCommands.swift`, `NativeCommandID` | File, project, view, insert, format, tools, help, spelling, substitutions, share, print, and reveal commands are wired. |

### Structure, Planning, And Story Tools

| Web/PWA surface | Native status | Evidence | Gap / notes |
| --- | --- | --- | --- |
| Chapters/sections create, update, delete, search, status, reorder | Pass | `SidebarView.swift`, `InspectorView.swift`, `ProjectStoreTests` | Native sidebar supports section CRUD, filters, metadata, and list reordering. |
| Inspector metadata for prose and screenplay | Pass | `InspectorView.swift`, `DhprojModels.swift` | Section status, summary, POV, tags, goals, part/act/sequence, scene slug, location, time, production tags, and page estimate are present. |
| Scene planner and scene templates | Partial | `ToolPanelView.swift`, `InspectorView.swift`, web `ScenePlanner` components | Native has scene metadata and scene templates, but the full web scene-planner workflow was not live-smoked panel by panel. |
| Corkboard and story cards | Pass | `CorkboardWorkspaceView.swift`, `ToolPanelView.swift`, `WebParityServicesTests` | Native exposes corkboard workspace and story-card panel behavior. |
| Character bible and world entries | Pass | `ToolPanelView.swift`, `DhprojModels.swift` | Native has character and world entry panels backed by persisted project models. |
| Search/filter review surfaces | Pass | `ReviewWorkspaceView.swift`, `SidebarView.swift` | Native supports review filtering across comments, snapshots, validation, continuity, AI revisions, and sync sections. |

### Comments, Snapshots, And Collaboration Claims

| Web/PWA surface | Native status | Evidence | Gap / notes |
| --- | --- | --- | --- |
| Anchored comments, replies, resolve, delete | Pass | `ToolPanelView.swift`, `InspectorView.swift`, `DhprojModels.swift`, `WebParityServicesTests` | Native stores comments and replies in `.dhproj` and exposes comment workflows in inspector/tool panels. |
| Snapshots, restore, rename, delete | Pass | `ToolPanelView.swift`, `InspectorView.swift`, native tests | Native snapshot operations are implemented. |
| Version history beyond local snapshots | Partial | `DhprojModels.swift`, `ToolPanelView.swift`, integration revision APIs | Local snapshots and remote sync revisions exist, but a full collaborative version-history timeline was not live-verified. |
| Real-time collaboration, invites, permissions, presence | Partial | `CollaborationModels.swift`, `CollaborationSyncService.swift`, `ProjectStore.swift`, `ToolPanelView.swift`, `CollaborationAndGuardrailsTests` | Native now has document-scoped invites, member permissions, invite accept/revoke flows, active presence persisted in `.dhproj`, and a REST sync contract for push/pull/presence/invite acceptance. A hosted collaboration backend was not configured or live-verified. |
| Web plugin hooks for collaboration/comment events | Pass | `NativePluginRuntime.swift`, `ProjectStore.swift`, `CollaborationAndGuardrailsTests` | Native now exposes plugin manifests, enable/disable state, event handlers, string filters, plugin storage, safe-mode suppression, and emits comment/collaboration/snapshot/export events. |

### AI, Suggestions, Translation, And Revision Log

| Web/PWA surface | Native status | Evidence | Gap / notes |
| --- | --- | --- | --- |
| AI provider configuration and storage | Pass | `ToolPanelView.swift`, `ProviderProtocolTests`, `AIAndSyncParityTests`, `IntegrationConfig` Keychain patterns | Native supports local/OpenAI-compatible/server-proxy/custom provider modes and stores secret material outside `.dhproj` where applicable. |
| AI generation workflows and insertion modes | Pass | `ToolPanelView.swift`, `AIAndSyncParityTests`, `DhprojModels.swift` | Prompt stages, translation mode, insertion modes, and revision logging models are present. |
| AI suggestions panel and custom prompt | Pass | `ToolPanelView.swift`, `AIAndSyncParityTests` | Native exposes AI suggestions and custom prompt workflows. |
| Translation workflow | Pass | `ToolPanelView.swift`, `NativeCommandID.translation`, `AIAndSyncParityTests` | Translation prompt workflow exists natively. |
| Provider live calls | Not live-verified | No provider credentials/endpoints available | Unit tests cover protocols and deterministic paths; actual OpenAI-compatible/local/server provider calls were not exercised. |
| Browser/Chrome built-in AI provider | Native N/A | web provider-specific code, native provider registry | Chrome-specific browser AI is not applicable to native macOS. |
| AI eval history parity | Partial | `DhprojModels.swift`, `ToolPanelView.swift`, web AI components | Persistable revision/eval models exist, but the full web eval-history UX was not live-smoked. |

### Analytics, Dashboard, And Review Tools

| Web/PWA surface | Native status | Evidence | Gap / notes |
| --- | --- | --- | --- |
| Dashboard, goals, streaks, project progress | Pass | `ToolPanelView.swift`, `SettingsView.swift`, `WebParityServicesTests` | Native dashboard and goal settings are present. |
| Word count and section metrics | Pass | `ToolPanelView.swift`, `InspectorView.swift`, native tests | Native exposes project and section metrics. |
| Readability, long sentences, repeated words, sentiment, voice, continuity | Pass | `ToolPanelView.swift`, `ReviewWorkspaceView.swift`, `WebParityServicesTests` | Deterministic analyzers are available natively. |
| Narrative weather and advanced analytics | Pass | `ToolPanelView.swift`, `WebParityServicesTests` | Native analysis panel includes these deterministic tools. |
| LanguageTool grammar check | Not live-verified | `ToolPanelView.swift`, `SettingsView.swift` | UI/configuration exists, but no live LanguageTool endpoint was exercised. |
| Export validation review | Pass | `ExportValidator`, `ExportModels.swift`, web `exportValidation.ts`, `ImportExportParityTests` | Native validation now mirrors the web submission/profile rules for file type, typography, spacing, pagination, headers, chapter breaks, margins, indents, title page, and content checks. |

### Import, Export, And Publishing

| Web/PWA surface | Native status | Evidence | Gap / notes |
| --- | --- | --- | --- |
| TXT, Markdown, Fountain import/export | Pass | `ImportExportParityTests`, native importer/exporter files | Covered by native tests. |
| RTF import/export | Pass | `ImportExportParityTests`, AppKit attributed-string conversion | Covered by native tests. |
| DOCX import/export | Pass | `ImportExportParityTests`, ZIPFoundation-backed OOXML reader/writer | Native DOCX support is minimal OOXML text round trip, not a full Word layout engine. |
| PDF and screenplay PDF export | Pass | `ImportExportParityTests`, `PDFTextRenderer`, screenplay exporter | Covered by native tests and static exporter inspection. |
| Publishing bundle export | Pass | `ImportExportParityTests`, publishing bundle exporter | Covered by native tests. |
| Web export presets and manuscript profile options | Pass | web `ExportModal.tsx`, web `exportValidation.ts`, native `ExportModels.swift`, `ToolPanelView.swift`, `Exporters.swift`, `ImportExportParityTests` | Native now exposes the web preset catalog, manuscript profile/locale/author/header/layout options, Fountain metadata/filename options, and preflight validation. Exporters consume these options for Markdown/TXT/Fountain/RTF/PDF/DOCX behavior. |
| Export history | Partial | `ToolPanelView.swift`, `DhprojModels.swift`, web `ExportHistoryModal` | Native records/export surfaces exist, but full web history workflow was not live-smoked. |

### Sync And Integrations

| Web/PWA surface | Native status | Evidence | Gap / notes |
| --- | --- | --- | --- |
| Generic REST sync | Not live-verified | `GenericRESTSyncProvider.swift`, `AIAndSyncParityTests`, `scripts/provider-smoke.mjs` | Native implementation, mock coverage, and credential-gated smoke tooling exist; no real endpoint was configured. |
| Dropbox sync | Not live-verified | `DropboxSyncProvider.swift`, `AIAndSyncParityTests`, Keychain token storage, `scripts/provider-smoke.mjs` | Native OAuth/token/revision logic and smoke tooling exist; no real Dropbox account was exercised. |
| Google Drive sync | Not live-verified | `GoogleDriveSyncProvider.swift`, `AIAndSyncParityTests`, Keychain token storage, `scripts/provider-smoke.mjs` | Native OAuth/token/revision logic and smoke tooling exist; no real Google account was exercised. |
| Scrivener package bridge | Not live-verified | `ScrivenerIntegrationProvider.swift`, `ToolPanelView.swift`, `scripts/provider-smoke.mjs` | Native bridge and local path smoke tooling exist; no real Scrivener package was exercised in this audit. |
| Conflict detection and remote revisions | Pass | `AIAndSyncParityTests`, integration models/services | Deterministic conflict/revision logic is covered by native tests. |
| Web plugin API and integration hooks | Partial | `NativePluginRuntime.swift`, `ProjectStore.swift`, `ToolPanelView.swift`, `CollaborationAndGuardrailsTests` | Native has a typed runtime for manifests, events, filters, storage, and emitted document/integration hooks. External bundle discovery, JS sandboxing, and UI extension slots are not implemented. |

### Native macOS, Security, And Release Packaging

| Web/PWA surface | Native status | Evidence | Gap / notes |
| --- | --- | --- | --- |
| Spotlight indexing and clear index | Pass | `SpotlightIndexingTests`, `NativeCommandID`, `DraftHarbourCommands.swift` | Native-specific feature is implemented and tested. |
| Keychain usage for provider/integration secrets | Pass | provider/integration models, `AIAndSyncParityTests` | Tests and model encoding confirm secrets are not stored raw in `.dhproj` for covered providers. |
| Share, print, reveal in Finder, copy deep link | Pass | `NativeCommandID`, `DraftHarbourCommands.swift`, `NativeDocumentView.swift` | Native command wiring is present. |
| Settings coverage | Pass | `SettingsView.swift`, `ThemePreferenceTests` | General, editor, goals, checks, AI, export, sync, and update settings are present. |
| Managed policy, safe mode, remote crash reporting, updater guardrails | Pass | `NativeOperationalGuardrails.swift`, `DraftHarbourNativeApp.swift`, `SettingsView.swift`, `ToolPanelView.swift`, `CollaborationAndGuardrailsTests`, `package_macos.sh` | Native supports managed policy from defaults/env/path, local-only/provider restrictions, settings overrides, current/next-launch safe mode, redacted local and remote crash diagnostics, update failure fallback, pinned versions, last-good-version state, and signed update manifest generation. |
| Build and launch local staged app | Pass | `./script/build_and_run.sh --verify` | The app builds, stages, launches, and the process is detectable. |
| Strict signing and Gatekeeper readiness | Partial | `script/build_and_run.sh`, `script/package_macos.sh`, `codesign --verify --deep --strict`, `hdiutil verify`, `spctl -a -vv` | Strict codesign and local DMG verification pass. `package_macos.sh --distribution` now enforces Developer ID, notary profile, release signing key, notarization, stapling, and signed update metadata. Gatekeeper still rejects local ad-hoc dry-runs until real Apple credentials are configured. |

## Blockers And Partial Implementations

1. Release builds still need real Developer ID signing and notarization credentials. The script now enforces them in `--distribution` mode, but the local environment only verified the ad-hoc dry-run path.
2. Collaboration is implemented as document-scoped native state with a REST sync contract. A hosted backend still needs to be deployed and live-verified.
3. Native plugin runtime hooks now exist, but external plugin bundle discovery, JavaScript sandbox execution, and UI extension slots are not implemented.
4. Native operational guardrails and signed update metadata now exist; distribution still depends on CI secrets and Apple notarization access.
5. AI, LanguageTool, Generic REST, Dropbox, Google Drive, and Scrivener provider flows are implemented or mocked and have credential-gated smoke tooling, but were not live-verified because credentials/endpoints were unavailable.

## Top Release Risks

| Priority | Risk | Impact |
| --- | --- | --- |
| P0 | Developer ID signing and notarization credentials are not available in the local environment. | `--distribution` mode is implemented but cannot be completed locally without Apple secrets/keychain setup. |
| P1 | Real-time collaboration claims exceed the unhosted sync contract. | Product messaging can overpromise team features until a backend is deployed and verified. |
| P1 | Native plugin packaging/discovery is incomplete. | Plugin runtime hooks exist, but third-party plugin loading and UI contribution expectations need a platform contract. |
| P2 | External providers are not live-smoked. | OAuth, token refresh, provider payloads, and sync edge cases may fail outside mocks. |

## Recommended Follow-Up Fixes

1. Add CI/keychain secrets for `APPLE_SIGNING_IDENTITY`, `APPLE_NOTARY_KEYCHAIN_PROFILE`, and `RELEASE_SIGNING_KEY`, then run `.github/workflows/desktop-release.yml` and verify the stapled DMG with Gatekeeper.
2. Deploy the collaboration REST backend matching the native contract, then live-smoke push/pull/presence/invite acceptance from the macOS app.
3. Run `npm run smoke:providers -- --require-configured` with real Generic REST, Dropbox, Google Drive, Scrivener, AI provider, and LanguageTool credentials.
4. Add plugin bundle discovery, sandbox execution rules, and UI extension slots if third-party native plugins are a release requirement.
5. Add a repeatable macOS UI smoke runbook or UI automation target for the manual flows: create book/screenplay projects, save/reopen `.dhproj`, open major panels, run representative imports/exports, reorder sections, add comments, create snapshots, copy deep links, and index/clear Spotlight.
