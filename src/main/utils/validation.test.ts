import { describe, it, expect } from 'vitest'
import {
  validateProjectName,
  validatePort,
  validateMoodleVersion,
  validatePath,
  validateProjectId,
  validateProjectCreate
} from './validation'

describe('validateProjectName', () => {
  it('should accept valid project names', () => {
    expect(validateProjectName('My Project')).toBe('My Project')
    expect(validateProjectName('Test-Project_123')).toBe('Test-Project_123')
    expect(validateProjectName('a')).toBe('a') // 1 character minimum
    expect(validateProjectName('x'.repeat(100))).toBe('x'.repeat(100)) // 100 character maximum
  })

  it('should reject non-string values', () => {
    expect(() => validateProjectName(null)).toThrow(
      'Project name must be a string between 1-100 characters'
    )
    expect(() => validateProjectName(undefined)).toThrow(
      'Project name must be a string between 1-100 characters'
    )
    expect(() => validateProjectName(123)).toThrow(
      'Project name must be a string between 1-100 characters'
    )
    expect(() => validateProjectName({})).toThrow(
      'Project name must be a string between 1-100 characters'
    )
    expect(() => validateProjectName([])).toThrow(
      'Project name must be a string between 1-100 characters'
    )
  })

  it('should reject empty string', () => {
    expect(() => validateProjectName('')).toThrow(
      'Project name must be a string between 1-100 characters'
    )
  })

  it('should reject strings longer than 100 characters', () => {
    expect(() => validateProjectName('x'.repeat(101))).toThrow(
      'Project name must be a string between 1-100 characters'
    )
  })

  it('should reject invalid characters', () => {
    expect(() => validateProjectName('Project/Slash')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project\\Backslash')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project@Symbol')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project.Dot')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project:Colon')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project*Semicolon')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project?Question')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project<Angle>')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project|Pipe')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project"Quote"')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName("Project'Apostrophe'")).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project`Backtick`')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project$Dollar')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project%Percent')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project#Hash')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project&Amp')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project+Plus')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project=Equals')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project(Paren)')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project[Bracket]')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project{Brace}')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    // SQL injection patterns
    expect(() => validateProjectName("Project'; DROP TABLE--")).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName("Project' OR '1'='1")).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    // XSS patterns
    expect(() => validateProjectName('<script>alert(1)</script>')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('<img src=x onerror=alert(1)>')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    // Command injection patterns
    expect(() => validateProjectName('Project; rm -rf /')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project && cat /etc/passwd')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project`whoami`')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project$(id)')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    // Path traversal
    expect(() => validateProjectName('../etc/passwd')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('..\\windows\\system32')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
  })

  it('should reject unicode characters (current implementation limits to ASCII)', () => {
    // Current implementation uses ASCII-only regex for security
    expect(() => validateProjectName('ProjectÑoño')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Project日本語')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    expect(() => validateProjectName('Projectالعربية')).toThrow(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
  })
})

describe('validatePort', () => {
  it('should accept valid ports', () => {
    expect(validatePort(1024)).toBe(1024) // minimum valid port
    expect(validatePort(8080)).toBe(8080) // common development port
    expect(validatePort(65535)).toBe(65535) // maximum valid port
    expect(validatePort('8080')).toBe(8080) // string number should be converted
    expect(validatePort(3000)).toBe(3000) // common Node.js port
  })

  it('should reject ports below 1024 (reserved ports)', () => {
    expect(() => validatePort(0)).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort(1)).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort(80)).toThrow('Port must be an integer between 1024 and 65535') // HTTP
    expect(() => validatePort(443)).toThrow('Port must be an integer between 1024 and 65535') // HTTPS
    expect(() => validatePort(1023)).toThrow('Port must be an integer between 1024 and 65535')
  })

  it('should reject ports above 65535', () => {
    expect(() => validatePort(65536)).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort(70000)).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort(99999)).toThrow('Port must be an integer between 1024 and 65535')
  })

  it('should reject non-integer values', () => {
    expect(() => validatePort(8080.5)).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort(1024.1)).toThrow('Port must be an integer between 1024 and 65535')
  })

  it('should reject non-numeric values', () => {
    expect(() => validatePort(null)).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort(undefined)).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort('')).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort('abc')).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort('8080abc')).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort({})).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort([])).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort(NaN)).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort(Infinity)).toThrow('Port must be an integer between 1024 and 65535')
  })

  it('should reject negative numbers', () => {
    expect(() => validatePort(-1)).toThrow('Port must be an integer between 1024 and 65535')
    expect(() => validatePort(-8080)).toThrow('Port must be an integer between 1024 and 65535')
  })
})

