import { spawn } from 'child_process'
import { basename } from 'path'
import log from 'electron-log'
import { DOCKER } from '../constants'

export interface DockerCommand {
  cwd: string
  onStdout?: (data: string) => void
  onStderr?: (data: string) => void
  onClose?: (code: number) => void
}

interface DockerStatusCache {
  isInstalled: boolean
  timestamp: number
}

export class DockerService {
  private dockerStatusCache: DockerStatusCache | null = null
  private readonly DOCKER_STATUS_CACHE_TTL = DOCKER.STATUS_CACHE_TTL_MS

  /**
   * Check if Docker is installed and accessible
   * 
   * Uses caching (5 second TTL) to avoid spawning processes on every check.
   * This improves performance when checking Docker status frequently.
   * 
   * @returns `true` if Docker is installed and daemon is running, `false` otherwise
   * 
   * @example
   * ```typescript
   * const isAvailable = await dockerService.checkDockerInstalled()
   * if (!isAvailable) {
   *   console.error('Docker is not running')
   * }
   * ```
   */
  async checkDockerInstalled(): Promise<boolean> {
    const now = Date.now()
    
    // Return cached result if still valid
    if (
      this.dockerStatusCache &&
      now - this.dockerStatusCache.timestamp < this.DOCKER_STATUS_CACHE_TTL
    ) {
      return this.dockerStatusCache.isInstalled
    }

    // Check Docker status
    const isInstalled = await new Promise<boolean>((resolve) => {
      const proc = spawn('docker', ['info'], { windowsHide: true, env: process.env })
      proc.on('close', (code) => resolve(code === 0))
      proc.on('error', () => resolve(false))
    })

    // Update cache
    this.dockerStatusCache = {
      isInstalled,
      timestamp: now
    }

    return isInstalled
  }

  /**
   * Clear Docker status cache (useful when Docker state might have changed)
   */
  clearDockerStatusCache(): void {
    this.dockerStatusCache = null
  }

