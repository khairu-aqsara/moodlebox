#!/bin/bash
# Fix macOS Quarantine Issue for MoodleDocks
# This script removes the quarantine attribute that causes "damaged app" errors

set -e

echo "🔧 MoodleDocks macOS Quarantine Fix"
echo "=================================="
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ Error: This script is for macOS only"
    exit 1
fi

# Function to fix quarantine
fix_quarantine() {
    local path="$1"
    echo "📁 Removing quarantine attribute from: $path"
    xattr -cr "$path"
    echo "✅ Fixed: $path"
}

# Check for DMG files in Downloads
DMG_FILES=(~/Downloads/moodledocks*.dmg)
if [ -e "${DMG_FILES[0]}" ]; then
    echo "Found MoodleDocks DMG files in Downloads:"
    for dmg in ~/Downloads/moodledocks*.dmg; do
        [ -e "$dmg" ] || continue
        echo "  - $(basename "$dmg")"
        fix_quarantine "$dmg"
    done
    echo ""
fi

# Check for installed app
APP_PATH="/Applications/MoodleDocks.app"
if [ -d "$APP_PATH" ]; then
    echo "Found installed MoodleDocks app"
    fix_quarantine "$APP_PATH"
    echo ""
fi

echo "✅ Done! You can now open MoodleDocks normally."
echo ""
echo "If you still see issues, try:"
echo "  1. Restart your Mac"
echo "  2. Run: sudo spctl --master-disable (disables Gatekeeper temporarily)"
echo "  3. Open MoodleDocks, then run: sudo spctl --master-enable"
