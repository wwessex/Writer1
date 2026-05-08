# Desktop Release Checklist

## 1) Channel and manifest readiness
- Confirm target channel (`stable`, `beta`, or `nightly`).
- Ensure corresponding manifest file in `docs/releases/manifests/` is updated.
- Verify `RELEASE_CHANNEL` matches the intended publish channel.

## 2) CI pipeline gates
- Trigger `.github/workflows/desktop-release.yml`.
- Validate the native macOS job and Windows/Linux Tauri jobs pass.
- Confirm Windows signing variables are present when Windows release signing is required.
- Confirm macOS distribution output is Developer ID signed, notarized, stapled, DMG-verified, checksumed, and has signed update metadata.
- Required macOS release secrets: `APPLE_SIGNING_IDENTITY`, `APPLE_NOTARY_KEYCHAIN_PROFILE`, and `RELEASE_SIGNING_KEY`.
- Local dry-runs can use `./script/package_macos.sh --skip-notarization`; CI release promotion must use `./script/package_macos.sh --distribution --channel <stable|beta|nightly>`.

## 3) Artifact integrity
- Confirm `checksums.txt` is generated per platform bundle.
- Confirm `checksums.sig` is created with release signing key.
- Confirm `macos-update-manifest.json` and `macos-update-manifest.sig` are generated for native macOS releases.
- Ensure checksum signatures are verified in CI before promotion.
- For macOS, confirm `dist/release/DraftHarbour.dmg` passes `hdiutil verify`.
- For macOS distribution builds, confirm `spctl -a -vv -t open dist/release/DraftHarbour.dmg` accepts the stapled DMG.

## 4) Updater release notes and UX
- Add release notes in updater metadata for in-app display.
- Smoke test native macOS install/open/save/export flows from the DMG.
- Run credential-backed provider checks with `npm run smoke:providers -- --require-configured` in a secure environment.
- Smoke test Windows/Linux update behavior where Tauri updater artifacts are still used.

## 5) Promotion and publication
- Promote only after `promote-release` succeeds.
- Publish checksums/signatures alongside artifacts.
- Tag release and announce channel-specific availability.
