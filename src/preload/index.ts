import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface Project {
  id: string
  name: string
  moodleVersion: string
  port: number
  status: 'provisioning' | 'installing' | 'starting' | 'waiting' | 'ready' | 'stopped' | 'error'
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
    create: (project: any) =>
      ipcRenderer.invoke('projects:create', project),
    start: (id: string) => ipcRenderer.invoke('projects:start', id),
    stop: (id: string) => ipcRenderer.invoke('projects:stop', id),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
    openFolder: (path: string) => ipcRenderer.invoke('projects:openFolder', path),
    openBrowser: (port: number) => ipcRenderer.invoke('projects:openBrowser', port),
    getDefaultPath: () => ipcRenderer.invoke('projects:getDefaultPath'),
    onLog: (callback: (data: { id: string; log: string }) => void) => {
      ipcRenderer.on('project:log', (_, data) => callback(data))
    },
    onProjectUpdate: (callback: (data: { id: string; updates: Partial<Project> }) => void) => {
      ipcRenderer.on('project:updated', (_, data) => callback(data))
    },
    checkDocker: () => ipcRenderer.invoke('projects:checkDocker')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings: any) => ipcRenderer.invoke('settings:update', settings),
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
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
