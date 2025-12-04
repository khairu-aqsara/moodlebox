import fetch from 'node-fetch'
import extract from 'extract-zip'
import { promises as fs } from 'fs'
import { join } from 'path'
import log from 'electron-log'

export class MoodleDownloader {
  /**
   * Download Moodle source code from URL and extract to destination
   */
  async download(
    url: string,
    destination: string,
    onProgress?: (percentage: number, downloaded: number, total: number) => void
  ): Promise<void> {
    // Create temp directory for download
    const tempDir = join(destination, '.tmp')
    await fs.mkdir(tempDir, { recursive: true })

    const archivePath = join(tempDir, 'moodle.zip')

    // Adaptive timeout: Only timeout if no data received for inactivity period
    // This allows slow connections to take as long as needed
    const INACTIVITY_TIMEOUT = 5 * 60 * 1000 // 5 minutes of no data = timeout
    const MAX_DOWNLOAD_TIME = 60 * 60 * 1000 // Absolute maximum: 60 minutes (safety net)
    
    let inactivityTimeout: NodeJS.Timeout | null = null
    let maxTimeTimeout: NodeJS.Timeout | null = null
    const startTime = Date.now()
    
    try {
      const controller = new AbortController()
      
      // Set absolute maximum timeout (safety net)
      maxTimeTimeout = setTimeout(() => {
        controller.abort()
        log.warn(`Download exceeded maximum time limit of ${MAX_DOWNLOAD_TIME / 60000} minutes`)
      }, MAX_DOWNLOAD_TIME)

      // Reset inactivity timeout function
      const resetInactivityTimeout = () => {
        if (inactivityTimeout) {
          clearTimeout(inactivityTimeout)
        }
        inactivityTimeout = setTimeout(() => {
          controller.abort()
          const elapsed = Math.round((Date.now() - startTime) / 1000 / 60)
          log.warn(`Download timeout: No data received for ${INACTIVITY_TIMEOUT / 60000} minutes (Total elapsed: ${elapsed} minutes)`)
        }, INACTIVITY_TIMEOUT)
      }

      // Start inactivity timer
      resetInactivityTimeout()

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'MoodleBox/1.0 (+https://github.com/yourrepo)'
          },
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(
            `Failed to download Moodle: ${response.status} ${response.statusText}\n\n` +
              `URL: ${url}\n\n` +
              `This could mean:\n` +
              `- Network connection issue\n` +
              `- GitHub rate limiting (try again in a few minutes)\n` +
              `- Invalid Moodle version URL\n\n` +
              `Please check your internet connection and try again.`
          )
        }

        const totalSize = parseInt(response.headers.get('content-length') || '0', 10)
        let downloadedSize = 0

        // Stream download to file with proper error handling
        const { createWriteStream } = await import('fs')
        const fileStream = createWriteStream(archivePath)

        try {
          if (response.body) {
            for await (const chunk of response.body) {
              // Check if stream was closed
              if (fileStream.destroyed) {
                throw new Error('File stream was closed unexpectedly')
              }
              
              // Reset inactivity timeout whenever we receive data
              // This allows slow but steady downloads to continue indefinitely
              resetInactivityTimeout()
              
              fileStream.write(chunk)
              downloadedSize += chunk.length

              if (onProgress && totalSize > 0) {
                const percentage = (downloadedSize / totalSize) * 100
                const elapsedMinutes = Math.round((Date.now() - startTime) / 1000 / 60)
                
                // Calculate download speed
                const speedMBps = elapsedMinutes > 0 
                  ? (downloadedSize / 1024 / 1024) / (elapsedMinutes / 60)
                  : 0
                
                // Estimate remaining time
                const remainingMB = (totalSize - downloadedSize) / 1024 / 1024
                const estimatedMinutes = speedMBps > 0 ? Math.round(remainingMB / speedMBps) : null
                
                onProgress(percentage, downloadedSize, totalSize)
                
                // Log progress every 10% or every minute for slow connections
                if (percentage % 10 < 1 || elapsedMinutes % 1 === 0) {
                  log.info(
                    `Download progress: ${percentage.toFixed(1)}% ` +
                    `(${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB) ` +
                    `- ${elapsedMinutes} min elapsed` +
                    (estimatedMinutes ? ` - ~${estimatedMinutes} min remaining` : '')
                  )
                }
              }
            }
          }

          // Properly close the stream
          fileStream.end()
          await new Promise<void>((resolve, reject) => {
            let streamTimeout: NodeJS.Timeout | null = null
            const cleanup = () => {
              if (streamTimeout) {
                clearTimeout(streamTimeout)
              }
            }

            fileStream.on('finish', () => {
              cleanup()
              resolve()
            })
            fileStream.on('error', (err) => {
              cleanup()
              reject(err)
            })

            // Set timeout for stream close (30 seconds)
            streamTimeout = setTimeout(() => {
              if (!fileStream.destroyed) {
                fileStream.destroy()
                cleanup()
                reject(new Error('File stream close timeout'))
              }
            }, 30000)
          })
        } catch (streamError) {
          // Clean up file stream on error
          if (!fileStream.destroyed) {
            fileStream.destroy()
          }
          // Clean up partial download
          try {
            await fs.unlink(archivePath)
          } catch {
            // Ignore cleanup errors
          }
          throw streamError
        }
        
