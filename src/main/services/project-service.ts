import { Project, VersionsData, ProgressInfo } from '../types'
import { promises as fs } from 'fs'
import { spawn, ChildProcess } from 'child_process'
import { DockerService } from './docker-service'
import { ComposeGenerator } from './compose-generator'
import { BrowserWindow } from 'electron'
import Store from 'electron-store'
import log from 'electron-log'
import { getAssetPath } from '../utils/asset-path'
import { join, sep, resolve } from 'path'
import { PROJECT_SYNC, PORTS } from '../constants'

interface ProjectStoreSchema {
  projects: Project[]
}

// Type-safe wrapper for electron-store to handle type definition issues
type TypedStore = Store<ProjectStoreSchema> & {
  get<K extends keyof ProjectStoreSchema>(key: K): ProjectStoreSchema[K]
  set<K extends keyof ProjectStoreSchema>(key: K, value: ProjectStoreSchema[K]): void
}

export class ProjectService {
  private store: TypedStore
  private composeGenerator: ComposeGenerator
  private dockerService: DockerService
  private versionsData: VersionsData | null = null
  private syncDebounceTimer: NodeJS.Timeout | null = null
  private lastDockerStatus: boolean | null = null
  private lastSyncTime: number = 0
  private readonly SYNC_DEBOUNCE_MS = PROJECT_SYNC.DEBOUNCE_MS
  private readonly SYNC_COOLDOWN_MS = PROJECT_SYNC.COOLDOWN_MS

  /**
   * Statuses that represent active operations that should never be interrupted by sync.
   * Sync will skip projects in these states to avoid interfering with running processes.
   */
  private readonly ACTIVE_OPERATION_STATUSES: Project['status'][] = [
    'provisioning', // Downloading Moodle source
    'installing', // Installing Moodle
    'starting', // Starting containers
    'waiting', // Waiting for health checks
    'stopping', // Stopping containers
    'deleting' // Deleting project
  ]

  constructor() {
    const rawStore = new Store<ProjectStoreSchema>({
      defaults: {
        projects: []
      }
    })
    // Type assertion with runtime validation
    this.store = rawStore as TypedStore
    this.composeGenerator = new ComposeGenerator()
    this.dockerService = new DockerService()
  }

  /**
   * Load Moodle version data from assets/versions.json
   *
   * This method reads the bundled versions.json file which contains:
   * - Supported Moodle versions
   * - PHP and MySQL requirements for each version
   * - Download URLs
   * - Special configuration flags (webroot, composer requirements)
   *
   * @throws {Error} If versions.json cannot be read or parsed
   *
   * @example
   * ```typescript
   * await projectService.loadVersionsData()
   * const versions = projectService.getAllVersions() // Now available
   * ```
   */
  async loadVersionsData(): Promise<void> {
    // Use standardized asset path resolution
    const versionsPath = getAssetPath('versions.json')

    log.info(`Loading versions from: ${versionsPath}`)

    try {
      const data = await fs.readFile(versionsPath, 'utf-8')
      this.versionsData = JSON.parse(data)
      log.info(`Successfully loaded ${this.versionsData?.releases?.length || 0} Moodle versions`)
    } catch (error) {
      log.error(`Failed to load versions.json from ${versionsPath}:`, error)
      throw error
    }
  }

