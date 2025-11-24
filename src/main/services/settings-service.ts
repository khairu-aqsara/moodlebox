import Store from 'electron-store'
import { app } from 'electron'
import { join } from 'path'

export interface AppSettings {
  theme: 'light' | 'dark'
  workspaceFolder: string
  phpMyAdminPort: number
}

interface SettingsStoreSchema {
  settings: AppSettings
}

export class SettingsService {
  private store: any // electron-store type definition issues
  private initialized: boolean = false

  constructor() {
    // Don't initialize store yet - wait until first use
    // This avoids calling app.getPath() before app is ready
  }

  private ensureStoreInitialized() {
    if (!this.initialized) {
      const defaultWorkspaceFolder = join(app.getPath('documents'), 'MoodleBox')
      
      this.store = new Store<SettingsStoreSchema>({
        defaults: {
          settings: {
            theme: 'dark',
            workspaceFolder: defaultWorkspaceFolder,
            phpMyAdminPort: 8081
          }
        }
      }) as any
      this.initialized = true
    }
  }

  getSettings(): AppSettings {
    this.ensureStoreInitialized()
    return this.store.get('settings')
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    this.ensureStoreInitialized()
    const current = this.getSettings()
    const newSettings = { ...current, ...updates }
    this.store.set('settings', newSettings)
    return newSettings
  }
}
