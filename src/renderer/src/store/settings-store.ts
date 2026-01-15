import { create } from 'zustand'
import { AppSettings } from '../../../preload/index.d'

interface SettingsState {
  theme: 'light' | 'dark'
  workspaceFolder: string
  isLoading: boolean
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
  selectFolder: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'dark',
  workspaceFolder: '',
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true })
    try {
      const settings = await window.api.settings.get()
      set({
        theme: settings.theme,
        workspaceFolder: settings.workspaceFolder
      })
    } catch {
      // Settings loading failed - use defaults
      // In production, consider showing a toast notification
    } finally {
      set({ isLoading: false })
    }
  },

  updateSettings: async (updates: Partial<AppSettings>) => {
    const current = {
      theme: get().theme,
      workspaceFolder: get().workspaceFolder
    }

    try {
      const saved = await window.api.settings.update(updates)
      set({
        theme: saved.theme,
        workspaceFolder: saved.workspaceFolder
      })
    } catch {
      // Settings update failed - revert to previous state
      // In production, consider showing a toast notification
      set(current)
    }
  },

  selectFolder: async (): Promise<void> => {
    try {
      const folder = await window.api.settings.selectFolder()
      if (folder) {
        await get().updateSettings({ workspaceFolder: folder })
      }
    } catch {
      // Folder selection cancelled or failed - silently ignore
      // User can try again if needed
    }
  }
}))