  /**
   * Sync all projects with actual Docker container states (debounced)
   *
   * This method ensures the in-memory project states match the actual Docker container states.
   * It's automatically debounced to avoid excessive Docker queries and only syncs when Docker
   * state actually changes.
   *
   * **When to call:**
   * - On app startup (with force=true)
   * - When window gains focus (debounced automatically)
   * - After Docker state changes
   *
   * **What it does:**
   * - Checks if Docker is available
   * - For each project, checks container status via `docker compose ps`
   * - Updates project status to match reality (ready/stopped/starting/error)
   * - Handles projects that were started/stopped outside the app
   *
   * **Important:** Projects in active operation statuses (provisioning, installing, starting,
   * waiting, stopping, deleting) are skipped during sync to avoid interrupting running processes.
   * This ensures downloads, installations, and container operations complete without interference.
   *
   * @param force - If true, bypass debounce and cooldown checks (use on startup)
   *
   * @example
   * ```typescript
   * // On startup
   * await projectService.syncProjectStates(true)
   *
   * // On window focus (automatically debounced)
   * await projectService.syncProjectStates()
   * ```
   */
  async syncProjectStates(force: boolean = false): Promise<void> {
    const now = Date.now()

    // Check cooldown period (unless forced)
    if (!force && now - this.lastSyncTime < this.SYNC_COOLDOWN_MS) {
      log.debug(`Sync skipped - cooldown period (${this.SYNC_COOLDOWN_MS}ms) not elapsed`)
      return
    }

    // Clear existing debounce timer
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer)
      this.syncDebounceTimer = null
    }

    // If not forced, debounce the sync
    if (!force) {
      return new Promise<void>((resolve) => {
        this.syncDebounceTimer = setTimeout(async () => {
          this.syncDebounceTimer = null
          await this.performSync()
          resolve()
        }, this.SYNC_DEBOUNCE_MS)
      })
    }

    // Force immediate sync
    await this.performSync()
  }

  /**
   * Internal method that performs the actual sync operation
   */
  private async performSync(): Promise<void> {
    const projects = this.getAllProjects()
    this.lastSyncTime = Date.now()

    if (projects.length === 0) {
      log.info('No projects to sync')
      return
    }

    // Check if Docker is available first
    const dockerAvailable = await this.dockerService.checkDockerInstalled()

    // Only sync if Docker status changed or if Docker is now available
    if (this.lastDockerStatus === dockerAvailable && !dockerAvailable) {
      log.debug('Docker status unchanged and not available - skipping sync')
      return
    }

    this.lastDockerStatus = dockerAvailable

    if (!dockerAvailable) {
      log.warn('Docker not available during sync - marking all projects as stopped')
      // If Docker is not running, mark all projects as stopped
      // But skip projects in active operations to avoid interrupting running processes
      for (const project of projects) {
        if (this.ACTIVE_OPERATION_STATUSES.includes(project.status)) {
          log.debug(
            `Skipping sync for project ${project.name} - status is ${project.status} (active operation, Docker check skipped)`
          )
          continue
        }

        if (project.status !== 'stopped' && project.status !== 'error') {
          this.updateProject(project.id, {
            status: 'stopped',
            statusDetail: 'Docker not running',
            errorMessage: undefined,
            progress: undefined
          })
        }
      }
      return
    }

    log.info(`Syncing ${projects.length} project(s) with Docker container states...`)

    // Parallelize Docker status checks for better performance
    const syncPromises = projects.map(async (project) => {
      try {
        // CRITICAL: Skip syncing projects that are in active operations FIRST
        // This must be checked BEFORE any file system operations to prevent interference
        // These operations should not be interrupted by sync, as they represent running processes
        // (downloads, installations, container operations, etc.)
        if (this.ACTIVE_OPERATION_STATUSES.includes(project.status)) {
          log.debug(
            `Skipping sync for project ${project.name} - status is ${project.status} (active operation)`
          )
          return
        }

        // CRITICAL: Check for download/extraction indicators BEFORE any file system operations
        // This prevents sync from interfering even if status hasn't been updated yet
        // We use a try-catch with minimal file operations to detect active downloads/extractions
        let skipSync = false
        try {
          // Check 1: Look for download state files (indicates active download/extraction)
          // Use minimal file operations - only check if files exist, don't read them
          const tempDir = join(project.path, '.tmp')
          const downloadStatePath = join(tempDir, 'download-state.json')
          const partialDownloadPath = join(tempDir, 'moodle.zip.partial')

          // Use Promise.allSettled to avoid one failure blocking the other check
          const [stateCheck, partialCheck] = await Promise.allSettled([
            fs
              .access(downloadStatePath)
              .then(() => true)
              .catch(() => false),
            fs
              .access(partialDownloadPath)
              .then(() => true)
              .catch(() => false)
          ])

          const stateExists = stateCheck.status === 'fulfilled' && stateCheck.value === true
          const partialExists = partialCheck.status === 'fulfilled' && partialCheck.value === true

          if (stateExists || partialExists) {
            log.debug(
              `Skipping sync for project ${project.name} - download state files detected (download/extraction in progress)`
            )
            skipSync = true
          }
        } catch {
          // Error checking - continue with other checks
        }

        // Check 2: Check if Moodle extraction is incomplete (only if first check didn't skip)
        if (!skipSync) {
          try {
            const moodleCodePath = join(project.path, 'moodlecode')
            const configDistPath = join(moodleCodePath, 'config-dist.php')

            // Check if moodlecode directory exists
            const moodleCodeStats = await fs.stat(moodleCodePath).catch(() => null)
            if (moodleCodeStats?.isDirectory()) {
              // Directory exists - check if extraction is complete
              const configExists = await fs
                .access(configDistPath)
                .then(() => true)
                .catch(() => false)
              if (!configExists) {
                // config-dist.php doesn't exist - extraction is likely in progress or incomplete
                log.debug(
                  `Skipping sync for project ${project.name} - moodlecode directory exists but config-dist.php not found (extraction may be in progress)`
                )
                skipSync = true
              }
            }
          } catch {
            // Error checking - continue with other checks
          }
        }

        // If we detected active download/extraction, skip all further operations
        if (skipSync) {
          return
        }

        // Now safe to check project folder (after confirming no active operations)
        try {
          await fs.access(project.path)
        } catch {
          // Project folder doesn't exist, mark as stopped
          log.warn(`Project folder not found: ${project.path}`)
          if (project.status !== 'stopped') {
            this.updateProject(project.id, { status: 'stopped' })
          }
          return
        }

        // Check if docker-compose.yml exists before running Docker commands
        // This prevents Docker from accessing files in directories where extraction might be happening
        // CRITICAL: If docker-compose.yml doesn't exist, containers cannot exist, so skip entirely
        const composePath = join(project.path, 'docker-compose.yml')
        let composeExists = false
        try {
          await fs.access(composePath)
          composeExists = true
        } catch {
          // docker-compose.yml doesn't exist - project might be in early setup phase
          // Since containers cannot exist without docker-compose.yml, skip all Docker operations
          // This prevents Docker from reading the directory structure during extraction
          log.debug(
            `Skipping Docker sync for project ${project.name} - docker-compose.yml not found (project may be in setup, no containers possible)`
          )
          return
        }

        // Only proceed with Docker operations if docker-compose.yml exists
        // This ensures Docker won't interfere with file operations
        if (!composeExists) {
          return
        }

        // Check actual container status
        // At this point, we've confirmed:
        // 1. Project is not in active operation status
        // 2. No download/extraction files detected
        // 3. Extraction appears complete (if moodlecode exists)
        // 4. docker-compose.yml exists
        // It should be safe to run Docker commands
        log.debug(`Checking container status for project ${project.name} at path: ${project.path}`)
        const containerStatus = await this.dockerService.getProjectContainerStatus(project.path)
        log.debug(
          `Container status for ${project.name}: running=${containerStatus.running}, healthy=${containerStatus.healthy}, count=${containerStatus.containerCount}`
        )

        if (containerStatus.running && containerStatus.healthy) {
          // Containers are running and healthy - user likely closed app without stopping
          if (project.status !== 'ready') {
            log.info(`Project ${project.name} has running containers - updating status to ready`)
            this.updateProject(project.id, {
              status: 'ready',
              statusDetail: `Ready at http://localhost:${project.port}`,
              errorMessage: undefined,
              progress: undefined
            })
          } else {
            log.debug(`Project ${project.name} already marked as ready, no update needed`)
          }
        } else if (containerStatus.running && !containerStatus.healthy) {
          // Containers running but not healthy - mark as starting
          if (project.status !== 'starting' && project.status !== 'waiting') {
            log.info(`Project ${project.name} containers running but not healthy - updating status`)
            this.updateProject(project.id, {
              status: 'starting',
              statusDetail: 'Containers starting...',
              errorMessage: undefined,
              progress: undefined
            })
          }
        } else {
          // No containers running - mark as stopped
          // But skip if project is in an active operation status (shouldn't happen due to early return, but be safe)
          if (
            project.status !== 'stopped' &&
            project.status !== 'error' &&
            !this.ACTIVE_OPERATION_STATUSES.includes(project.status)
          ) {
            log.info(
              `Project ${project.name} has no running containers (running=${containerStatus.running}, count=${containerStatus.containerCount}) - updating status to stopped`
            )
            this.updateProject(project.id, {
              status: 'stopped',
              statusDetail: undefined,
              errorMessage: undefined,
              progress: undefined
            })
          } else {
            log.debug(`Project ${project.name} already marked as stopped, no update needed`)
          }
        }
      } catch (error) {
        log.error(`Error syncing project ${project.id}:`, error)
        // On error, mark as stopped to be safe
        // But don't interrupt active operations - they should complete on their own
        if (
          project.status !== 'stopped' &&
          project.status !== 'error' &&
          !this.ACTIVE_OPERATION_STATUSES.includes(project.status)
        ) {
          this.updateProject(project.id, { status: 'stopped' })
        } else if (this.ACTIVE_OPERATION_STATUSES.includes(project.status)) {
          log.debug(
            `Skipping error sync for project ${project.name} - status is ${project.status} (active operation)`
          )
        }
      }
    })

    // Wait for all sync operations to complete
    await Promise.all(syncPromises)

    log.info('Project state sync completed')
  }

  getAllProjects(): Project[] {
    return this.store.get('projects') || []
  }

  getProject(id: string): Project | undefined {
    const projects = this.getAllProjects()
    return projects.find((p) => p.id === id)
  }

  /**
   * Validate port number is in valid range and not reserved
   *
   * Validates that a port number:
   * - Is an integer between 1 and 65535
   * - Is not a privileged port (below 1024)
   * - Warns if it's a commonly reserved port
   *
   * @param port - Port number to validate
   * @throws {Error} If port is invalid or privileged
   *
   * @example
   * ```typescript
   * this.validatePort(8080) // OK
   * this.validatePort(80) // Throws: privileged port
   * this.validatePort(70000) // Throws: invalid range
   * ```
   */
  private validatePort(port: number): void {
    // Check valid port range
    if (!Number.isInteger(port) || port < 1 || port > PORTS.MAX_PORT) {
      throw new Error(`Port ${port} is invalid. Ports must be between 1 and ${PORTS.MAX_PORT}.`)
    }

    // Warn about well-known ports (0-1023) that require root privileges
    if (port < PORTS.MIN_PORT) {
      throw new Error(
        `Port ${port} is a privileged port (below ${PORTS.MIN_PORT}) and requires root privileges.\n\n` +
          `Please use a port between ${PORTS.MIN_PORT} and ${PORTS.MAX_PORT}.`
      )
    }

    // Common reserved ports to avoid
    if (PORTS.RESERVED_PORTS.includes(port)) {
      log.warn(
        `Port ${port} is a commonly used port. Consider using a different port to avoid conflicts.`
      )
    }
  }

  /**
   * Create a new Moodle project
   *
   * Creates a new project with the following steps:
   * 1. Validates project name, port, and path
   * 2. Checks for duplicate names/paths/ports
   * 3. Validates port availability on the system
   * 4. Generates a unique database port
   * 5. Creates project directory
   * 6. Generates docker-compose.yml with appropriate configuration
   * 7. Saves project metadata to persistent storage
   *
   * **Note:** This only creates the project structure. To actually start Moodle,
   * call `startProject()` after creation.
   *
   * @param project - Project configuration (without id and createdAt)
   * @returns The created project with generated id and createdAt timestamp
   * @throws {Error} If validation fails, port conflicts exist, or creation fails
   *
   * @example
   * ```typescript
   * const project = await projectService.createProject({
   *   name: 'My Moodle Site',
   *   moodleVersion: '5.1',
   *   port: 8080,
   *   status: 'stopped',
   *   path: '/path/to/project'
   * })
   * ```
   */
  async createProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
    // Validate port range and reserved ports
    this.validatePort(project.port)

    // Validate and sanitize project path to prevent path traversal
    // Basic path validation - ensure no path traversal attempts
    if (project.path.includes('..') || project.path.includes('~')) {
      log.warn(`Project path contains suspicious characters: ${project.path}`)
    }

    // Ensure path uses proper separators (cross-platform)
    // Normalize path separators - path.join() handles this, but normalize input first
    if (!project.path || project.path.trim() === '') {
      throw new Error('Project path cannot be empty')
    }

    // Normalize path separators for cross-platform compatibility
    // Convert any path separators to the platform-specific separator
    let normalizedPath = project.path.split(/[/\\]/).filter(Boolean).join(sep)

    // Auto-fix paths that look absolute but are missing the leading slash/drive letter
    const isUnixLike = sep === '/'

    if (isUnixLike) {
      // On Unix-like systems, if path doesn't start with / but looks like an absolute path
      // (e.g., "Users/...", "home/...", "var/..."), add the leading slash
      if (
        !normalizedPath.startsWith('/') &&
        (normalizedPath.startsWith('Users/') ||
          normalizedPath.startsWith('home/') ||
          normalizedPath.startsWith('var/') ||
          normalizedPath.startsWith('opt/') ||
          normalizedPath.startsWith('usr/'))
      ) {
        log.warn(
          `Auto-fixing path missing leading slash: "${normalizedPath}" -> "/${normalizedPath}"`
        )
        normalizedPath = '/' + normalizedPath
      }
    } else {
      // On Windows, if path doesn't have drive letter or UNC, try to resolve it
      if (!/^[a-zA-Z]:/.test(normalizedPath) && !normalizedPath.startsWith('\\\\')) {
        // Path might be relative - resolve will make it absolute from cwd
        // But log a warning since this might not be what user intended
        log.warn(
          `Path appears to be relative, resolving from current directory: "${normalizedPath}"`
        )
      }
    }

    // Resolve the path to handle any remaining relative components (like . or ..)
    // This ensures we have a clean, absolute path
    normalizedPath = resolve(normalizedPath)

    // Final validation: ensure the resolved path is absolute
    const isAbsolute = isUnixLike
      ? normalizedPath.startsWith('/')
      : /^([a-zA-Z]:\\|\\\\)/.test(normalizedPath)

    if (!isAbsolute) {
      throw new Error(
        `Project path must be an absolute path.\n\n` +
          `Received: "${project.path}"\n` +
          `After normalization: "${normalizedPath}"\n\n` +
          `Please ensure your workspace folder is configured correctly in settings.`
      )
    }

    // Normalize path for comparison (cross-platform)
    const normalizedProjectPath = normalizedPath

    // Check for existing project with same name/path
    const existingProjects = this.getAllProjects()
    const duplicatePath = existingProjects.find((p) => {
      // Normalize both paths for comparison (cross-platform)
      const normalizedExistingPath = p.path.split(/[/\\]/).filter(Boolean).join(sep)
      return normalizedExistingPath === normalizedProjectPath
    })
    if (duplicatePath) {
      throw new Error(
        `A project already exists at "${normalizedProjectPath}".\n\n` +
          `Please choose a different project name or delete the existing project first.`
      )
    }

    // Check for port conflicts with existing projects
    const portConflict = existingProjects.find((p) => p.port === project.port)
    if (portConflict) {
      throw new Error(
        `Port ${project.port} is already in use by project "${portConflict.name}".\n\n` +
          `Please choose a different port (e.g., ${project.port + 1}) or stop/delete the existing project.`
      )
    }

    // Check if port is available on the system
    const portAvailable = await this.dockerService.checkPort(project.port)
    if (!portAvailable) {
      throw new Error(
        `Port ${project.port} is already in use by another application.\n\n` +
          `Please choose a different port or stop the application using port ${project.port}.`
      )
    }

    // Generate random port for database (10000-60000) and ensure it's unique
    // Validate database port as well
    let dbPort = Math.floor(
      Math.random() * (PORTS.DB_PORT_MAX - PORTS.DB_PORT_MIN + 1) + PORTS.DB_PORT_MIN
    )
    let attempts = 0
    while (existingProjects.some((p) => p.dbPort === dbPort) && attempts < 10) {
      dbPort = Math.floor(
        Math.random() * (PORTS.DB_PORT_MAX - PORTS.DB_PORT_MIN + 1) + PORTS.DB_PORT_MIN
      )
      attempts++
    }

    // Validate database port range
    if (dbPort < PORTS.MIN_PORT || dbPort > PORTS.MAX_PORT) {
      dbPort =
        PORTS.DB_PORT_MIN + Math.floor(Math.random() * (PORTS.DB_PORT_MAX - PORTS.DB_PORT_MIN)) // Ensure valid range
    }

    // Check if database port is available on the system
    const dbPortAvailable = await this.dockerService.checkPort(dbPort)
    if (!dbPortAvailable) {
      // Try a few more times to find an available port
      for (let i = 0; i < 10; i++) {
        dbPort = Math.floor(
          Math.random() * (PORTS.DB_PORT_MAX - PORTS.DB_PORT_MIN + 1) + PORTS.DB_PORT_MIN
        )
        const available = await this.dockerService.checkPort(dbPort)
        if (available && !existingProjects.some((p) => p.dbPort === dbPort)) {
          break
        }
      }
      // Final check - if still not available, warn but continue (Docker will handle it)
      const finalCheck = await this.dockerService.checkPort(dbPort)
      if (!finalCheck) {
        log.warn(`Database port ${dbPort} may be in use, but continuing with project creation`)
      }
    }

    const newProject: Project = {
      ...project,
      path: normalizedProjectPath, // Use normalized path
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      dbPort
    }

    // Check if project directory already exists and has containers
    // This handles the case where a previous project creation failed but containers were created
    const dockerAvailable = await this.dockerService.checkDockerInstalled()
    if (dockerAvailable) {
      try {
        // Check if project directory exists
        const dirExists = await fs
          .access(normalizedProjectPath)
          .then(() => true)
          .catch(() => false)

        if (dirExists) {
          // Check if docker-compose.yml exists (indicates containers might exist)
          const composePath = join(normalizedProjectPath, 'docker-compose.yml')
          const composeExists = await fs
            .access(composePath)
            .then(() => true)
            .catch(() => false)

          if (composeExists) {
            // Check if containers actually exist
            const containerStatus =
              await this.dockerService.getProjectContainerStatus(normalizedProjectPath)
            if (containerStatus.containerCount > 0) {
              throw new Error(
                `Docker containers already exist for this project path.\n\n` +
                  `Found ${containerStatus.containerCount} container(s) at "${normalizedProjectPath}".\n\n` +
                  `This usually means:\n` +
                  `- A previous project creation was interrupted\n` +
                  `- Containers were created manually\n` +
                  `- Another project is using this path\n\n` +
                  `Please either:\n` +
                  `1. Choose a different project name/path\n` +
                  `2. Delete the existing containers manually: docker compose down -v\n` +
                  `3. Delete the project folder and try again`
              )
            }
          }
        }
      } catch (error: unknown) {
        // If error is our custom error, re-throw it
        if (error instanceof Error && error.message?.includes('Docker containers already exist')) {
          throw error
        }
        // Otherwise, log and continue (might be a permission issue or Docker not accessible)
        log.warn(`Could not check for existing containers: ${error.message}`)
      }
    }

    // Create project directory (will not fail if it already exists due to recursive: true)
    await fs.mkdir(normalizedProjectPath, { recursive: true })

    // Get version data
    const version = this.versionsData?.releases.find((r) => r.version === project.moodleVersion)
    if (!version) {
      throw new Error(`Version ${project.moodleVersion} not found`)
    }

    // Generate docker-compose.yml
    const composeContent = this.composeGenerator.generate(newProject, version)
    await fs.writeFile(join(normalizedProjectPath, 'docker-compose.yml'), composeContent)

    // Save to store
    const projects = this.getAllProjects()
    this.store.set('projects', [...projects, newProject])

    return newProject
  }

  updateProject(id: string, updates: Partial<Project>): void {
    const projects = this.getAllProjects()
    const updatedProjects = projects.map((p) => (p.id === id ? { ...p, ...updates } : p))
    this.store.set('projects', updatedProjects)

    // Notify renderer of project update
    const allWindows = BrowserWindow.getAllWindows()
    allWindows.forEach((window) => {
      window.webContents.send('project:updated', { id, updates })
    })
  }

  /**
   * Duplicate an existing project with a new name and port
   *
   * Creates a copy of an existing project with:
   * - New project name
   * - New port (validated and checked for conflicts)
   * - Same Moodle version
   * - Copied docker-compose.yml (with updated ports)
   *
   * **Note:** This creates a new project structure but does NOT copy:
   * - Moodle source code (will be downloaded on first start)
   * - Database data
   * - Moodledata files
   *
   * @param id - ID of the source project to duplicate
   * @param newName - Name for the new project (must be unique)
   * @param newPort - Port for the new project (must be available)
   * @returns The newly created duplicated project
   * @throws {Error} If source project not found, name/port conflicts, or duplication fails
   *
   * @example
   * ```typescript
   * const duplicated = await projectService.duplicateProject(
   *   'project-id-123',
   *   'My Moodle Site Copy',
   *   8081
   * )
   * ```
   */
  async duplicateProject(id: string, newName: string, newPort: number): Promise<Project> {
    const sourceProject = this.getProject(id)
    if (!sourceProject) throw new Error('Source project not found')

    // Validate new name and port
    const existingProjects = this.getAllProjects()
    const duplicateName = existingProjects.find((p) => p.name === newName && p.id !== id)
    if (duplicateName) {
      throw new Error(`A project with name "${newName}" already exists.`)
    }

    this.validatePort(newPort)

    const portConflict = existingProjects.find((p) => p.port === newPort)
    if (portConflict) {
      throw new Error(`Port ${newPort} is already in use by project "${portConflict.name}".`)
    }

    const portAvailable = await this.dockerService.checkPort(newPort)
    if (!portAvailable) {
      throw new Error(`Port ${newPort} is already in use by another application.`)
    }

    // Generate new project path (cross-platform)
    const projectSlug = newName.toLowerCase().replace(/\s+/g, '-')
    // Extract workspace folder by removing last path segment
    const pathParts = sourceProject.path.split(/[/\\]/).filter(Boolean)
    pathParts.pop() // Remove project name
    const workspaceFolder = pathParts.length > 0 ? join(...pathParts) : sourceProject.path
    const newPath = join(workspaceFolder, projectSlug)

    // Check if path already exists
    const duplicatePath = existingProjects.find((p) => p.path === newPath)
    if (duplicatePath) {
      throw new Error(`A project already exists at "${newPath}".`)
    }

    // Create new project with same configuration but new name/port
    const duplicatedProject: Omit<Project, 'id' | 'createdAt'> = {
      name: newName,
      moodleVersion: sourceProject.moodleVersion,
      port: newPort,
      status: 'stopped',
      path: newPath
    }

    // Create project directory
    await fs.mkdir(newPath, { recursive: true })

    // Copy docker-compose.yml if it exists (update port in the copy)
    try {
      const composePath = join(sourceProject.path, 'docker-compose.yml')
      const composeContent = await fs.readFile(composePath, 'utf-8')

      // Replace port numbers in docker-compose.yml
      const updatedCompose = composeContent
        .replace(new RegExp(`"${sourceProject.port}:80"`, 'g'), `"${newPort}:80"`)
        .replace(new RegExp(`"${(sourceProject.port || 8080) + 1}:80"`, 'g'), `"${newPort + 1}:80"`)

      await fs.writeFile(join(newPath, 'docker-compose.yml'), updatedCompose)
    } catch (error) {
      log.warn('Could not copy docker-compose.yml, will be generated on first start:', error)
    }

    // Create the project in the store (this will generate docker-compose.yml if missing)
    const newProject = await this.createProject(duplicatedProject)

    log.info(`Project "${sourceProject.name}" duplicated as "${newName}"`)
    return newProject
  }

  async deleteProject(id: string): Promise<void> {
    const project = this.getProject(id)
    if (!project) return

    // Set status to deleting
    this.updateProject(id, { status: 'deleting' })

    // Stop and remove containers, volumes, and networks
    try {
      await this.dockerService.composeDown({
        cwd: project.path,
        removeVolumes: true
      })
    } catch (error) {
      log.error('Error cleaning up Docker resources:', error)
      // Continue with deletion even if Docker cleanup fails
    }

    // Delete project directory
    try {
      await fs.rm(project.path, { recursive: true, force: true })
    } catch (error) {
      log.error('Error deleting project directory:', error)
      // Continue with database deletion even if directory deletion fails
    }

    // Remove from database
    const projects = this.getAllProjects()
    this.store.set(
      'projects',
      projects.filter((p) => p.id !== id)
    )
  }

  /**
   * Start a Moodle project
   *
   * Starts a project by:
   * 1. Checking Docker availability
   * 2. Downloading Moodle source (if first run)
   * 3. Starting Docker containers
   * 4. Waiting for MySQL to be healthy
   * 5. Installing Moodle (if first run)
   * 6. Configuring Moodle (disabling password policy, restoring sample course)
   * 7. Waiting for HTTP server to respond
   *
   * Progress updates are sent via the `onLog` callback and project status updates.
   *
   * @param id - Project ID to start
   * @param onLog - Optional callback for log messages during startup
   * @throws {Error} If Docker not available, project not found, or startup fails
   *
   * @example
   * ```typescript
   * await projectService.startProject('project-id', (log) => {
   *   console.log(log) // "📥 Downloading Moodle source code..."
   * })
   * ```
   */
  async startProject(id: string, onLog?: (log: string) => void): Promise<void> {
    const project = this.getProject(id)
    if (!project) throw new Error('Project not found')

    // Get version data for download URL
    const version = this.versionsData?.releases.find((r) => r.version === project.moodleVersion)
    if (!version) {
      throw new Error(`Version ${project.moodleVersion} not found`)
    }

    // Check Docker daemon
    const dockerAvailable = await this.dockerService.checkDockerInstalled()
    if (!dockerAvailable) {
      const errorMsg =
        'Docker is not installed or not running.\n\n' +
        'Please:\n' +
        '1. Install Docker Desktop from https://docker.com\n' +
        '2. Start Docker Desktop\n' +
        '3. Wait for Docker to be ready (check the Docker icon)\n' +
        '4. Try starting the project again'
      this.updateProject(id, {
        status: 'error',
        errorMessage: errorMsg,
        lastUsed: new Date().toISOString()
      })
      onLog?.(`❌ ${errorMsg}`)
      return
    }

    try {
      // Update status callback
      const onStatusUpdate = (
        status: Project['status'],
        errorMessage?: string,
        statusDetail?: string,
        progress?: ProgressInfo
      ): void => {
        const updates: Partial<Project> = { status, lastUsed: new Date().toISOString() }

        if (status === 'error' && errorMessage) {
          updates.errorMessage = errorMessage
          updates.statusDetail = undefined
          updates.progress = undefined
        } else if (status !== 'error') {
          updates.errorMessage = undefined
          updates.statusDetail = statusDetail
          updates.progress = progress
        }

        this.updateProject(id, updates)
      }

      // Use lifecycle manager for complete workflow
      const { LifecycleManager } = await import('./lifecycle-manager')
      const lifecycleManager = new LifecycleManager()

      await lifecycleManager.startProject(project, version.download, version, onStatusUpdate, onLog)
    } catch (err: unknown) {
      // Error already handled by lifecycle manager, but ensure state is updated
      const errorMessage = err instanceof Error ? err.message : String(err)
      onLog?.(`❌ Failed to start project: ${errorMessage}`)
    }
  }

  async stopProject(id: string): Promise<void> {
    const project = this.getProject(id)
    if (!project) throw new Error('Project not found')

    // Set status to stopping
    this.updateProject(id, { status: 'stopping' })

    const { LifecycleManager } = await import('./lifecycle-manager')
    const lifecycleManager = new LifecycleManager()

    await lifecycleManager.stopProject(project)
    this.updateProject(id, { status: 'stopped' })
  }

  async checkDocker(): Promise<boolean> {
    return this.dockerService.checkDockerInstalled()
  }

  /**
   * Get Docker container logs for a project
   *
   * Retrieves the last 500 lines of logs from all containers in the project's
   * docker-compose setup. Useful for debugging container issues.
   *
   * @param id - Project ID to get logs for
   * @returns Log output from all containers (last 500 lines)
   * @throws {Error} If project not found or log retrieval fails
   *
   * @example
   * ```typescript
   * const logs = await projectService.getProjectLogs('project-id')
   * console.log(logs) // Container log output
   * ```
   */
  async getProjectLogs(id: string): Promise<string> {
    const project = this.getProject(id)
    if (!project) throw new Error('Project not found')

    return new Promise((resolve, reject) => {
      // Use cross-platform spawn options
      const spawnOptions: {
        cwd: string
        env: NodeJS.ProcessEnv
        shell: boolean
        windowsHide?: boolean
      } = {
        cwd: project.path,
        env: process.env,
        shell: false
      }
      // windowsHide only on Windows
      if (process.platform === 'win32') {
        spawnOptions.windowsHide = true
      }

      const proc: ChildProcess = spawn('docker', ['compose', 'logs', '--tail', '500'], spawnOptions)

      let output = ''
      let errorOutput = ''

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString()
      })

      proc.stderr?.on('data', (data: Buffer) => {
        errorOutput += data.toString()
      })

      proc.on('close', (code: number) => {
        if (code === 0) {
          resolve(output || 'No logs available')
        } else {
          reject(new Error(`Failed to get logs: ${errorOutput || 'Unknown error'}`))
        }
      })

      proc.on('error', (err: Error) => {
        reject(err)
      })
    })
  }
}
