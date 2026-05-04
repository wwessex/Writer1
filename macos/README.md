# DraftHarbour Native macOS

This is the real native macOS implementation of DraftHarbour Studio. It is a SwiftUI/AppKit document app, not a Tauri/WebView wrapper.

## Status

The current implementation is the native foundation for the parity migration:

- SwiftUI `DocumentGroup` app for `.dhproj` documents.
- Swift `Codable` schema for the current `.dhproj` v1 format.
- Document-owned project state through `ProjectStore`.
- Native macOS sidebar, editor, inspector, settings, tool panels, and commands.
- AppKit `NSTextView` bridge for native text editing.
- Keychain client, AI provider protocol, integration provider protocol, importer/exporter protocol.
- Native exports for Markdown, plain text, Fountain, RTF, and basic PDF.

The existing React/PWA/Tauri implementation remains the behavioral reference until parity is complete.

## Build And Run

From the repository root:

```bash
./script/build_and_run.sh
```

The script builds the SwiftPM app in `macos/`, stages `dist/DraftHarbour.app`, and launches the bundle.

## Xcode

Open `macos/Package.swift` in Xcode. Xcode treats this as a native macOS package project with the `DraftHarbourNative` executable and `DraftHarbourNativeCoreTests`.

## Tests

```bash
swift test --package-path macos
```

## Release Notes

`DraftHarbourNative.entitlements` defines the initial release entitlement policy. A notarized release pipeline should archive and sign the staged app bundle or an Xcode-managed archive with the same bundle identifier, document type, hardened runtime, and entitlements.
