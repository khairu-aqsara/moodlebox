# MoodleBox Security & Architecture Improvement Plan

This document tracks planned improvements for the MoodleBox application, organized by priority.

## Deferred Tasks

### Implement Credential Encryption for docker-compose.yml

**Status:** Deferred
**Priority:** P2 (High)
**Location:** src/main/services/compose-generator.ts

**Issue:** Database passwords are currently stored in plaintext in docker-compose.yml files.

**Current Implementation:**

```typescript
// compose-generator.ts:106-110
private generatePassword(): string {
  const randomPart = randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 16)
  return 'moodle_dev_' + randomPart
}
```

The generated password is written plaintext to:

```yaml
environment:
  - MYSQL_ROOT_PASSWORD=${password} # Plaintext in file
  - MYSQL_PASSWORD=${password} # Plaintext in file
  - MOODLE_DBPASSWORD=${password} # Plaintext in file
```

**Proposed Solution:**

- Use Docker secrets or environment-specific secret management
- Encrypt credentials at rest using encryption library
- Consider using system keychain for credential storage

**Implementation Complexity:** Medium
**Estimated Effort:** 4-6 hours

**Dependencies:** None (can be implemented independently)

---

## Completed Tasks

### 1. Fixed Docker Healthcheck Password Syntax

**Date:** 2025-12-23
**File:** src/main/services/compose-generator.ts:87

**Change:** Updated mysqladmin healthcheck to use `--password=` long option for cross-platform compatibility.

```yaml
# Before:
test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${password}"]

# After:
test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "--password=${password}"]
```

**Reason:** Short `-p` option doesn't work consistently on Windows. Long `--password=` option works on all platforms.

---

## Remaining Tasks

### P0: Critical Security (Immediate Action Required)

#### 1. Enable Electron Sandbox

**File:** src/main/index.ts:108
**Current:** `sandbox: false`
**Required:** `sandbox: true`

#### 2. Add Explicit Security Preferences

**File:** src/main/index.ts:106-109
**Add:** `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`

#### 3. Fix Path Traversal Validation

**File:** src/main/services/project-service.ts:489-491
**Current:** Logs warning only
**Required:** Throw error to reject invalid paths

#### 4. Add IPC Input Validation

**Files:** src/main/index.ts (IPC handlers)
**Required:** Add Zod schema validation for all IPC inputs

#### 5. Fix Dependency Vulnerabilities

**File:** package.json
**Required:** Update vulnerable dependencies (form-data, request, tough-cookie)

---

## Task Notes

The credential encryption task is deferred because:

1. It's a personal development tool (not exposed to internet)
2. Docker compose files are in user's local project directory
3. Requires significant refactoring of compose generation
4. Should be coordinated with any secrets management strategy

This task can be revisited when:

- Planning for multi-user scenarios
- Implementing cloud sync features
- Addressing production deployment requirements

---

## Completed Tasks (Security Improvements)

### 2. Enabled Electron Sandbox Mode

**Date:** 2025-12-23
**File:** src/main/index.ts:108

**Change:** Enabled sandbox mode with explicit security settings.

```typescript
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: true,           // Changed from false
  contextIsolation: true,   // Added
  nodeIntegration: false,   // Added
  webSecurity: true        // Added
}
```

**Reason:** Sandbox mode is a critical Electron security feature that isolates the renderer process from Node.js, preventing code injection attacks.

### 3. Fixed Path Traversal Validation

**Date:** 2025-12-23
**File:** src/main/services/project-service.ts:489-497

**Change:** Changed from warning only to throwing error on invalid paths.

**Before:**

```typescript
if (project.path.includes('..') || project.path.includes('~')) {
  log.warn(`Project path contains suspicious characters: ${project.path}`)
}
```

**After:**

```typescript
if (project.path.includes('..') || project.path.includes('~')) {
  throw new Error(
    `Project path contains invalid characters.\n\n` +
      `The path "${project.path}" contains '..' or '~' which is not allowed for security reasons.\n\n` +
      `Please provide a valid absolute path without path traversal components.`
  )
}
```

**Reason:** Prevents directory traversal attacks where malicious actors could access files outside the intended directory.

### 4. Added IPC Input Validation

**Date:** 2025-12-23
**File:** src/main/index.ts:141-247

