#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="DraftHarbour"
STAGED_APP="$ROOT_DIR/dist/$APP_NAME.app"
RELEASE_DIR="$ROOT_DIR/dist/release"
RELEASE_APP="$RELEASE_DIR/$APP_NAME.app"
DMG_PATH="$RELEASE_DIR/$APP_NAME.dmg"
CHECKSUMS_PATH="$RELEASE_DIR/checksums.txt"
ENTITLEMENTS="$ROOT_DIR/macos/DraftHarbourNative.entitlements"
PACKAGE_WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/draftharbour-package.XXXXXX")"
WORK_APP="$PACKAGE_WORK_DIR/$APP_NAME.app"

cleanup() {
  rm -rf "$PACKAGE_WORK_DIR"
}
trap cleanup EXIT

strip_bundle_metadata() {
  local bundle="$1"
  if command -v xattr >/dev/null 2>&1; then
    for _ in 1 2 3; do
      xattr -cr "$bundle" 2>/dev/null || true
      find "$bundle" -exec xattr -c {} + 2>/dev/null || true
      xattr -d com.apple.FinderInfo "$bundle" 2>/dev/null || true
      xattr -d com.apple.ResourceFork "$bundle" 2>/dev/null || true
      xattr -d 'com.apple.fileprovider.fpfs#P' "$bundle" 2>/dev/null || true
      xattr -d com.apple.provenance "$bundle" 2>/dev/null || true
      sleep 0.1
    done
    xattr -c "$bundle" 2>/dev/null || true
    find "$bundle" -exec xattr -c {} + 2>/dev/null || true
  fi
  find "$bundle" -name '._*' -delete
  find "$bundle" -name '.DS_Store' -delete
}

verify_bundle_signature() {
  local bundle="$1"
  local attempt
  for attempt in 1 2 3 4 5; do
    strip_bundle_metadata "$bundle"
    if codesign --verify --deep --strict "$bundle" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.1
  done
  codesign --verify --deep --strict "$bundle"
}

"$ROOT_DIR/script/build_and_run.sh" --release --no-launch

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
ditto --norsrc --noextattr --noqtn "$STAGED_APP" "$WORK_APP"
strip_bundle_metadata "$WORK_APP"

if [[ -n "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  echo "Signing $WORK_APP with $APPLE_SIGNING_IDENTITY"
  codesign \
    --force \
    --deep \
    --options runtime \
    --entitlements "$ENTITLEMENTS" \
    --sign "$APPLE_SIGNING_IDENTITY" \
    "$WORK_APP"
else
  echo "APPLE_SIGNING_IDENTITY is not set; applying ad hoc signature for local validation."
  codesign --force --deep --sign - "$WORK_APP"
fi

echo "Code signature verification:"
verify_bundle_signature "$WORK_APP"

ditto --norsrc --noextattr --noqtn "$WORK_APP" "$RELEASE_APP"
verify_bundle_signature "$RELEASE_APP"

echo "Creating $DMG_PATH"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$WORK_APP" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

echo "Verifying $DMG_PATH"
hdiutil verify "$DMG_PATH"

echo "Writing $CHECKSUMS_PATH"
(
  cd "$RELEASE_DIR"
  shasum -a 256 "$APP_NAME.dmg" > "$CHECKSUMS_PATH"
)

if [[ -n "${APPLE_NOTARY_KEYCHAIN_PROFILE:-}" ]]; then
  echo "Submitting $DMG_PATH for notarization with keychain profile $APPLE_NOTARY_KEYCHAIN_PROFILE"
  xcrun notarytool submit "$DMG_PATH" --keychain-profile "$APPLE_NOTARY_KEYCHAIN_PROFILE" --wait
  xcrun stapler staple "$DMG_PATH"
else
  echo "APPLE_NOTARY_KEYCHAIN_PROFILE is not set; skipping notarization."
fi

echo "Signing details:"
codesign -dvvv --entitlements :- "$WORK_APP" || true

echo "Gatekeeper assessment:"
if spctl -a -vv "$WORK_APP"; then
  echo "Gatekeeper accepted the sanitized package app."
elif [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  echo "Gatekeeper rejected the ad-hoc local beta build as expected because APPLE_SIGNING_IDENTITY is not set."
else
  echo "Gatekeeper rejected a Developer ID-signed build; inspect signing/notarization before release." >&2
  exit 1
fi

echo "Release artifacts:"
echo "$RELEASE_APP"
echo "$DMG_PATH"
echo "$CHECKSUMS_PATH"
