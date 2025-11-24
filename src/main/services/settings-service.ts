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

  constructor() {
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
  }

  getSettings(): AppSettings {
    return this.store.get('settings')
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    const current = this.getSettings()
    const newSettings = { ...current, ...updates }
    this.store.set('settings', newSettings)
    return newSettings
  }
}
