import { Project, VersionsData, ProgressInfo } from '../types'
import { promises as fs } from 'fs'
import { DockerService } from './docker-service'
import { ComposeGenerator } from './compose-generator'
import { BrowserWindow } from 'electron'
import Store from 'electron-store'
import log from 'electron-log'
import { getAssetPath } from '../utils/asset-path'
import { join } from 'path'

interface ProjectStoreSchema {
  projects: Project[]
}

export class ProjectService {
  private store: any // electron-store v11 has type definition issues, using any for now
  private composeGenerator: ComposeGenerator
  private dockerService: DockerService
  private versionsData: VersionsData | null = null

  constructor() {
    this.store = new Store<ProjectStoreSchema>({
      defaults: {
        projects: []
      }
    }) as any
    this.composeGenerator = new ComposeGenerator()
    this.dockerService = new DockerService()
  }

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
   * Sync all projects with actual Docker container states
   * Call this on app startup to ensure database reflects reality
   * Also handles the case where user closed app without stopping containers
   */
  async syncProjectStates(): Promise<void> {
    const projects = this.getAllProjects()

    if (projects.length === 0) {
      log.info('No projects to sync')
      return
    }

    // Check if Docker is available first
    const dockerAvailable = await this.dockerService.checkDockerInstalled()
    if (!dockerAvailable) {
      log.warn('Docker not available during sync - marking all projects as stopped')
      // If Docker is not running, mark all projects as stopped
      for (const project of projects) {
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

    for (const project of projects) {
      try {
        // Check if project folder exists
        try {
          await fs.access(project.path)
        } catch {
          // Project folder doesn't exist, mark as stopped
          log.warn(`Project folder not found: ${project.path}`)
          if (project.status !== 'stopped') {
            this.updateProject(project.id, { status: 'stopped' })
          }
          continue
        }

        // Check actual container status
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
          if (project.status !== 'stopped' && project.status !== 'error') {
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
        if (project.status !== 'stopped' && project.status !== 'error') {
          this.updateProject(project.id, { status: 'stopped' })
        }
      }
    }

    log.info('Project state sync completed')
  }

  getAllProjects(): Project[] {
    return this.store.get('projects') || []
  }

  getProject(id: string): Project | undefined {
    const projects = this.getAllProjects()
    return projects.find((p) => p.id === id)
  }

  async createProject(project: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
    const newProject: Project = {
      ...project,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      // Generate random port for database (10000-60000)
      dbPort: Math.floor(Math.random() * (60000 - 10000 + 1) + 10000)
    }

    // Create project directory
    await fs.mkdir(project.path, { recursive: true })

    // Get version data
    const version = this.versionsData?.releases.find((r) => r.version === project.moodleVersion)
    if (!version) {
      throw new Error(`Version ${project.moodleVersion} not found`)
    }

    // Generate docker-compose.yml
    const composeContent = this.composeGenerator.generate(newProject, version)
    await fs.writeFile(join(project.path, 'docker-compose.yml'), composeContent)

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
      ) => {
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
    } catch (err: any) {
      // Error already handled by lifecycle manager, but ensure state is updated
      onLog?.(`❌ Failed to start project: ${err?.message || err}`)
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
}
