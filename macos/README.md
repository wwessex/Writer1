# DraftHarbour Native macOS

This is the real native macOS implementation of DraftHarbour Studio. It is a SwiftUI/AppKit document app, not a Tauri/WebView wrapper.

## Status

This SwiftUI/AppKit app is now the supported macOS desktop application. The existing web app remains available as the PWA/iOS renderer, and Tauri is retained only for Windows/Linux desktop builds.

- SwiftUI `DocumentGroup` app for `.dhproj` documents.
- Swift `Codable` schema for the current `.dhproj` v1 format.
- Document-owned project state through `ProjectStore`.
- Native macOS sidebar, editor, inspector, settings, tool panels, and commands.
- AppKit `NSTextView` bridge for native text editing.
- Import/export for TXT, Markdown, Fountain, RTF, DOCX, PDF, screenplay PDF, and publishing bundles.
- Session recovery with active section and recent project metadata.
- Native AI provider configuration with Keychain-backed tokens, workflow stages, translation, insertion modes, and revision logging.
- Generic REST sync with connect/test, push, pull, revisions, conflict display, and keep-local/use-remote/keep-both resolution.
- Scrivener local package bridge for plain-text package import/export.
- Native menus for file, view, insert, format, tools, help, and project workflows.

Dropbox and Google Drive provider-native OAuth are intentionally deferred for this pass. Use Generic REST sync for native cloud sync, or the Scrivener local package bridge for file-based workflows.

## Build And Run

From the repository root:

```bash
./script/build_and_run.sh
```

The script builds the SwiftPM app in `macos/`, stages `dist/DraftHarbour.app`, and launches the bundle.

For build-only verification:

```bash
./script/build_and_run.sh --no-launch
./script/build_and_run.sh --verify
```

## Xcode

Open `macos/Package.swift` in Xcode. Xcode treats this as a native macOS package project with the `DraftHarbourNative` executable and `DraftHarbourNativeCoreTests`.

## Tests

```bash
swift test --package-path macos
```

## Release Notes

`script/build_and_run.sh` stages the native app bundle, copies the app icon from `macos/Resources`, and ad-hoc signs the local bundle. `script/package_macos.sh` signs the release copy ad hoc by default, creates and verifies `dist/release/DraftHarbour.dmg`, and writes `dist/release/checksums.txt`.

Gatekeeper rejection is expected for ad-hoc local beta builds when `APPLE_SIGNING_IDENTITY` is not set. Developer ID signing and notarization remain environment-driven through `APPLE_SIGNING_IDENTITY` and `APPLE_NOTARY_KEYCHAIN_PROFILE`.

`DraftHarbourNative.entitlements` defines the initial release entitlement policy. A notarized release pipeline should archive and sign the staged app bundle or an Xcode-managed archive with the same bundle identifier, document type, hardened runtime, and entitlements.
