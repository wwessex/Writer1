#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="DraftHarbour"
STAGED_APP="$ROOT_DIR/dist/$APP_NAME.app"
RELEASE_DIR="$ROOT_DIR/dist/release"
RELEASE_APP="$RELEASE_DIR/$APP_NAME.app"
RELEASE_OUTPUT_ROOT="${DRAFTHARBOUR_RELEASE_APP_OUTPUT_ROOT:-$HOME/Library/Caches/DraftHarbour/ReleaseProducts}"
RELEASE_APP_REAL="$RELEASE_OUTPUT_ROOT/$APP_NAME.app"
DMG_PATH="$RELEASE_DIR/$APP_NAME.dmg"
CHECKSUMS_PATH="$RELEASE_DIR/checksums.txt"
CHECKSUMS_SIG_PATH="$RELEASE_DIR/checksums.sig"
UPDATE_MANIFEST_PATH="$RELEASE_DIR/macos-update-manifest.json"
UPDATE_MANIFEST_SIG_PATH="$RELEASE_DIR/macos-update-manifest.sig"
ENTITLEMENTS="$ROOT_DIR/macos/DraftHarbourNative.entitlements"
PACKAGE_WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/draftharbour-package.XXXXXX")"
WORK_APP="$PACKAGE_WORK_DIR/$APP_NAME.app"
CHANNEL="${RELEASE_CHANNEL:-${DRAFTHARBOUR_RELEASE_CHANNEL:-stable}}"
UPDATE_BASE_URL="${DRAFTHARBOUR_UPDATE_BASE_URL:-}"
RELEASE_NOTES="${DRAFTHARBOUR_RELEASE_NOTES:-}"
DISTRIBUTION=0
SKIP_NOTARIZATION=0
NOTARIZATION_PERFORMED=0
STAPLED=0

cleanup() {
  rm -rf "$PACKAGE_WORK_DIR"
}
trap cleanup EXIT

usage() {
  cat <<USAGE
Usage: ./script/package_macos.sh [options]

Options:
  --distribution       Require Developer ID signing, notarization credentials, and release signing key.
  --skip-notarization  Skip notarytool/stapler. Intended for local dry-runs only.
  --channel <name>     Release channel for update metadata: stable, beta, or nightly.
  --help               Show this help.

Environment:
  APPLE_SIGNING_IDENTITY          Developer ID Application identity.
  APPLE_NOTARY_KEYCHAIN_PROFILE   notarytool keychain profile name.
  RELEASE_SIGNING_KEY             PEM private key used to sign checksums and update manifest.
  RELEASE_SIGNING_KEY_PATH        Alternative path to a PEM private key.
  DRAFTHARBOUR_UPDATE_BASE_URL    Optional base URL used in update metadata artifact URL.
  DRAFTHARBOUR_RELEASE_NOTES      Optional release notes embedded in update metadata.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --distribution)
      DISTRIBUTION=1
      shift
      ;;
    --skip-notarization)
      SKIP_NOTARIZATION=1
      shift
      ;;
    --channel)
      CHANNEL="${2:-}"
      if [[ -z "$CHANNEL" ]]; then
        echo "--channel requires a value" >&2
        exit 2
      fi
      shift 2
      ;;
    --channel=*)
      CHANNEL="${1#--channel=}"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

case "$CHANNEL" in
  stable|beta|nightly) ;;
  *)
    echo "Invalid release channel: $CHANNEL" >&2
    exit 2
    ;;
esac

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name" >&2
    exit 1
  fi
}

release_signing_key_file() {
  if [[ -n "${RELEASE_SIGNING_KEY_PATH:-}" ]]; then
    if [[ ! -f "$RELEASE_SIGNING_KEY_PATH" ]]; then
      echo "RELEASE_SIGNING_KEY_PATH does not exist: $RELEASE_SIGNING_KEY_PATH" >&2
      exit 1
    fi
    printf '%s\n' "$RELEASE_SIGNING_KEY_PATH"
    return 0
  fi

  if [[ -n "${RELEASE_SIGNING_KEY:-}" ]]; then
    local key_path="$PACKAGE_WORK_DIR/release_signing_key.pem"
    printf '%s\n' "$RELEASE_SIGNING_KEY" > "$key_path"
    chmod 600 "$key_path"
    printf '%s\n' "$key_path"
    return 0
  fi

  return 1
}

sign_release_file() {
  local input="$1"
  local output="$2"
  local key_path
  if key_path="$(release_signing_key_file)"; then
    echo "Signing $(basename "$input") -> $(basename "$output")"
    openssl dgst -sha256 -sign "$key_path" -out "$output" "$input"
  else
    echo "Release signing key is not set; skipping signature for $(basename "$input")."
  fi
}

