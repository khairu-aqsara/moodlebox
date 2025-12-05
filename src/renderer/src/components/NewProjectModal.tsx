import { useState, useEffect } from 'react'
import { z } from 'zod'
import { versionManager } from '../lib/version-manager'
import { useProjectStore } from '../store/project-store'
import { useSettingsStore } from '../store/settings-store'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

// Helper function to join paths cross-platform (renderer-safe)
// Preserves absolute paths (leading / on Unix, drive letter on Windows)
function joinPath(...parts: string[]): string {
  if (parts.length === 0) return ''

  const filtered = parts.filter(Boolean)
  if (filtered.length === 0) return ''

  // Check if first part is an absolute path
  const firstPart = filtered[0]
  const isAbsolute =
    firstPart.startsWith('/') || /^[a-zA-Z]:/.test(firstPart) || firstPart.startsWith('\\\\')

  // If absolute, preserve the leading character(s)
  if (isAbsolute) {
    const rest = filtered.slice(1).map((part) => part.replace(/^\/+|\/+$/g, ''))
    const joined = [firstPart.replace(/\/+$/, ''), ...rest].join('/').replace(/\/+/g, '/')
    return joined
  }

  // Relative path - join normally
  return filtered
    .map((part, i) => {
      if (i === 0) {
        return part.replace(/\/+$/, '')
      }
      return part.replace(/^\/+|\/+$/g, '')
    })
    .join('/')
    .replace(/\/+/g, '/')
}

interface NewProjectModalProps {
  onClose: () => void
}

// Validation schema for project creation
const projectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be 100 characters or less')
    .regex(
      /^[a-zA-Z0-9\s\-_]+$/,
      'Project name can only contain letters, numbers, spaces, hyphens, and underscores'
    )
    .refine(
      (val) => !val.startsWith(' ') && !val.endsWith(' '),
      'Project name cannot start or end with spaces'
    ),
  port: z
    .number()
    .int('Port must be an integer')
    .min(1024, 'Port must be 1024 or higher (ports below 1024 require root privileges)')
    .max(65535, 'Port must be 65535 or lower'),
  moodleVersion: z.string().min(1, 'Moodle version is required')
})

export function NewProjectModal({ onClose }: NewProjectModalProps): JSX.Element {
  const [projectName, setProjectName] = useState('')
  const [selectedVersion, setSelectedVersion] = useState('')
  const [port, setPort] = useState('8080')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const addProject = useProjectStore((state) => state.addProject)
  const loadSettings = useSettingsStore((state) => state.loadSettings)

  // Ensure settings are loaded when modal opens
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const versions = versionManager.getAllVersions()
  const selectedVersionData = selectedVersion
    ? versionManager.getVersionByNumber(selectedVersion)
    : null

  const handleCreate = async (): Promise<void> => {
    // Ensure settings are loaded before creating project
    await loadSettings()
    const currentWorkspaceFolder = useSettingsStore.getState().workspaceFolder

    if (!currentWorkspaceFolder || currentWorkspaceFolder.trim() === '') {
      setErrors({ general: 'Workspace folder is not configured. Please set it in settings.' })
      return
    }

    // Validate input
    const validationResult = projectSchema.safeParse({
      name: projectName.trim(),
      port: parseInt(port, 10),
      moodleVersion: selectedVersion
    })

    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {}
      validationResult.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    // Check if port is a valid number
    const portNum = parseInt(port, 10)
    if (isNaN(portNum)) {
      setErrors({ port: 'Port must be a valid number' })
      return
    }

    setErrors({})

    const projectSlug = projectName.toLowerCase().replace(/\s+/g, '-')

    try {
      // Use proper path joining instead of string concatenation
      const projectPath = joinPath(currentWorkspaceFolder, projectSlug)

      await addProject({
        name: projectName.trim(),
        moodleVersion: selectedVersion,
        port: portNum,
        status: 'stopped',
        path: projectPath
      })
      onClose()
    } catch (error: unknown) {
      // Handle errors from IPC (e.g., port conflicts, duplicate names, etc.)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create project'

      // Try to extract field-specific errors (e.g., port conflicts)
      if (errorMessage.includes('Port') && errorMessage.includes('already in use')) {
        setErrors({ port: errorMessage })
      } else if (errorMessage.includes('already exists')) {
        setErrors({ name: errorMessage })
      } else {
        setErrors({ general: errorMessage })
      }
    }
  }

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Set up a new Moodle development environment
            <span className="text-xs text-muted-foreground block mt-1">Press Escape to cancel</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {errors.general && (
            <div className="rounded-lg bg-destructive/15 border border-destructive/50 p-3 text-sm text-destructive">
              {errors.general}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="name">Project Name</Label>
            <Input
              id="name"
              placeholder="My Moodle Site"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value)
                if (errors.name) setErrors({ ...errors, name: '' })
              }}
              className={errors.name ? 'border-destructive' : ''}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : 'name-help'}
            />
            {errors.name && (
              <p id="name-error" className="text-xs text-destructive" role="alert">
                {errors.name}
              </p>
            )}
            <p id="name-help" className="text-xs text-muted-foreground">
              Only letters, numbers, spaces, hyphens, and underscores are allowed
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="version">Moodle Version</Label>
            <Select
              value={selectedVersion}
              onValueChange={(value) => {
                setSelectedVersion(value)
                if (errors.moodleVersion) setErrors({ ...errors, moodleVersion: '' })
              }}
            >
              <SelectTrigger
                id="version"
                className={errors.moodleVersion ? 'border-destructive' : ''}
                aria-invalid={!!errors.moodleVersion}
                aria-describedby={errors.moodleVersion ? 'version-error' : undefined}
              >
                <SelectValue placeholder="Select a version" />
              </SelectTrigger>
              <SelectContent role="listbox">
                {versions.map((version) => (
                  <SelectItem key={version.version} value={version.version} role="option">
                    Moodle {version.version} ({version.type.toUpperCase()}) - PHP{' '}
                    {version.requirements.php}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.moodleVersion && (
              <p id="version-error" className="text-xs text-destructive" role="alert">
                {errors.moodleVersion}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              value={port}
              onChange={(e) => {
                setPort(e.target.value)
                if (errors.port) setErrors({ ...errors, port: '' })
              }}
              className={errors.port ? 'border-destructive' : ''}
              min={1024}
              max={65535}
              aria-invalid={!!errors.port}
              aria-describedby={errors.port ? 'port-error' : 'port-help'}
            />
            {errors.port && (
              <p id="port-error" className="text-xs text-destructive" role="alert">
                {errors.port}
              </p>
            )}
            <p id="port-help" className="text-xs text-muted-foreground">
              Your Moodle site will be available at http://localhost:{port || '8080'}
            </p>
          </div>

          {selectedVersionData && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium mb-1">Auto-configured:</p>
              <ul className="text-muted-foreground space-y-1">
                <li>• PHP {selectedVersionData.requirements.php}</li>
                <li>• Mysql {selectedVersionData.requirements.mysql}</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!projectName || !selectedVersion}>
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
