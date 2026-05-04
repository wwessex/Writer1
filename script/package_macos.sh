#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="DraftHarbour"
STAGED_APP="$ROOT_DIR/dist/$APP_NAME.app"
RELEASE_DIR="$ROOT_DIR/dist/release"
RELEASE_APP="$RELEASE_DIR/$APP_NAME.app"
DMG_PATH="$RELEASE_DIR/$APP_NAME.dmg"
ENTITLEMENTS="$ROOT_DIR/macos/DraftHarbourNative.entitlements"

"$ROOT_DIR/script/build_and_run.sh" --release --no-launch

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
cp -R "$STAGED_APP" "$RELEASE_APP"
if command -v xattr >/dev/null 2>&1; then
  xattr -cr "$RELEASE_APP"
fi
find "$RELEASE_APP" -name '._*' -delete

if [[ -n "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  echo "Signing $RELEASE_APP with $APPLE_SIGNING_IDENTITY"
  codesign \
    --force \
    --deep \
    --options runtime \
    --entitlements "$ENTITLEMENTS" \
    --sign "$APPLE_SIGNING_IDENTITY" \
    "$RELEASE_APP"
else
  echo "APPLE_SIGNING_IDENTITY is not set; applying ad hoc signature for local validation."
  codesign --force --deep --sign - "$RELEASE_APP"
fi

echo "Creating $DMG_PATH"
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$RELEASE_APP" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

if [[ -n "${APPLE_NOTARY_KEYCHAIN_PROFILE:-}" ]]; then
  echo "Submitting $DMG_PATH for notarization with keychain profile $APPLE_NOTARY_KEYCHAIN_PROFILE"
  xcrun notarytool submit "$DMG_PATH" --keychain-profile "$APPLE_NOTARY_KEYCHAIN_PROFILE" --wait
  xcrun stapler staple "$DMG_PATH"
else
  echo "APPLE_NOTARY_KEYCHAIN_PROFILE is not set; skipping notarization."
fi

echo "Signing details:"
codesign -dvvv --entitlements :- "$RELEASE_APP" || true

echo "Gatekeeper assessment:"
spctl -a -vv "$RELEASE_APP" || true

echo "Release artifacts:"
echo "$RELEASE_APP"
echo "$DMG_PATH"
