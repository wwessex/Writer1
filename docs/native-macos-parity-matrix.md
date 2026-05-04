# Native macOS Parity Matrix

This matrix tracks implemented web/Tauri behavior that must exist in the SwiftUI/AppKit macOS app before it becomes the primary Mac application. The web, Tauri, and Capacitor paths remain reference implementations and fallback builds until this table is complete.

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
| Find/replace | Implemented | Native model + UI bar. |
| Quick switcher/search | Implemented | Searches sections, commands, story bible entries. |
| Snapshots | Implemented | Create, rename, restore, delete, auto snapshot support. |
| Comments | Implemented | Add, reply, resolve, delete, anchor metadata. |
| Story cards and corkboard | Partial | Native views surface cards; drag/reorder polish remains. |
| Recent files/session recovery | Partial | AppStorage/UserDefaults hooks exist; full crash recovery remains. |

## Import And Export

| Capability | Native status | Notes |
| --- | --- | --- |
| TXT/Markdown import | Implemented | Heading-aware section split. |
| Fountain import/export | Implemented | Scene-heading aware import and screenplay export. |
| RTF import/export | Implemented | Uses AppKit attributed string conversion. |
| DOCX import/export | Implemented | ZIPFoundation-backed minimal OOXML reader/writer. |
| PDF export | Implemented | Native PDF context export. |
| Screenplay PDF export | Implemented | Courier screenplay layout approximation. |
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
| Dropbox/Google Drive provider shell | Partial | Uses same sync contract when configured with base URL/token; provider-native OAuth UI remains. |
| Scrivener bridge | Implemented | Plain-text package import/export bridge. |
| Three-way conflict detection | Implemented | Shared native merge primitive. |
| Keychain token storage | Implemented | Existing `KeychainClient`; mockable protocol added. |
| Signed/notarized local package script | Implemented | Environment-driven signing/notary path. |
| Native CI workflow | Implemented | PR check runs `swift test --package-path macos` and bundle staging on macOS. |
