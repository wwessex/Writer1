# Desktop Release Checklist

## 1) Channel and manifest readiness
- Confirm target channel (`stable`, `beta`, or `nightly`).
- Ensure corresponding manifest file in `docs/releases/manifests/` is updated.
- Verify `RELEASE_CHANNEL` matches the intended publish channel.

## 2) CI pipeline gates
- Trigger `.github/workflows/desktop-release.yml`.
- Validate all matrix jobs pass for macOS, Windows, and Linux.
- Confirm bundle signing variables are present and artifacts are signed.

## 3) Artifact integrity
- Confirm `checksums.txt` is generated per platform bundle.
- Confirm `checksums.sig` is created with release signing key.
- Ensure checksum signatures are verified in CI before promotion.

## 4) Updater release notes and UX
- Add release notes in updater metadata for in-app display.
- Smoke test: Check for updates, defer install, and restart-to-apply.
- Verify pinned-version and fallback guardrails are respected.

## 5) Promotion and publication
- Promote only after `promote-release` succeeds.
- Publish checksums/signatures alongside artifacts.
- Tag release and announce channel-specific availability.