describe('validateMoodleVersion', () => {
  it('should accept valid Moodle version formats', () => {
    expect(validateMoodleVersion('4.4')).toBe('4.4')
    expect(validateMoodleVersion('5.1')).toBe('5.1')
    expect(validateMoodleVersion('4.0')).toBe('4.0')
    expect(validateMoodleVersion('404.1')).toBe('404.1') // unusual but valid format
    expect(validateMoodleVersion('1.0')).toBe('1.0')
    expect(validateMoodleVersion('4.4.1')).toBe('4.4.1') // accepts patch versions too
    expect(validateMoodleVersion('5.1.0')).toBe('5.1.0')
  })

  it('should reject non-string values', () => {
    expect(() => validateMoodleVersion(null)).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion(undefined)).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion(44)).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion({})).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion([])).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
  })

  it('should reject empty string', () => {
    expect(() => validateMoodleVersion('')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
  })

  it('should reject invalid version formats', () => {
    expect(() => validateMoodleVersion('4')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion('v4.4')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion('4.4.')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion('.4')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion('4..4')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion('a.b')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion('four.four')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion('4-4')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion('4_4')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
  })

  it('should reject malicious input', () => {
    expect(() => validateMoodleVersion('4.4; DROP TABLE--')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion('4.4 OR 1=1')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion('4.4 && rm -rf /')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion('<script>alert(1)</script>')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
    expect(() => validateMoodleVersion('../../etc/passwd')).toThrow(
      'Moodle version must be in format "x.y" (e.g., "4.4", "5.1")'
    )
  })
})

describe('validatePath', () => {
  it('should accept valid paths', () => {
    expect(validatePath('/Users/test/Documents')).toBe('/Users/test/Documents')
    expect(validatePath('C:\\Users\\test\\Documents')).toBe('C:\\Users\\test\\Documents')
    expect(validatePath('/home/user/moodle')).toBe('/home/user/moodle')
    expect(validatePath('a')).toBe('a') // 1 character
    expect(validatePath('x'.repeat(500))).toBe('x'.repeat(500)) // 500 characters (max)
  })

  it('should reject paths longer than 500 characters', () => {
    expect(() => validatePath('x'.repeat(501))).toThrow(
      'Path must be a string with max 500 characters'
    )
    expect(() => validatePath('x'.repeat(1000))).toThrow(
      'Path must be a string with max 500 characters'
    )
  })

  it('should reject non-string values', () => {
    expect(() => validatePath(null)).toThrow('Path must be a string with max 500 characters')
    expect(() => validatePath(undefined)).toThrow('Path must be a string with max 500 characters')
    expect(() => validatePath(123)).toThrow('Path must be a string with max 500 characters')
    expect(() => validatePath({})).toThrow('Path must be a string with max 500 characters')
    expect(() => validatePath([])).toThrow('Path must be a string with max 500 characters')
  })

  it('should accept empty string (shortest valid path)', () => {
    expect(validatePath('')).toBe('')
  })
})

describe('validateProjectId', () => {
  it('should accept valid project IDs', () => {
    expect(validateProjectId('abc123')).toBe('abc123')
    expect(validateProjectId('project-id-123')).toBe('project-id-123')
    expect(validateProjectId('x'.repeat(100))).toBe('x'.repeat(100))
    expect(validateProjectId('a')).toBe('a') // 1 character minimum
  })

  it('should reject empty string', () => {
    expect(() => validateProjectId('')).toThrow('Project ID must be a non-empty string')
  })

  it('should reject non-string values', () => {
    expect(() => validateProjectId(null)).toThrow('Project ID must be a non-empty string')
    expect(() => validateProjectId(undefined)).toThrow('Project ID must be a non-empty string')
    expect(() => validateProjectId(123)).toThrow('Project ID must be a non-empty string')
    expect(() => validateProjectId(0)).toThrow('Project ID must be a non-empty string')
    expect(() => validateProjectId({})).toThrow('Project ID must be a non-empty string')
    expect(() => validateProjectId([])).toThrow('Project ID must be a non-empty string')
    expect(() => validateProjectId(false)).toThrow('Project ID must be a non-empty string')
    expect(() => validateProjectId(true)).toThrow('Project ID must be a non-empty string')
  })
})

describe('validateProjectCreate', () => {
  it('should accept valid project data', () => {
    const validProject = {
      name: 'Test Project',
      port: 8080,
      moodleVersion: '4.4',
      path: '/Users/test/moodle'
    }
    expect(validateProjectCreate(validProject)).toEqual({
      name: 'Test Project',
      port: 8080,
      moodleVersion: '4.4',
      path: '/Users/test/moodle',
      status: 'stopped'
    })
  })

  it('should accept valid project data with status', () => {
    const validProject = {
      name: 'Test Project',
      port: 8080,
      moodleVersion: '5.1',
      path: '/Users/test/moodle',
      status: 'ready' as const
    }
    expect(validateProjectCreate(validProject)).toEqual({
      name: 'Test Project',
      port: 8080,
      moodleVersion: '5.1',
      path: '/Users/test/moodle',
      status: 'ready'
    })
  })

  it('should default status to stopped when not provided', () => {
    const projectWithoutStatus = {
      name: 'Test Project',
      port: 8080,
      moodleVersion: '4.4',
      path: '/Users/test/moodle'
    }
    expect(validateProjectCreate(projectWithoutStatus).status).toBe('stopped')
  })

  it('should reject null or undefined', () => {
    expect(() => validateProjectCreate(null)).toThrow('Invalid project data')
    expect(() => validateProjectCreate(undefined)).toThrow('Invalid project data')
  })

  it('should reject non-object values', () => {
    expect(() => validateProjectCreate('string')).toThrow('Invalid project data')
    expect(() => validateProjectCreate(123)).toThrow('Invalid project data')
    expect(() => validateProjectCreate([])).toThrow('Invalid project data')
    expect(() => validateProjectCreate(true)).toThrow('Invalid project data')
  })

  it('should reject project with invalid name', () => {
    expect(() =>
      validateProjectCreate({
        name: '',
        port: 8080,
        moodleVersion: '4.4',
        path: '/Users/test/moodle'
      })
    ).toThrow('Project name must be a string between 1-100 characters')
  })

  it('should reject project with invalid port', () => {
    expect(() =>
      validateProjectCreate({
        name: 'Test Project',
        port: 80,
        moodleVersion: '4.4',
        path: '/Users/test/moodle'
      })
    ).toThrow('Port must be an integer between 1024 and 65535')
  })

  it('should reject project with invalid moodle version', () => {
    expect(() =>
      validateProjectCreate({
        name: 'Test Project',
        port: 8080,
        moodleVersion: 'invalid',
        path: '/Users/test/moodle'
      })
    ).toThrow('Moodle version must be in format "x.y" (e.g., "4.4", "5.1")')
  })

  it('should reject project with invalid path', () => {
    expect(() =>
      validateProjectCreate({
        name: 'Test Project',
        port: 8080,
        moodleVersion: '4.4',
        path: 'x'.repeat(501)
      })
    ).toThrow('Path must be a string with max 500 characters')
  })

  it('should reject project with missing required fields', () => {
    expect(() =>
      validateProjectCreate({
        name: 'Test Project',
        port: 8080,
        moodleVersion: '4.4'
        // path is missing
      })
    ).toThrow()
  })

  it('should handle partial project objects with missing fields', () => {
    expect(() =>
      validateProjectCreate({
        name: 'Test'
        // port, moodleVersion, path missing
      })
    ).toThrow()
  })

  it('should reject malicious input in nested fields', () => {
    expect(() =>
      validateProjectCreate({
        name: "'; DROP TABLE projects--",
        port: 8080,
        moodleVersion: '4.4',
        path: '/Users/test/moodle'
      })
    ).toThrow('Project name can only contain letters, numbers, spaces, hyphens, and underscores')
  })
})