        // Clear timeouts on successful completion
        if (inactivityTimeout) {
          clearTimeout(inactivityTimeout)
          inactivityTimeout = null
        }
        if (maxTimeTimeout) {
          clearTimeout(maxTimeTimeout)
          maxTimeTimeout = null
        }
      } finally {
        // Clean up timeouts
        if (inactivityTimeout) {
          clearTimeout(inactivityTimeout)
        }
        if (maxTimeTimeout) {
          clearTimeout(maxTimeTimeout)
        }
      }

      // Extract archive to temp location first
      const extractTempPath = join(tempDir, 'extracted')
      await fs.mkdir(extractTempPath, { recursive: true })

      await extract(archivePath, { dir: extractTempPath })

      // GitHub zips have a nested folder (e.g., moodle-master/)
      // We need to move contents up one level
      const extractedContents = await fs.readdir(extractTempPath)
      const finalPath = join(destination, 'moodlecode')

      if (extractedContents.length === 1) {
        // Single folder - likely the nested Moodle folder
        const nestedFolder = join(extractTempPath, extractedContents[0])
        const stat = await fs.stat(nestedFolder)

        if (stat.isDirectory()) {
          // Move nested folder contents to moodlecode/
          await fs.mkdir(finalPath, { recursive: true })

          // Move all files from nested folder to final destination
          const files = await fs.readdir(nestedFolder)
          for (const file of files) {
            await this.safeMove(join(nestedFolder, file), join(finalPath, file))
          }
        } else {
          // Not a folder, just move the temp extract to moodlecode
          await this.safeMove(extractTempPath, finalPath)
        }
      } else {
        // Multiple items at root - move temp extract to moodlecode
        await this.safeMove(extractTempPath, finalPath)
      }

      // Clean up temp directory
      await this.safeRemove(tempDir)
    } catch (error: any) {
      // Clean up on error
      await this.safeRemove(tempDir).catch(() => {})

      // Enhance error message
      if (error.name === 'AbortError') {
        const elapsedMinutes = Math.round((Date.now() - startTime) / 1000 / 60)
        throw new Error(
          `Download timed out after ${elapsedMinutes} minutes.\n\n` +
          `Possible causes:\n` +
          `- Slow or unstable internet connection\n` +
          `- Network interruption\n` +
          `- Server connection lost\n\n` +
          `The download will automatically retry if data stops flowing for more than 5 minutes.\n` +
          `For very slow connections, please ensure your internet is stable and try again.\n\n` +
          `Tip: Moodle downloads can be large (100-200MB+). On slow connections, this may take 20-30+ minutes.`
        )
      } else if (error.message?.includes('Failed to download')) {
        throw error
      } else {
        throw new Error(
          `Download or extraction failed: ${error.message}\n\n` +
            `Possible causes:\n` +
            `- Network interruption during download\n` +
            `- Insufficient disk space\n` +
            `- File permissions issue\n\n` +
            `Original error: ${error.message}`
        )
      }
    }
  }

  /**
   * Safely move a file or directory, handling cross-device links and Windows locking
   */
  private async safeMove(source: string, dest: string): Promise<void> {
    try {
      await fs.rename(source, dest)
    } catch (error: any) {
      if (error.code === 'EXDEV' || error.code === 'EPERM' || error.code === 'EBUSY') {
        // Cross-device move or locked file - copy and delete
        await fs.cp(source, dest, { recursive: true })
        await fs.rm(source, { recursive: true, force: true })
      } else {
        throw error
      }
    }
  }

  /**
   * Safely remove a directory with retries
   */
  private async safeRemove(path: string, retries = 3): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await fs.rm(path, { recursive: true, force: true })
        return
      } catch (error: any) {
        if (i === retries - 1) throw error
        // Wait a bit before retrying (Windows file locking)
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 100 * (i + 1))
        })
      }
    }
  }

  /**
   * Check if Moodle source code already exists
   */
  async isDownloaded(projectPath: string): Promise<boolean> {
    try {
      const moodleCodePath = join(projectPath, 'moodlecode')
      const configPath = join(moodleCodePath, 'config-dist.php')
      await fs.access(configPath)
      return true
    } catch {
      return false
    }
  }
}