**Change:** Added runtime validation for all IPC handler inputs using custom validator functions.

```typescript
const ProjectCreateSchema = {
  name: (val: unknown) => {
    if (typeof val !== 'string' || val.length < 1 || val.length > 100) {
      throw new Error('Project name must be a string between 1-100 characters')
    }
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(val)) {
      throw new Error(
        'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
      )
    }
    return val
  },
  port: (val: unknown) => {
    /* validates port range 1024-65535 */
  },
  moodleVersion: (val: unknown) => {
    /* validates version format */
  },
  path: (val: unknown) => {
    /* validates path length */
  }
}
```

**Reason:** Prevents injection attacks through compromised renderer processes or malicious preload scripts.

---

## Low Priority / Non-Issues

### Dev-Only Dependency Vulnerabilities

**Status:** Not Applicable - DevDependencies only
**Priority:** Informational

**Issue:** npm audit reports 13 vulnerabilities in electron-icon-builder's dependency tree:

- `form-data` (CRITICAL) - GHSA-fjxv-7rqg-78g4
- `request` (CRITICAL) - GHSA-p8p7-x288-28g6
- `tough-cookie` (HIGH) - Multiple CVEs
- `phin` (moderate) - GHSA-x565-32qp-m3vf
- `yargs-parser` (moderate) - GHSA-p9pc-299p-vxgp

**Why This Is Not a Security Risk:**
These packages are only used during development to build application icons. They are **not** bundled into the production application:

1. `electron-icon-builder` is in `devDependencies` (not `dependencies`)
2. The icon build script (`npm run icons:build`) is only run manually by developers
3. None of these vulnerable packages are imported or used by the application code
4. The built application (ASAR) does not contain any of these packages

**Verification:**

```bash
# Check production-only vulnerabilities (none found)
npm audit --omit=dev

# The vulnerable packages are only in:
# node_modules/electron-icon-builder/node_modules/...
```

**When to Address:**

- When updating or replacing `electron-icon-builder` with a modern alternative
- If implementing automated icon generation in CI/CD pipelines
- When electron-icon-builder publishes updates to its dependencies

---

## Non-Critical Issues (Deferred)

### Pre-existing TypeScript Errors in Renderer Process

**Status:** Informational
**Priority:** Low
**Files:** src/renderer/src/\*_/_.tsx

**Issue:** TypeScript compilation shows 9 errors in React components:

```
src/renderer/src/App.tsx(6,17): error TS2503: Cannot find namespace 'JSX'.
src/renderer/src/components/Dashboard.tsx(15,62): error TS2503: Cannot find namespace 'JSX'.
src/renderer/src/components/NewProjectModal.tsx(77,69): error TS2503: Cannot find namespace 'JSX'.
src/renderer/src/components/ProjectCard.tsx(42,61): error TS2503: Cannot find namespace 'JSX'.
src/renderer/src/components/ProjectCard.tsx(298,33): error TS2367: This comparison appears to be unintentional...
src/renderer/src/components/SettingsModal.tsx(11,65): error TS2503: Cannot find namespace 'JSX'.
src/renderer/src/components/ui/dialog.tsx(57,43): error TS2503: Cannot find namespace 'JSX'.
src/renderer/src/components/ui/dialog.tsx(65,43): error TS2503: Cannot find namespace 'JSX'.
```

**Why This Is Low Priority:**

1. These are pre-existing issues, not introduced by security changes
2. The main process typecheck passes (all security fixes are in main process)
3. Related to React 19 + TypeScript configuration, not runtime errors
4. App builds and runs correctly despite these type errors

**When to Address:**

- During TypeScript configuration cleanup
- When upgrading React/TypeScript versions
- As part of general code quality improvements

---

## Summary

**Completed Security Fixes (2025-12-23):**

1. Fixed Docker healthcheck password syntax for cross-platform compatibility
2. Enabled Electron sandbox mode with explicit security settings
3. Fixed path traversal validation to reject malicious paths
4. Added IPC input validation for all handlers

**Deferred Tasks:**

1. Implement credential encryption for docker-compose.yml (P2 - High)
2. Fix pre-existing renderer TypeScript errors (Low)
3. Replace electron-icon-builder to eliminate dev-only vulnerabilities (Informational)
