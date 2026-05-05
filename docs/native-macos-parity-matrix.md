# Native macOS Parity Matrix

This matrix tracks implemented web/Tauri behavior that exists in the SwiftUI/AppKit macOS app now that the native app is the supported Mac desktop application. The web/PWA and Capacitor paths remain separate targets; Tauri is retained for Windows/Linux desktop builds only.

## Baseline

| Area | Native status | Reference |
| --- | --- | --- |
| SwiftUI document shell | Implemented | `macos/Sources/DraftHarbourNative` |
| `.dhproj` v1 load/save | Implemented | `src/lib/storage.ts` |
| Basic editor/sidebar/inspector | Implemented | `src/components/layout`, `src/components/Editor` |
| Build, run, package scripts | Implemented | `script/build_and_run.sh`, `script/package_macos.sh` |

## Writer Core

| Capability | Native status | Notes |
| --- | --- | --- |
| Section create/update/delete/reorder | Implemented | Includes undo/redo for reorder. |
| Project title/settings mutations | Implemented | Stored in `.dhproj` envelope. |
| Scene planner CRUD/reorder | Implemented | Scene model remains compatible with web `Scene`. |
| Markdown formatting commands | Implemented | Mutates Markdown/Fountain text ranges. |
| Find/replace | Implemented | Native model + UI bar with next/previous match navigation. |
| Quick switcher/search | Implemented | Searches sections, commands, story bible entries. |
| Snapshots | Implemented | Create, rename, restore, delete, auto snapshot support. |
| Comments | Implemented | Add, edit, reply, resolve, delete, anchor metadata. |
| Story cards and corkboard | Implemented | Native card sizing, status counts, selection, search/filter/expand, and drag reorder mode. |
| Recent files/session recovery | Implemented | Active section, recent project URLs, and newer-than-file recovery envelope. |

## Import And Export

| Capability | Native status | Notes |
| --- | --- | --- |
| TXT/Markdown import | Implemented | Heading-aware section split. |
| Fountain import/export | Implemented | Scene-heading aware import and screenplay export. |
| RTF import/export | Implemented | Uses AppKit attributed string conversion. |
| DOCX import/export | Implemented | ZIPFoundation-backed minimal OOXML reader/writer. |
| PDF export | Implemented | Native paginated PDF context export. |
| Screenplay PDF export | Implemented | Paginated Courier screenplay layout approximation. |
| Publishing bundle export | Implemented | JSON bundle matching web data intent. |
| Export validation/history | Implemented | Native validation and in-envelope history records. |

## AI And Analysis

| Capability | Native status | Notes |
| --- | --- | --- |
| OpenAI-compatible/local provider | Implemented | Existing URLSession chat completion provider. |
| Server proxy/custom provider config | Implemented | Native config + provider factory. |
| Fallback chain | Implemented | Tries configured providers in order. |
| Writing pipelines | Implemented | Prompt rendering and insertion modes. |
| Translation prompt workflow | Implemented | Provider-backed translation service. |
| Story-bible/continuity prompt context | Implemented | Native context builder. |
| Revision log/eval history models | Implemented | Persistable model types are available. |
| Timeline/voice/narrative analytics | Implemented | Deterministic native analyzers. |

## Integrations And Release

| Capability | Native status | Notes |
| --- | --- | --- |
| Generic REST sync | Implemented | Push/pull/list via `URLSession`. |
| Dropbox/Google Drive provider shell | Deferred | Provider-native OAuth is out of scope for this pass; Generic REST is the primary native sync UI. |
| Scrivener bridge | Implemented | Plain-text package import/export bridge exposed in native integrations UI. |
| Three-way conflict detection | Implemented | Shared native merge primitive. |
| Keychain token storage | Implemented | Existing `KeychainClient`; mockable protocol added. |
| Local beta package script | Implemented | Ad-hoc local signing, DMG verification, checksum output, and optional Developer ID/notary path. |
| Native CI workflow | Implemented | PR check runs `swift test --package-path macos`; release workflow packages macOS through Swift and Windows/Linux through Tauri. |
