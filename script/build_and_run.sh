#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/macos"
PRODUCT="DraftHarbourNative"
APP_NAME="DraftHarbour"
APP_BUNDLE="$ROOT_DIR/dist/$APP_NAME.app"
APP_OUTPUT_ROOT="${DRAFTHARBOUR_APP_OUTPUT_ROOT:-$HOME/Library/Caches/DraftHarbour/BuildProducts}"
APP_BUNDLE_REAL="$APP_OUTPUT_ROOT/$APP_NAME.app"
ICON_SOURCE="$ROOT_DIR/macos/Resources/DraftHarbour.icns"
APP_VERSION="${DRAFTHARBOUR_VERSION:-2.0.0}"
APP_BUILD="${DRAFTHARBOUR_BUILD:-200}"
CONFIGURATION="debug"
SHOULD_LAUNCH=1
SHOULD_VERIFY=0
STREAM_LOGS=0
DEBUG_LAUNCH=0
STAGING_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/draftharbour-build.XXXXXX")"
STAGING_APP="$STAGING_ROOT/$APP_NAME.app"
CONTENTS_DIR="$STAGING_APP/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

cleanup() {
  rm -rf "$STAGING_ROOT"
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

stage_localization_resources() {
  local localization
  for localization in en en_GB; do
    mkdir -p "$RESOURCES_DIR/$localization.lproj"
    cat > "$RESOURCES_DIR/$localization.lproj/InfoPlist.strings" <<'STRINGS'
"CFBundleDisplayName" = "DraftHarbour";
"CFBundleName" = "DraftHarbour";
"CFBundleTypeName" = "DraftHarbour Project";
"CFBundleURLName" = "DraftHarbour OAuth";
"NSHumanReadableCopyright" = "Copyright DraftHarbour";
"UTTypeDescription" = "DraftHarbour Project";
STRINGS
    cat > "$RESOURCES_DIR/$localization.lproj/Localizable.strings" <<'STRINGS'
/* Marks this bundle localization; app strings currently fall back to source literals. */
STRINGS
  done
}

for arg in "$@"; do
  case "$arg" in
    --release)
      CONFIGURATION="release"
      ;;
    --no-launch)
      SHOULD_LAUNCH=0
      ;;
    --verify)
      SHOULD_VERIFY=1
      SHOULD_LAUNCH=1
      ;;
    --logs|--telemetry)
      STREAM_LOGS=1
      SHOULD_LAUNCH=1
      ;;
    --debug)
      DEBUG_LAUNCH=1
      SHOULD_LAUNCH=1
      ;;
    "")
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 2
      ;;
  esac
done

echo "Building $PRODUCT..."
swift build --package-path "$PACKAGE_DIR" -c "$CONFIGURATION" --product "$PRODUCT"

BIN_DIR="$(swift build --package-path "$PACKAGE_DIR" -c "$CONFIGURATION" --show-bin-path)"
BIN_PATH="$BIN_DIR/$PRODUCT"

if [[ ! -x "$BIN_PATH" ]]; then
  echo "Built binary not found at $BIN_PATH" >&2
  exit 1
fi

pkill -x "$PRODUCT" >/dev/null 2>&1 || true

rm -rf "$STAGING_APP"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"
cp "$BIN_PATH" "$MACOS_DIR/$PRODUCT"
chmod +x "$MACOS_DIR/$PRODUCT"

if [[ -f "$ICON_SOURCE" ]]; then
  cp "$ICON_SOURCE" "$RESOURCES_DIR/DraftHarbour.icns"
fi

cat > "$CONTENTS_DIR/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleAllowMixedLocalizations</key>
  <true/>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>DraftHarbour</string>
  <key>CFBundleLocalizations</key>
  <array>
    <string>en</string>
    <string>en_GB</string>
  </array>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeExtensions</key>
      <array>
        <string>dhproj</string>
      </array>
      <key>CFBundleTypeName</key>
      <string>DraftHarbour Project</string>
      <key>CFBundleTypeIconFile</key>
      <string>DraftHarbour</string>
      <key>CFBundleTypeRole</key>
      <string>Editor</string>
      <key>LSHandlerRank</key>
      <string>Owner</string>
      <key>LSItemContentTypes</key>
      <array>
        <string>com.draftharbour.project</string>
      </array>
    </dict>
  </array>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLName</key>
      <string>DraftHarbour OAuth</string>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>draftharbour</string>
      </array>
    </dict>
  </array>
  <key>CFBundleExecutable</key>
  <string>DraftHarbourNative</string>
  <key>CFBundleIdentifier</key>
  <string>com.draftharbour.native</string>
  <key>CFBundleIconFile</key>
  <string>DraftHarbour</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>DraftHarbour</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$APP_VERSION</string>
  <key>CFBundleVersion</key>
  <string>$APP_BUILD</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.productivity</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>NSHumanReadableCopyright</key>
  <string>Copyright DraftHarbour</string>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
  <key>NSSupportsAutomaticTermination</key>
  <true/>
  <key>NSSupportsSuddenTermination</key>
  <true/>
  <key>UTExportedTypeDeclarations</key>
  <array>
    <dict>
      <key>UTTypeConformsTo</key>
      <array>
        <string>public.json</string>
      </array>
      <key>UTTypeDescription</key>
      <string>DraftHarbour Project</string>
      <key>UTTypeIdentifier</key>
      <string>com.draftharbour.project</string>
      <key>UTTypeIconFile</key>
      <string>DraftHarbour</string>
      <key>UTTypeTagSpecification</key>
      <dict>
        <key>public.filename-extension</key>
        <array>
          <string>dhproj</string>
        </array>
        <key>public.mime-type</key>
        <string>application/x-dhproj</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>
PLIST

stage_localization_resources

strip_bundle_metadata "$STAGING_APP"
codesign --force --deep --sign - "$STAGING_APP" >/dev/null
verify_bundle_signature "$STAGING_APP"

mkdir -p "$(dirname "$APP_BUNDLE")" "$APP_OUTPUT_ROOT"
rm -rf "$APP_BUNDLE" "$APP_BUNDLE_REAL"
ditto --norsrc --noextattr --noqtn "$STAGING_APP" "$APP_BUNDLE_REAL"
verify_bundle_signature "$APP_BUNDLE_REAL"
ln -s "$APP_BUNDLE_REAL" "$APP_BUNDLE"
verify_bundle_signature "$APP_BUNDLE"

if [[ "$SHOULD_LAUNCH" -eq 1 ]]; then
  echo "Launching $APP_BUNDLE..."
  /usr/bin/open -n "$APP_BUNDLE"
else
  echo "Staged $APP_BUNDLE"
fi

if [[ "$DEBUG_LAUNCH" -eq 1 ]]; then
  lldb "$APP_BUNDLE/Contents/MacOS/$PRODUCT"
elif [[ "$STREAM_LOGS" -eq 1 ]]; then
  /usr/bin/log stream --info --predicate "process == '$PRODUCT'"
elif [[ "$SHOULD_VERIFY" -eq 1 ]]; then
  sleep 2
  if pgrep -x "$PRODUCT" >/dev/null; then
    echo "$PRODUCT is running."
  else
    echo "$PRODUCT did not stay running." >&2
    exit 1
  fi
fi
