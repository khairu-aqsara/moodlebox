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
    const projects = await window.api.projects.getAll()
    set({ projects })
  },

  addProject: async (project) => {
    const newProject = await window.api.projects.create(project)
    set((state) => ({ projects: [...state.projects, newProject] }))
  },

  updateProject: (id, updates) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p))
    }))
  },

  deleteProject: async (id) => {
    await window.api.projects.delete(id)
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id)
    }))
  },

  startProject: async (id) => {
    await window.api.projects.start(id)
  },

  stopProject: async (id) => {
    await window.api.projects.stop(id)
  },

  openFolder: async (path) => {
    await window.api.projects.openFolder(path)
  },

  openBrowser: async (port) => {
    await window.api.projects.openBrowser(port)
  }
}))

// Store IPC listener cleanup functions
let logListenerCleanup: (() => void) | null = null
let updateListenerCleanup: (() => void) | null = null

// Listen for project updates from main process
const setupIPCListeners = () => {
  // Clean up existing listeners if any
  if (logListenerCleanup) logListenerCleanup()
  if (updateListenerCleanup) updateListenerCleanup()

  // Set up log listener (logs are handled by main process)
  logListenerCleanup = window.api.projects.onLog(() => {
    // Logs are handled by main process, no need to log here
  })

  // Set up project state update listener
  updateListenerCleanup = window.api.projects.onProjectUpdate(({ id, updates }) => {
    useProjectStore.setState((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p))
    }))
  })
}

// Initialize listeners when store is created
setupIPCListeners()

// Cleanup on page unload (though Electron apps typically don't unload)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (logListenerCleanup) logListenerCleanup()
    if (updateListenerCleanup) updateListenerCleanup()
  })
}
