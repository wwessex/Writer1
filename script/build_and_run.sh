#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/macos"
PRODUCT="DraftHarbourNative"
APP_NAME="DraftHarbour"
APP_BUNDLE="$ROOT_DIR/dist/$APP_NAME.app"
CONTENTS_DIR="$APP_BUNDLE/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"
ICON_SOURCE="$ROOT_DIR/macos/Resources/DraftHarbour.icns"
CONFIGURATION="debug"
SHOULD_LAUNCH=1
SHOULD_VERIFY=0
STREAM_LOGS=0
DEBUG_LAUNCH=0

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

rm -rf "$APP_BUNDLE"
mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"
cp "$BIN_PATH" "$MACOS_DIR/$PRODUCT"
chmod +x "$MACOS_DIR/$PRODUCT"

if [[ -f "$ICON_SOURCE" ]]; then
  cp "$ICON_SOURCE" "$RESOURCES_DIR/DraftHarbour.icns"
fi

cat > "$CONTENTS_DIR/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>DraftHarbour</string>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeExtensions</key>
      <array>
        <string>dhproj</string>
      </array>
      <key>CFBundleTypeName</key>
      <string>DraftHarbour Project</string>
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
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
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

if command -v xattr >/dev/null 2>&1; then
  xattr -cr "$APP_BUNDLE"
fi
find "$APP_BUNDLE" -name '._*' -delete
codesign --force --deep --sign - "$APP_BUNDLE" >/dev/null

if [[ "$SHOULD_LAUNCH" -eq 1 ]]; then
  echo "Launching $APP_BUNDLE..."
  /usr/bin/open -n "$APP_BUNDLE"
else
  echo "Staged $APP_BUNDLE"
fi

if [[ "$DEBUG_LAUNCH" -eq 1 ]]; then
  lldb "$MACOS_DIR/$PRODUCT"
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