  /**
   * Check if project containers are running
   */
  async areContainersRunning(projectPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('docker', ['compose', 'ps', '--format', 'json'], {
        cwd: projectPath,
        windowsHide: true,
        env: process.env
      })

      let output = ''
      proc.stdout?.on('data', (data) => {
        output += data.toString()
      })

      proc.on('close', (code) => {
        if (code !== 0) {
          resolve(false)
          return
        }

        try {
          const parsed = JSON.parse(output)
          const containers = Array.isArray(parsed) ? parsed : [parsed]

          // Check if at least one container is running
          const hasRunning = containers.some((c: any) => c.State === 'running')
          resolve(hasRunning)
        } catch {
          resolve(false)
        }
      })

      proc.on('error', () => resolve(false))
    })
  }

  /**
   * Get container status summary for a project
   * 
   * Checks the status of all containers in a project's docker-compose setup.
   * Returns a summary indicating if containers are running and healthy.
   * 
   * @param projectPath - Path to the project directory (contains docker-compose.yml)
   * @returns Object with:
   *   - `running`: true if at least one container is running
   *   - `healthy`: true if all containers are healthy (or have no health check)
   *   - `containerCount`: number of containers found
   * 
   * @example
   * ```typescript
   * const status = await dockerService.getProjectContainerStatus('/path/to/project')
   * if (status.running && status.healthy) {
   *   console.log('All containers are running and healthy')
   * }
   * ```
   */
  async getProjectContainerStatus(projectPath: string): Promise<{
    running: boolean
    healthy: boolean
    containerCount: number
  }> {
    return new Promise((resolve) => {
      const proc = spawn('docker', ['compose', 'ps', '--format', 'json'], {
        cwd: projectPath,
        windowsHide: true,
        env: process.env
      })

      let output = ''
      let stderr = ''

      proc.stdout?.on('data', (data) => {
        output += data.toString()
      })

      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (code !== 0) {
          log.debug(`docker compose ps failed with code ${code} in ${projectPath}, stderr: ${stderr}`)
          resolve({ running: false, healthy: false, containerCount: 0 })
          return
        }

        // Handle empty output (no containers)
        const trimmedOutput = output.trim()
        if (!trimmedOutput) {
          log.debug(`docker compose ps returned empty output for ${projectPath}`)
          resolve({ running: false, healthy: false, containerCount: 0 })
          return
        }

        try {
          // docker compose ps --format json returns one JSON object per line
          // Parse each line as a separate JSON object
          const lines = trimmedOutput.split('\n').filter((line) => line.trim())
          const containers: any[] = []

          for (const line of lines) {
            try {
              const container = JSON.parse(line.trim())
              containers.push(container)
            } catch (parseError) {
              log.debug(`Failed to parse container line: ${line}`, parseError)
            }
          }

          if (containers.length === 0) {
            log.debug(`No containers parsed from output: ${trimmedOutput}`)
            resolve({ running: false, healthy: false, containerCount: 0 })
            return
          }

          const runningContainers = containers.filter((c: any) => c.State === 'running')
          const allHealthy = containers.every((c: any) => {
            if (c.Health) {
              return c.Health === 'healthy'
            }
            return c.State === 'running'
          })

          log.debug(
            `Container status for ${projectPath}: ${runningContainers.length}/${containers.length} running, healthy: ${allHealthy}`
          )

          resolve({
            running: runningContainers.length > 0,
            healthy: allHealthy && runningContainers.length > 0,
            containerCount: containers.length
          })
        } catch (error) {
          log.error(`Error parsing docker compose ps output for ${projectPath}:`, error)
          log.debug(`Output was: ${output}`)
          resolve({ running: false, healthy: false, containerCount: 0 })
        }
      })

      proc.on('error', (err) => {
        log.error(`Error running docker compose ps for ${projectPath}:`, err)
        resolve({ running: false, healthy: false, containerCount: 0 })
      })
    })
  }

  /**
   * Start containers with docker compose up
   */
  async composeUp(options: DockerCommand): Promise<void> {
    return this.runDockerCompose(['up', '-d'], options)
  }

  /**
   * Stop containers with docker compose stop
   */
  async composeStop(options: DockerCommand): Promise<void> {
    return this.runDockerCompose(['stop'], options)
  }

  /**
   * Remove containers, networks, and optionally volumes with docker compose down
   */
  async composeDown(options: DockerCommand & { removeVolumes?: boolean }): Promise<void> {
    const args = ['down']
    if (options.removeVolumes) {
      args.push('--volumes') // Remove named volumes
      args.push('--remove-orphans') // Remove orphaned containers
    }
    return this.runDockerCompose(args, options)
  }

  /**
   * Get container logs
   */
  async composeLogs(options: DockerCommand & { follow?: boolean }): Promise<void> {
    const args = ['logs']
    if (options.follow) {
      args.push('--follow')
    }
    return this.runDockerCompose(args, options)
  }

  /**
   * Wait for a service to be healthy
   */
  async waitForHealthy(containerName: string, cwd: string, timeoutMs = DOCKER.HEALTH_CHECK_TIMEOUT_MS): Promise<void> {
    const startTime = Date.now()
    let lastStatus = 'unknown'
    let checkInterval: NodeJS.Timeout | null = null

    try {
      while (Date.now() - startTime < timeoutMs) {
        try {
          const isHealthy = await this.checkContainerHealth(containerName, cwd)
          if (isHealthy) {
            return
          }

          // Get current status for better error reporting
          try {
            const statusResult = await this.getContainerStatus(containerName, cwd)
            lastStatus = statusResult
          } catch {
            // Ignore status check errors
          }
        } catch {
          // Container might not be running yet
        }

        // Wait 3 seconds before next check
        await new Promise<void>((resolve) => {
          checkInterval = setTimeout(() => resolve(), 3000)
        })
      }

      throw new Error(
        `Timeout waiting for ${containerName} to be healthy after ${timeoutMs / 1000} seconds\n\n` +
          `Last known status: ${lastStatus}\n\n` +
          `Troubleshooting:\n` +
          `1. Check container logs: docker compose logs ${containerName}\n` +
          `2. Check container status: docker compose ps\n` +
          `3. The container may need more time to initialize\n` +
          `4. Check if the container is stuck: docker compose exec ${containerName} ps aux`
      )
    } finally {
      // Clean up any pending interval
      if (checkInterval) {
        clearTimeout(checkInterval)
      }
    }
  }

  /**
   * Get detailed container status for debugging
   */
  private async getContainerStatus(containerName: string, cwd: string): Promise<string> {
    return new Promise((resolve) => {
      const projectName = basename(cwd)
      const fullContainerName = `${projectName}-${containerName}-1`

      const proc = spawn('docker', ['inspect', fullContainerName, '--format', '{{json .State}}'], {
        cwd,
        windowsHide: true,
        env: process.env
      })

      let output = ''
      proc.stdout?.on('data', (data) => {
        output += data.toString()
      })

      proc.on('close', (code) => {
        if (code !== 0) {
          resolve('not found')
          return
        }

        try {
          const state = JSON.parse(output)
          let status = state.Running ? 'running' : 'stopped'

          if (state.Health && state.Health.Status) {
            status += ` (health: ${state.Health.Status})`
          }

          resolve(status)
        } catch {
          resolve('unknown')
        }
      })

      proc.on('error', () => resolve('error checking status'))
    })
  }

  /**
   * Check if container is healthy
   */
  private async checkContainerHealth(containerName: string, cwd: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Use docker inspect for more reliable health check
      // Format: project-name-service-1 (e.g., m51-db-1)
      const projectName = basename(cwd)
      const fullContainerName = `${projectName}-${containerName}-1`

      const proc = spawn('docker', ['inspect', fullContainerName, '--format', '{{json .State}}'], {
        cwd,
        windowsHide: true,
        env: process.env
      })

      let output = ''
      let stderr = ''

      proc.stdout?.on('data', (data) => {
        output += data.toString()
      })

      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (code !== 0) {
          // Container might not exist yet
          resolve(false)
          return
        }

        try {
          const state = JSON.parse(output)

          // Check if container is running
          if (!state.Running) {
            resolve(false)
            return
          }

          // If container has health check, check Health.Status
          if (state.Health && state.Health.Status) {
            const isHealthy = state.Health.Status === 'healthy'
            resolve(isHealthy)
          } else {
            // No health check defined, just check if running
            resolve(true)
          }
        } catch (error) {
          log.debug('Error parsing container state:', error, 'Output:', output)
          resolve(false)
        }
      })

      proc.on('error', () => resolve(false))
    })
  }

  /**
   * Execute docker compose command
   */
  private runDockerCompose(args: string[], options: DockerCommand): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('docker', ['compose', ...args], {
        cwd: options.cwd,
        windowsHide: true,
        env: process.env
      })

      let stderr = ''

      proc.stdout?.on('data', (data) => {
        if (options.onStdout) {
          options.onStdout(data.toString())
        }
      })

      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
        if (options.onStderr) {
          options.onStderr(data.toString())
        }
      })

      proc.on('close', (code) => {
        if (options.onClose && code !== null) {
          options.onClose(code)
        }
        if (code === 0) {
          resolve()
        } else {
          // Create detailed error message with suggestions
          const errorMsg = this.parseDockerError(code, stderr, args)
          reject(new Error(errorMsg))
        }
      })

      proc.on('error', (err) => {
        // Handle cases where docker command itself fails (not installed, etc.)
        const enhancedError = new Error(
          `Docker command failed: ${err.message}\n\n` +
            `Possible causes:\n` +
            `- Docker is not installed\n` +
            `- Docker daemon is not running\n` +
            `- Docker is not in your system PATH\n\n` +
            `To fix:\n` +
            `- Install Docker Desktop from https://docker.com\n` +
            `- Start Docker Desktop and wait for it to be ready\n` +
            `- On Linux: Run "sudo systemctl start docker"`
        )
        reject(enhancedError)
      })
    })
  }

  /**
   * Check if a port is available
   */
  async checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = require('net').createServer()
      server.once('error', () => resolve(false))
      server.once('listening', () => {
        server.close()
        resolve(true)
      })
      server.listen(port)
    })
  }

  /**
   * Parse Docker errors and provide helpful suggestions
   */
  private parseDockerError(code: number | null, stderr: string, args: string[]): string {
    const lowerStderr = stderr.toLowerCase()

    // Docker daemon not running or restarted
    if (
      lowerStderr.includes('cannot connect to docker daemon') ||
      lowerStderr.includes('is the docker daemon running') ||
      lowerStderr.includes('connection refused') ||
      lowerStderr.includes('docker daemon') ||
      lowerStderr.includes('daemon is not running')
    ) {
      return (
        `Docker daemon is not running (exit code ${code})\n\n` +
        `Error: ${stderr}\n\n` +
        `How to fix:\n` +
        `- Start Docker Desktop and wait for it to be ready\n` +
        `- Check Docker Desktop status in system tray/menu bar\n` +
        `- On Linux: Run "sudo systemctl start docker"\n` +
        `- Wait a few seconds after starting Docker before retrying`
      )
    }

    // Permission denied or permission changes
    if (
      lowerStderr.includes('permission denied') ||
      lowerStderr.includes('dial unix') ||
      lowerStderr.includes('permission') ||
      lowerStderr.includes('access denied') ||
      lowerStderr.includes('unauthorized')
    ) {
      return (
        `Docker permission error (exit code ${code})\n\n` +
        `Error: ${stderr}\n\n` +
        `How to fix:\n` +
        `- Linux: Add your user to the docker group:\n` +
        `  sudo usermod -aG docker $USER\n` +
        `  Then log out and back in (or run: newgrp docker)\n` +
        `- macOS/Windows: Restart Docker Desktop\n` +
        `- Check Docker Desktop permissions in system settings\n` +
        `- Try running Docker commands manually to verify permissions`
      )
    }

    // Port already in use
    if (
      lowerStderr.includes('port is already allocated') ||
      lowerStderr.includes('address already in use')
    ) {
      const portMatch = stderr.match(/(\d+)/)
      const port = portMatch ? portMatch[1] : 'unknown'
      return (
        `Port ${port} is already in use (exit code ${code})\n\n` +
        `Error: ${stderr}\n\n` +
        `How to fix:\n` +
        `- Stop other applications using this port\n` +
        `- Use a different port for this project\n` +
        `- Find what's using the port:\n` +
        `  macOS/Linux: lsof -i :${port}\n` +
        `  Windows: netstat -ano | findstr :${port}`
      )
    }

    // Image not found
    if (lowerStderr.includes('not found') || lowerStderr.includes('no such image')) {
      return (
        `Docker image not found (exit code ${code})\n\n` +
        `Error: ${stderr}\n\n` +
        `How to fix:\n` +
        `- Check your internet connection\n` +
        `- Docker will download the image automatically\n` +
        `- If behind a proxy, configure Docker proxy settings`
      )
    }

    // Network issues
    if (
      lowerStderr.includes('network') ||
      lowerStderr.includes('timeout') ||
      lowerStderr.includes('connection') ||
      lowerStderr.includes('unreachable')
    ) {
      return (
        `Docker network error (exit code ${code})\n\n` +
        `Error: ${stderr}\n\n` +
        `How to fix:\n` +
        `- Check your internet connection\n` +
        `- Restart Docker Desktop\n` +
        `- Check firewall settings\n` +
        `- Try running: docker network prune\n` +
        `- If behind a proxy, configure Docker proxy settings`
      )
    }

    // Container/image issues
    if (
      lowerStderr.includes('container') ||
      lowerStderr.includes('no such container') ||
      lowerStderr.includes('container name') ||
      lowerStderr.includes('already exists')
    ) {
      return (
        `Docker container error (exit code ${code})\n\n` +
        `Error: ${stderr}\n\n` +
        `How to fix:\n` +
        `- Try stopping and removing existing containers:\n` +
        `  docker compose down -v (in project folder)\n` +
        `- Check if containers are running: docker compose ps\n` +
        `- Restart Docker Desktop if containers seem stuck`
      )
    }

    // File system or volume issues
    if (
      lowerStderr.includes('volume') ||
      lowerStderr.includes('mount') ||
      lowerStderr.includes('file system') ||
      lowerStderr.includes('path') ||
      lowerStderr.includes('directory')
    ) {
      return (
        `Docker volume/filesystem error (exit code ${code})\n\n` +
        `Error: ${stderr}\n\n` +
        `How to fix:\n` +
        `- Check project folder permissions\n` +
        `- Ensure project folder exists and is accessible\n` +
        `- On Windows: Check WSL2 integration if using WSL\n` +
        `- Try running: docker volume prune (removes unused volumes)`
      )
    }

    // Disk space
    if (
      lowerStderr.includes('no space left') ||
      lowerStderr.includes('disk') ||
      lowerStderr.includes('storage')
    ) {
      return (
        `Insufficient disk space (exit code ${code})\n\n` +
        `Error: ${stderr}\n\n` +
        `How to fix:\n` +
        `- Free up disk space on your system\n` +
        `- Clean up Docker: docker system prune -a\n` +
        `- Check disk usage: df -h (Linux/macOS) or dir (Windows)`
      )
    }

    // Generic error with full stderr
    return (
      `Docker compose ${args[0]} failed (exit code ${code})\n\n` +
      `Error details:\n${stderr}\n\n` +
      `Troubleshooting:\n` +
      `- Check if Docker Desktop is running\n` +
      `- Try restarting Docker Desktop\n` +
      `- Check docker-compose.yml in project folder\n` +
      `- Run: docker compose logs (in project folder)`
    )
  }
}
