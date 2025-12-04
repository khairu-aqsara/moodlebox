import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import icon from '../../build/icon.png?asset'
import { ProjectService } from './services/project-service'
import { SettingsService } from './services/settings-service'
import { Project } from './types'
import log from 'electron-log'
import { verifyAssets } from './utils/asset-path'

// Fix PATH for macOS packaged apps
// macOS packaged apps don't inherit shell PATH, so we add common paths
if (process.platform === 'darwin' && app.isPackaged) {
  process.env.PATH = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    process.env.PATH
  ].join(':')
}

// Initialize services
const projectService = new ProjectService()
const settingsService = new SettingsService()

// Verify assets are accessible on startup
verifyAssets()
  .then((success) => {
    if (!success) {
      log.error('Asset verification failed. App may not function correctly.')
    }
  })
  .catch((error) => {
    log.error('Error during asset verification:', error)
  })

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

// App lifecycle
app.whenReady().then(async () => {
  log.info('MoodleBox starting...')

  try {
    // Set app name for macOS menu bar
    app.name = 'MoodleBox'

    // Set app user model id for windows
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.moodlebox')
    }

    // App window optimizations for macOS - handle Cmd+Q
    app.on('browser-window-created', (_, window) => {
      if (process.platform === 'darwin') {
        window.webContents.on('before-input-event', (_event, input) => {
          if (input.meta && input.key.toLowerCase() === 'q') {
            app.quit()
          }
        })
      }
    })

    // Load versions data
    log.info('Loading versions data...')
    await projectService.loadVersionsData()
    log.info('Versions data loaded successfully')

    // Sync project states with Docker reality
    // This ensures the database reflects reality on app startup
    log.info('Syncing project states...')
    await projectService.syncProjectStates()
    log.info('Project states synced')

    setupIPCHandlers()

    log.info('Creating window...')
    createWindow()
    log.info('Window created successfully')

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  } catch (error) {
    log.error('Critical error during app initialization:', error)
    // Show error dialog to user
    dialog.showErrorBox(
      'MoodleBox Initialization Error',
      `Failed to start MoodleBox:\n\n${error instanceof Error ? error.message : String(error)}\n\nCheck logs at: ${log.transports.file.getFile().path}`
    )
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
