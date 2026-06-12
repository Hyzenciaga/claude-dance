#!/bin/sh
# Patch Electron.app's Info.plist to show "ClaudeDance" in macOS dock during dev
PLIST="node_modules/electron/dist/Electron.app/Contents/Info.plist"
[ -f "$PLIST" ] || exit 0
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName ClaudeDance" "$PLIST" 2>/dev/null
/usr/libexec/PlistBuddy -c "Set :CFBundleName ClaudeDance" "$PLIST" 2>/dev/null
