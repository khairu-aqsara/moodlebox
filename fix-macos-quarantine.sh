#!/bin/bash
# Fix macOS Quarantine Issue for MoodleBox
# This script removes the quarantine attribute that causes "damaged app" errors

set -e

echo "🔧 MoodleBox macOS Quarantine Fix"
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
DMG_FILES=(~/Downloads/moodlebox*.dmg)
if [ -e "${DMG_FILES[0]}" ]; then
    echo "Found MoodleBox DMG files in Downloads:"
    for dmg in ~/Downloads/moodlebox*.dmg; do
        [ -e "$dmg" ] || continue
        echo "  - $(basename "$dmg")"
        fix_quarantine "$dmg"
    done
    echo ""
fi

# Check for installed app
APP_PATH="/Applications/MoodleBox.app"
if [ -d "$APP_PATH" ]; then
    echo "Found installed MoodleBox app"
    fix_quarantine "$APP_PATH"
    echo ""
fi

echo "✅ Done! You can now open MoodleBox normally."
echo ""
echo "If you still see issues, try:"
echo "  1. Restart your Mac"
echo "  2. Run: sudo spctl --master-disable (disables Gatekeeper temporarily)"
echo "  3. Open MoodleBox, then run: sudo spctl --master-enable"
