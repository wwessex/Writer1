# Desktop Release Checklist

## 1) Channel and manifest readiness
- Confirm target channel (`stable`, `beta`, or `nightly`).
- Ensure corresponding manifest file in `docs/releases/manifests/` is updated.
- Verify `RELEASE_CHANNEL` matches the intended publish channel.

## 2) CI pipeline gates
- Trigger `.github/workflows/desktop-release.yml`.
- Validate the native macOS job and Windows/Linux Tauri jobs pass.
- Confirm Windows signing variables are present when Windows release signing is required.
- Confirm macOS local beta output is ad-hoc signed, DMG-verified, and checksumed; Developer ID signing/notarization requires `APPLE_SIGNING_IDENTITY` and `APPLE_NOTARY_KEYCHAIN_PROFILE`.

## 3) Artifact integrity
- Confirm `checksums.txt` is generated per platform bundle.
- Confirm `checksums.sig` is created with release signing key.
- Ensure checksum signatures are verified in CI before promotion.
- For macOS, confirm `dist/release/DraftHarbour.dmg` passes `hdiutil verify`.

## 4) Updater release notes and UX
- Add release notes in updater metadata for in-app display.
- Smoke test native macOS install/open/save/export flows from the DMG.
- Smoke test Windows/Linux update behavior where Tauri updater artifacts are still used.

## 5) Promotion and publication
- Promote only after `promote-release` succeeds.
- Publish checksums/signatures alongside artifacts.
- Tag release and announce channel-specific availability.
