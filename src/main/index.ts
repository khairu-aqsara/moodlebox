import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { ProjectService } from './services/project-service'
import { SettingsService } from './services/settings-service'
import { Project } from './types'

// Initialize services
const projectService = new ProjectService()
const settingsService = new SettingsService()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    resizable: false,
    title: 'MoodleBox',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC Handlers
function setupIPCHandlers() {
  // Get all projects
  ipcMain.handle('projects:getAll', () => {
    return projectService.getAllProjects()
  })

  // Create project
  ipcMain.handle('projects:create', async (_, project: Omit<Project, 'id' | 'createdAt'>) => {
    return await projectService.createProject(project)
  })

  // Start project
  ipcMain.handle('projects:start', async (event, id: string) => {
    await projectService.startProject(id, (log) => {
      event.sender.send('project:log', { id, log })
    })
  })

  // Stop project
  ipcMain.handle('projects:stop', async (_, id: string) => {
    await projectService.stopProject(id)
  })

  // Delete project
  ipcMain.handle('projects:delete', async (_, id: string) => {
    await projectService.deleteProject(id)
  })

  // Open project folder
  ipcMain.handle('projects:openFolder', (_, path: string) => {
    shell.openPath(path)
  })

  // Open in browser
  ipcMain.handle('projects:openBrowser', (_, port: number) => {
    shell.openExternal(`http://localhost:${port}`)
  })

  // Get default projects path
  ipcMain.handle('projects:getDefaultPath', () => {
    return join(app.getPath('documents'), 'MoodleBox')
  })

  // Check Docker status
  ipcMain.handle('projects:checkDocker', async () => {
    return await projectService.checkDocker()
  })

  // Settings handlers
  ipcMain.handle('settings:get', () => {
    return settingsService.getSettings()
  })

  ipcMain.handle('settings:update', (_, updates) => {
    return settingsService.updateSettings(updates)
  })

  ipcMain.handle('settings:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Select Workspace Folder',
      buttonLabel: 'Select Folder'
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })
}

app.whenReady().then(async () => {
  // Set app name for macOS menu bar
  app.name = 'MoodleBox'
  
  electronApp.setAppUserModelId('com.moodlebox.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
    if (process.platform === 'darwin') {
      window.webContents.on('before-input-event', (event, input) => {
        if (input.meta && input.key.toLowerCase() === 'q') {
          app.quit()
        }
      })
    }
  })

  // Load versions data
  await projectService.loadVersionsData()

  // Sync project states with actual Docker container states
  // This ensures the database reflects reality on app startup
  await projectService.syncProjectStates()

  setupIPCHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
