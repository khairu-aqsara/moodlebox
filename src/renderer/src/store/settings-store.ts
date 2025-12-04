import { create } from 'zustand'
import { AppSettings } from '../../../preload/index.d'

interface SettingsState {
  theme: 'light' | 'dark'
  workspaceFolder: string
  phpMyAdminPort: number
  isLoading: boolean
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  selectFolder: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'dark',
  workspaceFolder: '',
  phpMyAdminPort: 8081,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true })
    try {
      const settings = await window.api.settings.get()
      set({
        theme: settings.theme,
        workspaceFolder: settings.workspaceFolder,
        phpMyAdminPort: settings.phpMyAdminPort
      })
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  updateSettings: async (updates: Partial<AppSettings>) => {
    const current = {
      theme: get().theme,
      workspaceFolder: get().workspaceFolder,
      phpMyAdminPort: get().phpMyAdminPort
    }

    try {
      const saved = await window.api.settings.update(updates)
      set({
        theme: saved.theme,
        workspaceFolder: saved.workspaceFolder,
        phpMyAdminPort: saved.phpMyAdminPort
      })
    } catch (error) {
      console.error('Failed to update settings:', error)
      // Revert on error
      set(current)
    }
  },

  selectFolder: async () => {
    try {
      const folder = await window.api.settings.selectFolder()
      if (folder) {
        await get().updateSettings({ workspaceFolder: folder })
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
    }
  }
}))
