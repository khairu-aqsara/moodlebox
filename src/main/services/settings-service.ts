import Store from 'electron-store'
import { app } from 'electron'
import { join, resolve, normalize } from 'path'
import log from 'electron-log'

export interface AppSettings {
  theme: 'light' | 'dark'
  workspaceFolder: string
}

interface SettingsStoreSchema {
  settings: AppSettings
}

export class SettingsService {
  private store!: Store<SettingsStoreSchema> & {
    get<K extends keyof SettingsStoreSchema>(key: K): SettingsStoreSchema[K]
    set<K extends keyof SettingsStoreSchema>(key: K, value: SettingsStoreSchema[K]): void
  }
  private initialized: boolean = false

  constructor() {
    // Don't initialize store yet - wait until first use
    // This avoids calling app.getPath() before app is ready
  }

  private ensureStoreInitialized(): void {
    if (!this.initialized) {
      const defaultWorkspaceFolder = join(app.getPath('documents'), 'MoodleBox')

      this.store = new Store<SettingsStoreSchema>({
        defaults: {
          settings: {
            theme: 'dark',
            workspaceFolder: defaultWorkspaceFolder
          }
        }
      }) as Store<SettingsStoreSchema> & {
        get<K extends keyof SettingsStoreSchema>(key: K): SettingsStoreSchema[K]
        set<K extends keyof SettingsStoreSchema>(key: K, value: SettingsStoreSchema[K]): void
      }
      this.initialized = true
    }
  }

  getSettings(): AppSettings {
    this.ensureStoreInitialized()
    const settings = this.store.get('settings')

    // Ensure workspaceFolder is always an absolute path
    if (settings.workspaceFolder) {
      let workspacePath = settings.workspaceFolder.trim()
      const originalPath = workspacePath

      // Check if path looks like it's missing the leading slash (Unix) or drive letter (Windows)
      // On Unix: paths starting with "Users/", "home/", etc. are likely missing leading /
      // On Windows: paths without drive letter are invalid
      const isUnixLike = process.platform !== 'win32'

      if (isUnixLike) {
        // If path doesn't start with / but looks like an absolute path (e.g., "Users/...")
        // it's likely missing the leading slash
        if (
          !workspacePath.startsWith('/') &&
          (workspacePath.startsWith('Users/') ||
            workspacePath.startsWith('home/') ||
            workspacePath.startsWith('var/') ||
            workspacePath.startsWith('opt/') ||
            workspacePath.startsWith('usr/'))
        ) {
          workspacePath = '/' + workspacePath
        }
      } else {
        // On Windows, ensure we have a drive letter or UNC path
        if (!/^[a-zA-Z]:/.test(workspacePath) && !workspacePath.startsWith('\\\\')) {
          // If it looks like a path but missing drive, resolve from current working directory
          // This handles cases where path was stored incorrectly
        }
      }

      // Normalize and resolve to ensure it's absolute
      // resolve() will make it absolute if it's relative, or normalize if already absolute
      const normalizedPath = resolve(normalize(workspacePath))

      // If we fixed the path, persist it back to the store
      if (normalizedPath !== originalPath && normalizedPath !== settings.workspaceFolder) {
        log.info(`Auto-fixed workspace folder path: "${originalPath}" -> "${normalizedPath}"`)
        settings.workspaceFolder = normalizedPath
        // Persist the fix back to the store
        this.store.set('settings', settings)
      } else {
        settings.workspaceFolder = normalizedPath
      }
    }

    return settings
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.ensureStoreInitialized()
    const current = this.getSettings()
    const newSettings = { ...current, ...updates }

    // Normalize workspaceFolder if it's being updated
    if (updates.workspaceFolder) {
      let workspacePath = updates.workspaceFolder.trim()

      // Ensure absolute path (same logic as getSettings)
      const isUnixLike = process.platform !== 'win32'

      if (isUnixLike) {
        if (
          !workspacePath.startsWith('/') &&
          (workspacePath.startsWith('Users/') ||
            workspacePath.startsWith('home/') ||
            workspacePath.startsWith('var/'))
        ) {
          workspacePath = '/' + workspacePath
        }
      }

      newSettings.workspaceFolder = resolve(normalize(workspacePath))
    }

    this.store.set('settings', newSettings)
    return newSettings
  }
}
