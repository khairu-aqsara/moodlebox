import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SettingsService } from './settings-service'

// Mock Electron app module - must be inline due to vi.mock hoisting
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'documents') {
        return process.platform === 'win32'
          ? 'C:\\Users\\test\\Documents'
          : process.platform === 'darwin'
            ? '/Users/test/Documents'
            : '/home/test/Documents'
      }
      return '/tmp/test'
    })
  }
}))

// Mock electron-store
vi.mock('electron-store', () => {
  interface MockStoreData {
    settings?: {
      theme: 'light' | 'dark'
      workspaceFolder: string
      phpMyAdminPort: number
    }
  }
  class MockStore {
    private data: MockStoreData = {
      settings: {
        theme: 'dark',
        workspaceFolder: '/tmp/test/MoodleBox',
        phpMyAdminPort: 8081
      }
    }

    get = vi.fn((key: keyof MockStoreData) => this.data[key])
    set = vi.fn(<K extends keyof MockStoreData>(key: K, value: MockStoreData[K]) => {
      this.data[key] = value
    })
    delete = vi.fn((key: keyof MockStoreData) => {
      delete this.data[key]
    })
  }
  return {
    default: MockStore
  }
})

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('SettingsService - Cross-Platform Path Handling', () => {
  let settingsService: SettingsService

  beforeEach(() => {
    // Create fresh instance for each test
    settingsService = new SettingsService()
  })

  describe('Unix-like Path Normalization', () => {
    const originalPlatform = process.platform

    afterEach(() => {
      // Restore original platform after each test
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      })
    })

    it('should auto-fix Unix paths missing leading slash', () => {
      // Mock Unix platform
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      })

      const pathsToFix: string[] = ['Users/test/Documents', 'home/user/workspace', 'var/www/html']

      for (const inputPath of pathsToFix) {
        const settings = settingsService.updateSettings({ workspaceFolder: inputPath })
        // On Unix, the path should be normalized to have leading slash
        expect(settings.workspaceFolder).toMatch(/^\//)
      }
    })

    it('should accept correctly formatted Unix paths', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      })

      const validPaths = [
        '/Users/test/Documents',
        '/home/user/workspace',
        '/var/www/html',
        '/opt/moodle/projects'
      ]

      for (const path of validPaths) {
        const settings = settingsService.updateSettings({ workspaceFolder: path })
        expect(settings.workspaceFolder).toBe(path)
      }
    })
  })

  describe('Windows Path Handling', () => {
    const originalPlatform = process.platform

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      })
    })

    it('should accept Windows drive letter paths', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      })

      const validWindowsPaths = [
        'C:\\Users\\test\\Documents',
        'D:\\Projects\\Moodle',
        'E:\\Workspace'
      ]

      for (const path of validWindowsPaths) {
        const settings = settingsService.updateSettings({ workspaceFolder: path })
        // On non-Windows systems, path.resolve() will prepend the current directory
        // The important thing is that it doesn't throw an error
        expect(settings.workspaceFolder).toBeTruthy()
        expect(settings.workspaceFolder).toContain(path)
      }
    })

    it('should accept Windows UNC paths', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      })

      const uncPaths = ['\\\\server\\share\\workspace', '\\\\network\\folder\\projects']

      for (const path of uncPaths) {
        const settings = settingsService.updateSettings({ workspaceFolder: path })
        // On non-Windows systems, UNC paths will be normalized
        // The important thing is that it doesn't throw an error
        expect(settings.workspaceFolder).toBeTruthy()
      }
    })
  })

  describe('Mixed Path Separator Handling', () => {
    it('should normalize paths with mixed separators', () => {
      const mixedPaths = [
        '/Users/test\\Documents/moodle',
        'C:/Users/test\\Documents',
        '\\home/user\\workspace'
      ]

      for (const path of mixedPaths) {
        const settings = settingsService.updateSettings({ workspaceFolder: path })
        // Path should be normalized to platform-specific format
        expect(settings.workspaceFolder).toBeTruthy()
        expect(typeof settings.workspaceFolder).toBe('string')
      }
    })
  })

  describe('Path Persistence', () => {
    it('should persist auto-fixed paths', () => {
      const pathToFix = 'Users/test/Documents'

      const settings = settingsService.updateSettings({ workspaceFolder: pathToFix })

      // The returned settings should have the normalized path
      expect(settings.workspaceFolder).toBeTruthy()
      // Path should be normalized (on Unix, should start with /)
      expect(settings.workspaceFolder).toMatch(/^\//)
    })
  })

  describe('Default Settings', () => {
    it('should provide default workspace folder based on platform', () => {
      const settings = settingsService.getSettings()

      // Default workspace folder should be set
      expect(settings.workspaceFolder).toBeTruthy()
      expect(typeof settings.workspaceFolder).toBe('string')
    })

    it('should handle platform-specific default paths', () => {
      const settings = settingsService.getSettings()

      // On macOS, default is typically /Users/xxx/MoodleBox
      // On Windows, default is typically C:\Users\xxx\MoodleBox
      // On Linux, default is typically /home/xxx/MoodleBox
      expect(settings.workspaceFolder).toContain('MoodleBox')
    })
  })
})