preflight() {
  require_command swift
  require_command codesign
  require_command hdiutil
  require_command ditto
  require_command shasum
  require_command openssl
  require_command node

  if [[ "$DISTRIBUTION" -eq 1 ]]; then
    require_command security
    require_command xcrun
    if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
      echo "--distribution requires APPLE_SIGNING_IDENTITY." >&2
      exit 1
    fi
    if ! security find-identity -p codesigning -v | grep -F "$APPLE_SIGNING_IDENTITY" >/dev/null; then
      echo "Signing identity was not found in the keychain: $APPLE_SIGNING_IDENTITY" >&2
      exit 1
    fi
    if [[ "$SKIP_NOTARIZATION" -eq 0 && -z "${APPLE_NOTARY_KEYCHAIN_PROFILE:-}" ]]; then
      echo "--distribution requires APPLE_NOTARY_KEYCHAIN_PROFILE unless --skip-notarization is used for a dry-run." >&2
      exit 1
    fi
    if ! release_signing_key_file >/dev/null; then
      echo "--distribution requires RELEASE_SIGNING_KEY or RELEASE_SIGNING_KEY_PATH." >&2
      exit 1
    fi
  fi
}

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

assess_gatekeeper() {
  local path="$1"
  local description="$2"
  if spctl -a -vv "$path"; then
    echo "Gatekeeper accepted $description."
    return 0
  fi
  return 1
}

assess_dmg_gatekeeper() {
  local path="$1"
  if spctl -a -vv -t open "$path"; then
    echo "Gatekeeper accepted the notarized DMG."
    return 0
  fi
  return 1
}

preflight

"$ROOT_DIR/script/build_and_run.sh" --release --no-launch

rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR" "$RELEASE_OUTPUT_ROOT"
STAGED_APP_REAL="$(cd "$STAGED_APP" && pwd -P)"
ditto --norsrc --noextattr --noqtn "$STAGED_APP_REAL" "$WORK_APP"
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

rm -rf "$RELEASE_APP" "$RELEASE_APP_REAL"
ditto --norsrc --noextattr --noqtn "$WORK_APP" "$RELEASE_APP_REAL"
verify_bundle_signature "$RELEASE_APP_REAL"
ln -s "$RELEASE_APP_REAL" "$RELEASE_APP"
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
sign_release_file "$CHECKSUMS_PATH" "$CHECKSUMS_SIG_PATH"

if [[ "$SKIP_NOTARIZATION" -eq 1 ]]; then
  echo "Skipping notarization by request."
elif [[ -n "${APPLE_NOTARY_KEYCHAIN_PROFILE:-}" ]]; then
  echo "Submitting $DMG_PATH for notarization with keychain profile $APPLE_NOTARY_KEYCHAIN_PROFILE"
  xcrun notarytool submit "$DMG_PATH" --keychain-profile "$APPLE_NOTARY_KEYCHAIN_PROFILE" --wait
  xcrun stapler staple "$DMG_PATH"
  xcrun stapler validate "$DMG_PATH"
  NOTARIZATION_PERFORMED=1
  STAPLED=1
else
  echo "APPLE_NOTARY_KEYCHAIN_PROFILE is not set; skipping notarization."
fi

echo "Writing $UPDATE_MANIFEST_PATH"
manifest_args=(
  --app "$RELEASE_APP_REAL" \
  --dmg "$DMG_PATH" \
  --checksums "$CHECKSUMS_PATH" \
  --checksum-signature "$CHECKSUMS_SIG_PATH" \
  --output "$UPDATE_MANIFEST_PATH" \
  --channel "$CHANNEL" \
  --notarized "$NOTARIZATION_PERFORMED" \
  --stapled "$STAPLED"
)
if [[ -n "$UPDATE_BASE_URL" ]]; then
  manifest_args+=(--base-url "$UPDATE_BASE_URL")
fi
if [[ -n "$RELEASE_NOTES" ]]; then
  manifest_args+=(--release-notes "$RELEASE_NOTES")
fi
node "$ROOT_DIR/scripts/generate-macos-update-manifest.mjs" "${manifest_args[@]}"
sign_release_file "$UPDATE_MANIFEST_PATH" "$UPDATE_MANIFEST_SIG_PATH"

echo "Signing details:"
codesign -dvvv --entitlements :- "$WORK_APP" || true

echo "Gatekeeper assessment:"
if [[ "$NOTARIZATION_PERFORMED" -eq 1 ]]; then
  assess_dmg_gatekeeper "$DMG_PATH"
  assess_gatekeeper "$RELEASE_APP" "the release app bundle" || true
elif assess_gatekeeper "$WORK_APP" "the sanitized package app"; then
  :
elif [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  echo "Gatekeeper rejected the ad-hoc local beta build as expected because APPLE_SIGNING_IDENTITY is not set."
else
  if [[ "$DISTRIBUTION" -eq 1 ]]; then
    echo "Gatekeeper rejected a distribution build; inspect signing/notarization before release." >&2
    exit 1
  fi
  echo "Gatekeeper rejected a signed but unnotarized local dry-run build."
fi

echo "Release artifacts:"
echo "$RELEASE_APP"
echo "$DMG_PATH"
echo "$CHECKSUMS_PATH"
if [[ -f "$CHECKSUMS_SIG_PATH" ]]; then
  echo "$CHECKSUMS_SIG_PATH"
fi
echo "$UPDATE_MANIFEST_PATH"
if [[ -f "$UPDATE_MANIFEST_SIG_PATH" ]]; then
  echo "$UPDATE_MANIFEST_SIG_PATH"
fi
