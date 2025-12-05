import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { renameSync, existsSync, mkdirSync } from 'fs'
import icon from '../../build/icon.png?asset'
import { ProjectService } from './services/project-service'
import { SettingsService } from './services/settings-service'
import { Project } from './types'
import log from 'electron-log'
import { verifyAssets } from './utils/asset-path'

// Configure electron-log for production file logging
log.transports.file.level = 'info' // Log info, warn, and error in production
log.transports.console.level = app.isPackaged ? 'warn' : 'debug' // Only show warnings/errors in console for production

// Configure log file settings
log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB max file size
log.transports.file.archiveLogFn = (oldLogFile): string => {
  // Archive old logs with timestamp
  const logPath = typeof oldLogFile === 'string' ? oldLogFile : oldLogFile.path
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const archivePath = join(dirname(logPath), `main-${timestamp}.log`)
  try {
    renameSync(logPath, archivePath)
  } catch {
    // Ignore errors during archiving
  }
  return archivePath
}

/**
 * Configure log file location to use workspace folder
 * This will be called after app is ready and settings are loaded
 */
function configureLogLocation(): void {
  try {
    const settings = settingsService.getSettings()
    const workspaceFolder = settings.workspaceFolder || join(app.getPath('documents'), 'MoodleBox')
    const logsFolder = join(workspaceFolder, '.moodlebox', 'logs')
    const logFile = join(logsFolder, 'main.log')

    // Ensure logs directory exists
    if (!existsSync(logsFolder)) {
      mkdirSync(logsFolder, { recursive: true })
    }

    // Update log file location
    log.transports.file.resolvePathFn = () => logFile

    log.info(`Log file configured: ${logFile}`)
  } catch (error) {
    // If settings not available yet or error, use default location
    log.warn('Could not configure log location from workspace folder, using default:', error)
  }
}

// Log app startup (before workspace folder is configured)
log.info('='.repeat(60))
log.info(`MoodleBox starting - Version ${app.getVersion()}`)
log.info(`Platform: ${process.platform}, Packaged: ${app.isPackaged}`)

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

// Store reference to main window for proper restoration
let mainWindow: BrowserWindow | null = null

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

import { WINDOW } from './constants'

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: WINDOW.DEFAULT_WIDTH,
    height: WINDOW.DEFAULT_HEIGHT,
    minWidth: WINDOW.MIN_WIDTH,
    minHeight: WINDOW.MIN_HEIGHT,
    show: false,
    resizable: true,
    title: 'MoodleBox',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  window.on('ready-to-show', () => {
    window.show()
  })

  // Handle window close - set to null when destroyed
  window.on('closed', () => {
    mainWindow = null
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

// IPC Handlers
function setupIPCHandlers(): void {
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

  // Duplicate project
  ipcMain.handle('projects:duplicate', async (_, id: string, newName: string, newPort: number) => {
    return await projectService.duplicateProject(id, newName, newPort)
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

  // Sync project states (can be called manually from renderer)
  ipcMain.handle('projects:syncStates', async () => {
    await projectService.syncProjectStates()
  })

  // Get project logs
  ipcMain.handle('projects:getLogs', async (_, id: string) => {
    return await projectService.getProjectLogs(id)
  })

  // Get log file path (for debugging/support)
  ipcMain.handle('app:getLogPath', () => {
    return log.transports.file.getFile().path
  })

  // Open log file location in file manager
  ipcMain.handle('app:openLogFolder', () => {
    const logPath = log.transports.file.getFile().path
    const logDir = dirname(logPath)
    shell.openPath(logDir)
  })

  // Settings handlers
  ipcMain.handle('settings:get', () => {
    return settingsService.getSettings()
  })

  ipcMain.handle('settings:update', (_, updates) => {
    const newSettings = settingsService.updateSettings(updates)
    // If workspace folder changed, reconfigure log location
    if (updates.workspaceFolder) {
      configureLogLocation()
      log.info(`Log location updated to workspace folder: ${updates.workspaceFolder}`)
    }
    return newSettings
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

    // Configure log location to use workspace folder (must be done early)
    configureLogLocation()
    log.info(`Log file location: ${log.transports.file.getFile().path}`)
    log.info('='.repeat(60))

    // App window optimizations for macOS - handle Cmd+Q
    app.on('browser-window-created', (_, window): void => {
      if (process.platform === 'darwin') {
        const handleBeforeInput = (_event: Electron.Event, input: Electron.Input): void => {
          if (input.meta && input.key.toLowerCase() === 'q') {
            app.quit()
          }
        }
        window.webContents.on('before-input-event', handleBeforeInput)
        // Note: No cleanup needed - Electron automatically removes listeners when window is destroyed
        // Attempting to manually remove can cause errors if window is already destroyed
      }
    })

    // Load versions data
    log.info('Loading versions data...')
    await projectService.loadVersionsData()
    log.info('Versions data loaded successfully')

    // Sync project states with Docker reality
    // This ensures the database reflects reality on app startup
    // Use force=true to bypass debounce on startup
    log.info('Syncing project states...')
    await projectService.syncProjectStates(true)
    log.info('Project states synced')

    setupIPCHandlers()

    log.info('Creating window...')
    mainWindow = createWindow()
    log.info('Window created successfully')

    // Handle app activation (e.g., clicking dock icon on macOS)
    app.on('activate', function () {
      // On macOS, re-create window if none exist
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
      } else if (mainWindow) {
        // If window exists but is minimized or hidden, restore it
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        if (!mainWindow.isVisible()) {
          mainWindow.show()
        }
        // Bring window to front
        mainWindow.focus()
      }
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
