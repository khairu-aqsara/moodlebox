# macOS "Damaged App" Fix

## The Problem

When users download MoodleBox built from GitHub Actions and try to open it, macOS shows:

> "MoodleBox is damaged and can't be opened. You should move it to the Trash."

This happens even when right-clicking → Open, which normally bypasses Gatekeeper.

## Root Cause

The issue occurs because:

1. **Hardened Runtime Enabled Without Signing**: The previous `electron-builder.yml` had:

   ```yaml
   hardenedRuntime: true
   gatekeeperAssess: true
   ```

   These settings enable macOS security features that **require** a valid code signature. Without signing, the app is marked as invalid.

2. **Quarantine Attributes**: macOS adds quarantine attributes (`com.apple.quarantine`) to downloaded files, which triggers Gatekeeper checks.

3. **GitHub Builds vs Local Builds**:
   - **Local builds** work because macOS trusts apps built on the same machine
   - **GitHub builds** fail because they're treated as external downloads

## The Fix

### Changes Made

#### 1. Updated `electron-builder.yml`

```yaml
mac:
  # Disabled hardened runtime for unsigned builds
  hardenedRuntime: false
  gatekeeperAssess: false
  identity: null
  # Commented out entitlements (only needed for signed builds)
  # entitlements: build/entitlements.mac.plist
  # entitlementsInherit: build/entitlements.mac.plist

dmg:
  sign: false
  writeUpdateInfo: false # Added to skip signature validation
```

#### 2. Created Fix Script (`fix-macos-quarantine.sh`)

Automatically removes quarantine attributes from:

- Downloaded DMG files in `~/Downloads/`
- Installed app at `/Applications/MoodleBox.app`

#### 3. Updated README.md

Added clear instructions for users with 4 solutions:

1. Use the fix script (easiest)
2. Manual command for DMG
3. Manual command for installed app
4. System Settings override

#### 4. Updated GitHub Actions Workflow

Added installation instructions to release notes with quarantine fix commands.

## How Users Can Fix It

### Option 1: Before Opening DMG (Recommended)

```bash
xattr -cr ~/Downloads/moodlebox-*.dmg
```

Then open the DMG normally.

### Option 2: After Installation

If the app is already installed but won't open:

```bash
xattr -cr /Applications/MoodleBox.app
```

### Option 3: Use Fix Script

```bash
curl -O https://raw.githubusercontent.com/yourusername/ezadevbox/main/fix-macos-quarantine.sh
chmod +x fix-macos-quarantine.sh
./fix-macos-quarantine.sh
```

## Why This Works

- **Removing hardened runtime**: Allows unsigned apps to run without code signature validation
- **Removing quarantine attributes**: Tells macOS the app is trusted (user explicitly chose to remove protection)
- **Setting identity to null**: Prevents electron-builder from attempting to sign with a non-existent certificate

## Future: Proper Code Signing

For production releases, you should implement proper code signing:

### Requirements

1. **Apple Developer Account** ($99/year)
2. **Developer ID Application Certificate**
3. **App-Specific Password** for notarization

### GitHub Secrets Needed

```yaml
CSC_LINK: <base64-encoded .p12 certificate>
CSC_KEY_PASSWORD: <certificate password>
APPLE_ID: <your Apple ID email>
APPLE_APP_SPECIFIC_PASSWORD: <app-specific password>
APPLE_TEAM_ID: <your team ID>
```

### electron-builder.yml Changes

```yaml
mac:
  hardenedRuntime: true
  gatekeeperAssess: true
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  identity: ${env.CSC_NAME}
  notarize:
    teamId: ${env.APPLE_TEAM_ID}

dmg:
  sign: true
```

### Benefits of Code Signing

- No quarantine warnings
- Users can double-click to open (no Terminal commands needed)
- App appears as "verified" in macOS
- Required for Mac App Store distribution
- Professional appearance

## Testing

After making these changes:

1. **Local Test**:

   ```bash
   npm run build:mac
   ```

   The built DMG should open without quarantine issues.

2. **GitHub Actions Test**:
   - Push changes and trigger workflow
   - Download the built DMG from artifacts
   - Try opening without removing quarantine (should still fail)
   - Run fix command: `xattr -cr ~/Downloads/moodlebox-*.dmg`
   - Should now open successfully

## References

- [Electron Builder Code Signing](https://www.electron.build/code-signing)
- [Apple Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [xattr man page](https://ss64.com/osx/xattr.html)
