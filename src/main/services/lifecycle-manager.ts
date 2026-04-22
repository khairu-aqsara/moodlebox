import { Project, ProgressInfo, MoodleVersion } from '../types'
import { MoodleDownloader } from './moodle-downloader'
import { MoodleInstaller } from './moodle-installer'
import { DockerService } from './docker-service'
import fetch from 'node-fetch'
import log from 'electron-log'
import { getAssetPath } from '../utils/asset-path'
import { HTTP_WAIT } from '../constants'

/**
 * Query GitHub tags API and return the latest stable tag for a given major.minor version.
 * e.g. "5.2" → "v5.2.1" (or whatever the current latest patch is)
 *
 * Paginates up to 5 pages (500 tags) scanning for stable tags matching vMAJOR.MINOR.PATCH.
 * "Stable" means the suffix after the prefix is a pure integer (no rc/beta/alpha qualifiers).
 * Returns the tag name with the highest patch number found across all scanned pages.
 */
export async function resolveLatestTag(majorMinor: string): Promise<string> {
  const [major, minor] = majorMinor.split('.')
  const prefix = `v${major}.${minor}.`
  let bestTag: string | null = null
  let bestPatch = -1

  for (let page = 1; page <= 5; page++) {
    const controller = new AbortController()
    let timeoutId: NodeJS.Timeout | null = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch(
        `https://api.github.com/repos/moodle/moodle/tags?per_page=100&page=${page}`,
        {
          signal: controller.signal,
          headers: { 'User-Agent': 'MoodleBox/1.0' }
        } as Parameters<typeof fetch>[1]
      )

      clearTimeout(timeoutId)
      timeoutId = null

      if (!response.ok) {
        throw new Error(`GitHub API responded with ${response.status}`)
      }

      const tags = (await response.json()) as Array<{ name: string }>

      for (const tag of tags) {
        if (tag.name.startsWith(prefix)) {
          const suffix = tag.name.slice(prefix.length)
          // Only stable releases — suffix must be a plain integer (no rc/beta/alpha)
          if (/^\d+$/.test(suffix)) {
            const patch = parseInt(suffix, 10)
            if (patch > bestPatch) {
              bestPatch = patch
              bestTag = tag.name
            }
          }
        }
      }

      if (tags.length < 100) break // Last page
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId)
      throw err
    }
  }

  if (!bestTag) {
    throw new Error(`No stable release found for Moodle ${majorMinor} on GitHub`)
  }

  return bestTag
}

export class LifecycleManager {
  private downloader: MoodleDownloader
  private installer: MoodleInstaller
  private dockerService: DockerService

  constructor() {
    this.downloader = new MoodleDownloader()
    this.installer = new MoodleInstaller()
    this.dockerService = new DockerService()
  }

