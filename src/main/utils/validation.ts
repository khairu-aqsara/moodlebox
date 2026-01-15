import { Project } from '../types'

/**
 * Input validation utilities for IPC handlers
 * All validators throw errors on invalid input to prevent security issues
 */

/**
 * Validates project name (1-100 chars, alphanumeric + spaces/hyphens/underscores)
 */
export function validateProjectName(val: unknown): string {
  if (typeof val !== 'string' || val.length < 1 || val.length > 100) {
    throw new Error('Project name must be a string between 1-100 characters')
  }
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(val)) {
    throw new Error(
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
  }
  return val
}

/**
 * Validates port number (1024-65535, non-reserved ports)
 */
export function validatePort(val: unknown): number {
  const port = Number(val)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Port must be an integer between 1024 and 65535')
  }
  return port
}

/**
 * Validates Moodle version format (x.y, e.g., "4.4", "5.1")
 */
export function validateMoodleVersion(val: unknown): string {
  if (typeof val !== 'string' || !/^\d+\.\d+(\.\d+)?$/.test(val)) {
    throw new Error('Moodle version must be in format "x.y" (e.g., "4.4", "5.1")')
  }
  return val
}

/**
 * Validates file path (max 500 characters)
 */
export function validatePath(val: unknown): string {
  if (typeof val !== 'string' || val.length > 500) {
    throw new Error('Path must be a string with max 500 characters')
  }
  return val
}

/**
 * Validates project ID (non-empty string)
 */
export function validateProjectId(val: unknown): string {
  if (typeof val !== 'string' || val.length === 0) {
    throw new Error('Project ID must be a non-empty string')
  }
  return val
}

/**
 * Type guard for Project-like objects
 */
function isProjectLike(obj: unknown): obj is Partial<Project> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    ('name' in obj || 'port' in obj || 'moodleVersion' in obj || 'path' in obj)
  )
}

/**
 * Validates complete project creation data
 */
export function validateProjectCreate(project: unknown): Omit<Project, 'id' | 'createdAt'> {
  if (!isProjectLike(project)) {
    throw new Error('Invalid project data: must be an object')
  }

  const p = project as Partial<Project>

  return {
    name: validateProjectName(p.name),
    port: validatePort(p.port),
    moodleVersion: validateMoodleVersion(p.moodleVersion),
    path: validatePath(p.path),
    status: p.status || 'stopped'
  }
}
