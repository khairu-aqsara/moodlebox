import { create } from 'zustand'
import { Project } from '../types'

interface ProjectStore {
  projects: Project[]
  loadProjects: () => Promise<void>
  addProject: (project: Omit<Project, 'id' | 'createdAt'>) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => Promise<void>
  startProject: (id: string) => Promise<void>
  stopProject: (id: string) => Promise<void>
  openFolder: (path: string) => Promise<void>
  openBrowser: (port: number) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],

  loadProjects: async () => {
    try {
      const projects = await window.api.projects.getAll()
      set({ projects })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Failed to load projects:', errorMessage)
      set({ projects: [] })
    }
  },

  addProject: async (project) => {
    try {
      const newProject = await window.api.projects.create(project)
      set((state) => ({ projects: [...state.projects, newProject] }))
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Failed to add project:', errorMessage)
      throw error
    }
  },

  updateProject: (id, updates) => {
    try {
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p))
      }))
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Failed to update project:', errorMessage)
    }
  },

  deleteProject: async (id) => {
    try {
      await window.api.projects.delete(id)
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id)
      }))
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Failed to delete project:', errorMessage)
      throw error
    }
  },

  startProject: async (id) => {
    try {
      await window.api.projects.start(id)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Failed to start project:', errorMessage)
      throw error
    }
  },

  stopProject: async (id) => {
    try {
      await window.api.projects.stop(id)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Failed to stop project:', errorMessage)
      throw error
    }
  },

  openFolder: async (path) => {
    try {
      await window.api.projects.openFolder(path)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Failed to open folder:', errorMessage)
    }
  },

  openBrowser: async (port) => {
    try {
      await window.api.projects.openBrowser(port)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Failed to open browser:', errorMessage)
    }
  }
}))

// Store IPC listener cleanup functions
let logListenerCleanup: (() => void) | null = null
let updateListenerCleanup: (() => void) | null = null

// Listen for project updates from main process
const setupIPCListeners = (): void => {
  // Guard: ensure window.api is available (preload script must have run)
  if (typeof window === 'undefined' || !window.api?.projects) {
    return
  }

  // Clean up existing listeners if any
  if (logListenerCleanup) logListenerCleanup()
  if (updateListenerCleanup) updateListenerCleanup()

  // Set up log listener (logs are handled by main process)
  logListenerCleanup = window.api.projects.onLog(() => {
    // Logs are handled by main process, no need to log here
  })

  // Set up project state update listener
  updateListenerCleanup = window.api.projects.onProjectUpdate(({ id, updates }) => {
    try {
      const state = useProjectStore.getState()
      if (!state.projects) {
        console.warn('Received project update but projects array is undefined')
        return
      }
      useProjectStore.setState(() => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p))
      }))
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Failed to process project update:', errorMessage)
    }
  })
}

// Initialize listeners when DOM is ready (ensures preload script has run)
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setupIPCListeners()
  } else {
    document.addEventListener('DOMContentLoaded', setupIPCListeners)
  }
}

// Cleanup on page unload (though Electron apps typically don't unload)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (logListenerCleanup) logListenerCleanup()
    if (updateListenerCleanup) updateListenerCleanup()
  })
}