  /**
   * Start a project - handles both first run and subsequent runs
   */
  async startProject(
    project: Project,
    version: MoodleVersion,
    onStatusUpdate: (
      status: Project['status'],
      errorMessage?: string,
      statusDetail?: string,
      progress?: ProgressInfo
    ) => void,
    onLog?: (log: string) => void
  ): Promise<void> {
    const isFirstRun = !(await this.downloader.isDownloaded(project.path))
    try {
      if (isFirstRun) {
        await this.firstRunFlow(project, version, onStatusUpdate, onLog)
      } else {
        await this.subsequentRunFlow(project, version, onStatusUpdate, onLog)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      onStatusUpdate('error', errorMessage)
      onLog?.(`❌ Error: ${errorMessage}`)
      throw err // Re-throw so project-service can handle it
    }
  }

  /**
   * First run: Download, install, configure
   */
  private async firstRunFlow(
    project: Project,
    version: MoodleVersion,
    onStatusUpdate: (
      status: Project['status'],
      errorMessage?: string,
      statusDetail?: string,
      progress?: ProgressInfo
    ) => void,
    onLog?: (log: string) => void
  ): Promise<void> {
    // 1. Provisioning - Download Moodle (skip if already exists)
    const alreadyDownloaded = await this.downloader.isDownloaded(project.path)

    if (!alreadyDownloaded) {
      // Resolve latest stable tag from GitHub before downloading
      onStatusUpdate('provisioning', undefined, `Resolving latest Moodle ${version.version} release...`)
      onLog?.(`🔍 Resolving latest Moodle ${version.version} release from GitHub...`)
      const tag = await resolveLatestTag(version.version)
      const moodleDownloadUrl = `https://github.com/moodle/moodle/archive/refs/tags/${tag}.zip`
      onLog?.(`✓ Resolved: ${tag}`)

      onStatusUpdate('provisioning', undefined, 'Downloading Moodle source code...')
      onLog?.('📥 Downloading Moodle source code...')
      onLog?.(
        '💡 Tip: Large downloads may take 20-30+ minutes on slow connections. Progress will be shown below.'
      )

      await this.downloader.download(
        moodleDownloadUrl,
        project.path,
        (percentage, downloaded, total, speed) => {
          const downloadedMB = (downloaded / 1024 / 1024).toFixed(1)
          const totalMB = total > 0 ? (total / 1024 / 1024).toFixed(1) : '?'
          const percentageText = total > 0 ? `${percentage.toFixed(0)}%` : ''

          // Format: "Downloading: {speed} {downloaded}MB / {total}MB {percentage}%"
          // Or if total unknown: "Downloading: {speed} {downloaded}MB"
          let message = 'Downloading:'
          if (speed) {
            message += ` ${speed}`
          }
          message += ` ${downloadedMB}MB`
          if (total > 0) {
            message += ` / ${totalMB}MB`
          }
          if (percentageText) {
            message += ` ${percentageText}`
          }

          const progressInfo: ProgressInfo = {
            phase: 'download',
            percentage: total > 0 ? percentage : undefined, // undefined indicates indeterminate
            current: downloaded,
            total: total > 0 ? total : undefined,
            message
          }
          onStatusUpdate('provisioning', undefined, progressInfo.message, progressInfo)
          // Only log every 10% to avoid spam, but always update UI
          if (total > 0 && (percentage % 10 < 1 || percentage >= 100)) {
            onLog?.(`📥 ${progressInfo.message}`)
          } else if (total === 0) {
            // Log periodically when total is unknown (every 5MB)
            const downloadedMBNum = downloaded / 1024 / 1024
            if (downloadedMBNum % 5 < 0.1) {
              onLog?.(`📥 ${progressInfo.message}`)
            }
          }
        }
      )

      // Clear progress after download completes (or set to 100% if we had a known total)
      // This ensures the progress bar doesn't stay stuck at 50%
      onStatusUpdate('provisioning', undefined, 'Download complete', {
        phase: 'download',
        percentage: 100,
        message: 'Download complete'
      })

      onLog?.('✓ Moodle source downloaded successfully')
    } else {
      onLog?.('✓ Moodle source already exists, skipping download')
    }

    // 2. Start containers and check installation status
    await this.startAndInstall(project, version, onStatusUpdate, onLog)
  }

  /**
   * Subsequent run: Start and check installation
   */
  private async subsequentRunFlow(
    project: Project,
    version: MoodleVersion,
    onStatusUpdate: (
      status: Project['status'],
      errorMessage?: string,
      statusDetail?: string,
      progress?: ProgressInfo
    ) => void,
    onLog?: (log: string) => void
  ): Promise<void> {
    // Start containers and check installation status
    await this.startAndInstall(project, version, onStatusUpdate, onLog)
  }

  /**
   * Common flow: Start containers, check if Moodle is installed, install if needed
   */
  private async startAndInstall(
    project: Project,
    version: MoodleVersion,
    onStatusUpdate: (
      status: Project['status'],
      errorMessage?: string,
      statusDetail?: string,
      progress?: ProgressInfo
    ) => void,
    onLog?: (log: string) => void
  ): Promise<void> {
    // 1. Starting - Launch containers
    onStatusUpdate('starting', undefined, 'Starting Docker containers...')
    onLog?.('🐳 Starting Docker containers...')

    await this.dockerService.composeUp({
      cwd: project.path,
      onStdout: onLog,
      onStderr: onLog
    })

    // 2. Waiting - Wait for database
    onStatusUpdate('waiting', undefined, 'Waiting for database to be ready...')
    onLog?.('⏳ Waiting for database to be ready...')

    await this.dockerService.waitForHealthy('db', project.path)
    onLog?.('✓ Database is ready')

    // 3. Check if Moodle is installed (inside running container)
    onStatusUpdate('waiting', undefined, 'Checking Moodle installation status...')
    onLog?.('🔍 Checking Moodle installation status...')

    const alreadyInstalled = await this.installer.isInstalled(project.path)

    if (!alreadyInstalled) {
      // 4. Installing - Create config and run Moodle CLI install
      onStatusUpdate(
        'installing',
        undefined,
        'Installing Moodle (It may take some time, depending on your computer and internet.)...'
      )
      onLog?.(
        '⚙️  Installing Moodle (It may take some time, depending on your computer and internet.)...'
      )
      onLog?.('📝 Creating config.php...')

      await this.installer.install(project.path, project.name, project.port, version, onLog)
      onLog?.('✓ Moodle installed successfully')

      // 5. Restore sample course
      onStatusUpdate('installing', undefined, 'Restoring sample course...')
      onLog?.('📚 Restoring sample course...')
      try {
        const courseBackupPath = getAssetPath('courses.mbz')

        log.info(`Loading course backup from: ${courseBackupPath}`)

        await this.installer.restoreCourse(project.path, courseBackupPath)
        onLog?.('✓ Sample course restored')
      } catch (err) {
        onLog?.(`⚠️  Warning: Could not restore sample course: ${err}`)
      }
    } else {
      onLog?.('✓ Moodle already installed, skipping installation')
    }

    // 7. Ready - Wait for HTTP
    onStatusUpdate('starting', undefined, 'Waiting for Moodle web server...')
    onLog?.('⏳ Waiting for Moodle web server...')
    await this.waitForHttp(project.port, onLog)

    onStatusUpdate('ready', undefined, `Ready at http://localhost:${project.port}`)
    onLog?.(`✅ Moodle is ready at http://localhost:${project.port}`)
    onLog?.(`👤 Login with: admin / admin`)
  }

  /**
   * Stop a project
   */
  async stopProject(project: Project, onLog?: (log: string) => void): Promise<void> {
    onLog?.('Stopping containers...')

    await this.dockerService.composeStop({
      cwd: project.path,
      onStdout: onLog,
      onStderr: onLog
    })

    onLog?.('✓ Containers stopped')
  }

  /**
   * Wait for HTTP endpoint to respond
   */
  private async waitForHttp(
    port: number,
    onLog?: (log: string) => void,
    timeoutMs = 60000
  ): Promise<void> {
    const startTime = Date.now()
    const url = `http://localhost:${port}`
    let attempts = 0
    let timeoutId: NodeJS.Timeout | null = null

    try {
      while (Date.now() - startTime < timeoutMs) {
        attempts++
        try {
          // Use AbortController for proper timeout handling
          const controller = new AbortController()
          timeoutId = setTimeout(() => controller.abort(), 2000)

          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'MoodleBox/1.0'
            }
          } as RequestInit)

          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }

          onLog?.(`  Attempt ${attempts}: Got HTTP ${response.status}`)

          if (response.ok || response.status === 303) {
            // 303 is Moodle's redirect, which means it's up
            return
          }
        } catch (err: unknown) {
          if (timeoutId) {
            clearTimeout(timeoutId)
            timeoutId = null
          }

          const error = err as Error & { code?: string }
          if (error.name === 'AbortError') {
            onLog?.(`  Attempt ${attempts}: Timeout`)
          } else {
            onLog?.(
              `  Attempt ${attempts}: ${error?.code || error?.message || 'Connection failed'}`
            )
          }
        }

        // Wait before next check
        await new Promise((resolve) => setTimeout(resolve, HTTP_WAIT.RETRY_INTERVAL_MS))
      }

      throw new Error(`Timeout waiting for Moodle to respond at ${url} after ${attempts} attempts`)
    } finally {
      // Clean up any pending timeout
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }
}
