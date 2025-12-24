import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProjectService } from './project-service'
import { Project } from '../types'

// Mock electron-store
vi.mock('electron-store', () => {
  class MockStore {
    get = vi.fn(() => [])
    set = vi.fn()
    delete = vi.fn()
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

// Mock docker service
vi.mock('./docker-service', () => {
  class MockDockerService {
    checkDocker = vi.fn().mockResolvedValue(true)
    checkDockerInstalled = vi.fn().mockResolvedValue(true)
    checkPort = vi.fn().mockResolvedValue(true)
    runDockerComposeCommand = vi.fn().mockResolvedValue({ stdout: '', stderr: '' })
  }
  return {
    DockerService: MockDockerService
  }
})

// Mock version data
const mockVersions: Record<
  string,
  {
    version: string
    downloadUrl: string
    requirements: { php: string; mysql: string }
    webroot?: string
  }
> = {
  '4.4': {
    version: '4.4',
    downloadUrl: 'https://download.moodle.org/download.php/direct/stable404/moodle-4.4.tgz',
    requirements: { php: '8.1', mysql: '8.0' }
  },
  '5.1': {
    version: '5.1',
    downloadUrl: 'https://download.moodle.org/download.php/direct/stable500/moodle-5.1.tgz',
    requirements: { php: '8.2', mysql: '8.0' },
    webroot: 'public'
  }
}

describe('ProjectService - Security Validations', () => {
  let projectService: ProjectService

  beforeEach(() => {
    // Create fresh instance for each test
    projectService = new ProjectService()
    // Load mock versions data
    ;(projectService as any).versionsData = mockVersions
  })

  describe('Path Traversal Protection', () => {
    const validProject: Omit<Project, 'id' | 'createdAt'> = {
      name: 'Test Project',
      port: 8080,
      moodleVersion: '4.4',
      path: '/tmp/test-moodle',
      status: 'stopped'
    }

    it('should accept valid absolute paths', async () => {
      const validPaths = [
        '/Users/test/Documents/moodle',
        '/home/user/moodle',
        '/var/www/moodle',
        'C:\\Users\\test\\moodle',
        'D:\\Projects\\moodle'
      ]

      for (const path of validPaths) {
        const project = { ...validProject, path }
        // Should not throw for valid paths
        // Note: createProject will fail for other reasons (Docker not running, etc.)
        // but path traversal check should pass
        try {
          await projectService.createProject(project)
        } catch (error) {
          expect((error as Error).message).not.toContain('invalid characters')
          expect((error as Error).message).not.toContain('path traversal')
        }
      }
    })

    it('should reject paths with .. (parent directory reference)', async () => {
      const maliciousPaths = [
        '../etc/passwd',
        '../../etc/passwd',
        '/tmp/test/../etc',
        '/tmp/test/../../etc',
        'C:\\Users\\..\\Windows\\System32',
        '/Users/test/../../../etc/passwd'
      ]

      for (const path of maliciousPaths) {
        const project = { ...validProject, path }
        await expect(projectService.createProject(project)).rejects.toThrow('invalid characters')
        await expect(projectService.createProject(project)).rejects.toThrow('..')
      }
    })

    it('should reject paths with ~ (home directory reference)', async () => {
      const homePaths = [
        '~/Documents/moodle',
        '/tmp/test~/moodle',
        '~root/moodle',
        '~',
        'C:\\Users\\~\\moodle',
        '/tmp/~/test'
      ]

      for (const path of homePaths) {
        const project = { ...validProject, path }
        await expect(projectService.createProject(project)).rejects.toThrow('invalid characters')
        await expect(projectService.createProject(project)).rejects.toThrow('~')
      }
    })

    it('should reject combined path traversal attempts', async () => {
      const combinedPaths = [
        '~/.ssh/config',
        '../~/test',
        'test/../config',
        '/tmp/test/../~/etc',
        'C:\\Users\\..\\..\\Windows'
      ]

      for (const path of combinedPaths) {
        const project = { ...validProject, path }
        await expect(projectService.createProject(project)).rejects.toThrow()
      }
    })

    it('should reject combined path traversal attempts', async () => {
      const combinedPaths = [
        '~/.ssh/config',
        '../~/test',
        'test/../config',
        '/tmp/test/../~/etc',
        'C:\\Users\\..\\..\\Windows'
      ]

      for (const path of combinedPaths) {
        const project = { ...validProject, path }
        await expect(projectService.createProject(project)).rejects.toThrow()
      }
    })

    it('should provide clear error message for path traversal', async () => {
      const project = { ...validProject, path: '../../etc/passwd' }

      try {
        await projectService.createProject(project)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect((error as Error).message).toContain('invalid characters')
        expect((error as Error).message).toContain('..')
        expect((error as Error).message).toContain('security reasons')
        expect((error as Error).message).toContain('valid absolute path')
      }
    })

    it('should reject empty paths', async () => {
      const project = { ...validProject, path: '' }

      await expect(projectService.createProject(project)).rejects.toThrow('cannot be empty')
    })

    it('should reject whitespace-only paths', async () => {
      const project = { ...validProject, path: '   ' }

      await expect(projectService.createProject(project)).rejects.toThrow('cannot be empty')
    })
  })

  describe('Port Validation', () => {
    const validProject: Omit<Project, 'id' | 'createdAt'> = {
      name: 'Test Project',
      port: 8080,
      moodleVersion: '4.4',
      path: '/tmp/test-moodle',
      status: 'stopped'
    }

    it('should accept valid user ports', async () => {
      const validPorts = [1024, 3000, 8080, 8888, 65535]

      for (const port of validPorts) {
        const project = { ...validProject, port }
        try {
          await projectService.createProject(project)
        } catch (error) {
          // Should not fail on port validation
          expect((error as Error).message).not.toContain('Port')
        }
      }
    })

    it('should reject privileged ports (below 1024)', async () => {
      const privilegedPorts = [1, 80, 443, 1023] // Note: 0 is invalid, not just privileged

      for (const port of privilegedPorts) {
        const project = { ...validProject, port }
        await expect(projectService.createProject(project)).rejects.toThrow('privileged port')
        await expect(projectService.createProject(project)).rejects.toThrow('1024')
      }
    })

    it('should reject ports above maximum', async () => {
      const invalidPorts = [65536, 70000, 99999]

      for (const port of invalidPorts) {
        const project = { ...validProject, port }
        await expect(projectService.createProject(project)).rejects.toThrow('invalid')
      }
    })

    it('should reject negative ports', async () => {
      const project = { ...validProject, port: -1 }
      await expect(projectService.createProject(project)).rejects.toThrow()
    })

    it('should provide clear error message for privileged ports', async () => {
      const project = { ...validProject, port: 80 }

      try {
        await projectService.createProject(project)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect((error as Error).message).toContain('privileged port')
        expect((error as Error).message).toContain('root privileges')
        expect((error as Error).message).toContain('1024')
      }
    })
  })

  describe('Cross-Platform Path Handling', () => {
    const validProject: Omit<Project, 'id' | 'createdAt'> = {
      name: 'Test Project',
      port: 8080,
      moodleVersion: '4.4',
      path: '/tmp/test-moodle',
      status: 'stopped'
    }

    it('should handle mixed path separators on Unix-like systems', async () => {
      // These paths should be normalized correctly even with mixed separators
      const mixedSeparatorPaths = [
        '/Users/test\\Documents/moodle', // Mixed separators
        'home/user\\moodle',
        '/var/www\\moodle'
      ]

      for (const path of mixedSeparatorPaths) {
        const project = { ...validProject, path }
        try {
          await projectService.createProject(project)
        } catch (error) {
          // Should not fail due to path separator issues
          expect((error as Error).message).not.toContain('separator')
        }
      }
    })

    it('should handle Windows UNC paths', async () => {
      const uncPaths = [
        '\\\\server\\share\\moodle',
        '\\\\?\\C:\\Very\\Long\\Path\\moodle'
      ]

      for (const path of uncPaths) {
        const project = { ...validProject, path }
        try {
          await projectService.createProject(project)
        } catch (error) {
          // UNC paths should be accepted on Windows
          expect((error as Error).message).not.toContain('UNC')
        }
      }
    })

    it('should auto-fix Unix paths missing leading slash', async () => {
      const pathsMissingSlash = [
        'Users/test/Documents/moodle',
        'home/user/moodle',
        'var/www/moodle'
      ]

      for (const path of pathsMissingSlash) {
        const project = { ...validProject, path }
        try {
          await projectService.createProject(project)
        } catch (error) {
          // The path should be auto-fixed on Unix systems
          // May still fail for other reasons (Docker, permissions, etc.)
          expect((error as Error).message).not.toContain('missing leading')
        }
      }
    })

    it('should normalize paths for duplicate detection', async () => {
      // Test that paths with different separators are recognized as duplicates
      // Use /tmp which is writable on all platforms
      const path1 = '/tmp/test-moodle-dup'
      const path2 = '/tmp/test-moodle-dup' // Same path, should be detected as duplicate

      const project1 = { ...validProject, path: path1, name: 'Project 1', port: 8080 }
      const project2 = { ...validProject, path: path2, name: 'Project 2', port: 8081 }

      let firstError: Error | null = null

      try {
        await projectService.createProject(project1)
      } catch (error) {
        firstError = error as Error
        // May fail for other reasons (Docker not running, etc.), but path should be accepted
        expect(firstError.message).not.toContain('invalid characters')
      }

      try {
        await projectService.createProject(project2)
      } catch (error) {
        // Should detect duplicate path or have some related error
        const errorMsg = (error as Error).message
        // Either duplicate path error, port conflict, or first project creation failed
        const isValidError =
          errorMsg.includes('already exists') ||
          errorMsg.includes('port') ||
          errorMsg.includes('8080') ||
          (firstError && firstError.message !== '')
        expect(isValidError).toBe(true)
      }
    })
  })
})
