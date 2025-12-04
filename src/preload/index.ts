import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface AppSettings {
  theme: 'light' | 'dark'
  workspaceFolder: string
  phpMyAdminPort: number
}

export interface Project {
  id: string
  name: string
  moodleVersion: string
  port: number
  status: 'provisioning' | 'installing' | 'starting' | 'waiting' | 'ready' | 'stopped' | 'stopping' | 'deleting' | 'error'
  path: string
  createdAt: string
  lastUsed?: string
  errorMessage?: string
  progress?: ProgressInfo
  statusDetail?: string
}

export interface ProgressInfo {
  phase: string
  percentage?: number
  current?: number
  total?: number
  message?: string
}

// Custom APIs for renderer
const api = {
  projects: {
    getAll: () => ipcRenderer.invoke('projects:getAll'),
    create: (project: Omit<Project, 'id' | 'createdAt'>) => ipcRenderer.invoke('projects:create', project),
    start: (id: string) => ipcRenderer.invoke('projects:start', id),
    stop: (id: string) => ipcRenderer.invoke('projects:stop', id),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
    openFolder: (path: string) => ipcRenderer.invoke('projects:openFolder', path),
    openBrowser: (port: number) => ipcRenderer.invoke('projects:openBrowser', port),
    getDefaultPath: () => ipcRenderer.invoke('projects:getDefaultPath'),
    onLog: (callback: (data: { id: string; log: string }) => void) => {
      const handler = (_: unknown, data: { id: string; log: string }) => callback(data)
      ipcRenderer.on('project:log', handler)
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('project:log', handler)
      }
    },
    onProjectUpdate: (callback: (data: { id: string; updates: Partial<Project> }) => void) => {
      const handler = (_: unknown, data: { id: string; updates: Partial<Project> }) => callback(data)
      ipcRenderer.on('project:updated', handler)
      // Return cleanup function
      return () => {
        ipcRenderer.removeListener('project:updated', handler)
      }
    },
    checkDocker: () => ipcRenderer.invoke('projects:checkDocker'),
    syncStates: () => ipcRenderer.invoke('projects:syncStates')
  },
  app: {
    getLogPath: () => ipcRenderer.invoke('app:getLogPath'),
    openLogFolder: () => ipcRenderer.invoke('app:openLogFolder')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', settings),
    selectFolder: () => ipcRenderer.invoke('settings:selectFolder')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    // Error during context bridge setup - this is a critical error
    // In production, this would be logged by electron-log if available
    // In preload, we can't use electron-log, so we rely on Electron's error handling
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
