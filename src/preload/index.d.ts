import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      projects: {
        getAll: () => Promise<Project[]>
        create: (project: any) => Promise<Project>
        start: (id: string) => Promise<void>
        stop: (id: string) => Promise<void>
        delete: (id: string) => Promise<void>
        openFolder: (path: string) => Promise<void>
        openBrowser: (port: number) => Promise<void>
        getDefaultPath: () => Promise<string>
        onLog: (callback: (data: { id: string; log: string }) => void) => void
        onProjectUpdate: (callback: (data: { id: string; updates: Partial<Project> }) => void) => void
        checkDocker: () => Promise<boolean>
      }
      settings: {
        get: () => Promise<AppSettings>
        update: (settings: Partial<AppSettings>) => Promise<AppSettings>
        selectFolder: () => Promise<string | null>
      }
    }
  }
}

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
