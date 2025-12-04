import fetch from 'node-fetch'
import extract from 'extract-zip'
import { promises as fs } from 'fs'
import { join } from 'path'
import log from 'electron-log'

interface DownloadState {
  url: string
  downloadedBytes: number
  totalSize: number
  timestamp: number
}

export class MoodleDownloader {
  private readonly BUFFER_SIZE = 1024 * 1024 // 1MB buffer for Windows optimization
  private readonly STATE_SAVE_INTERVAL = 5 * 1024 * 1024 // Save state every 5MB
  private readonly isWindows = process.platform === 'win32'

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

    const partialPath = join(tempDir, 'moodle.zip.partial')
    const statePath = join(tempDir, 'download-state.json')
    const archivePath = join(tempDir, 'moodle.zip')

    // Check for existing partial download and resume if possible
    let startByte = 0
    let totalSize = 0
    let existingState: DownloadState | null = null

    try {
      const stateExists = await fs.access(statePath).then(() => true).catch(() => false)
      const partialExists = await fs.access(partialPath).then(() => true).catch(() => false)

      if (stateExists && partialExists) {
        try {
          const parsedState = JSON.parse(await fs.readFile(statePath, 'utf-8')) as DownloadState
          // Verify URL matches (in case user changed version)
          if (parsedState.url === url) {
            const stat = await fs.stat(partialPath)
            if (stat.size === parsedState.downloadedBytes && parsedState.downloadedBytes > 0) {
              existingState = parsedState
              startByte = parsedState.downloadedBytes
              totalSize = parsedState.totalSize
              log.info(`Resuming download from byte ${startByte} (${(startByte / 1024 / 1024).toFixed(1)}MB)`)
            } else {
              log.warn('Partial file size mismatch, starting fresh download')
              await this.cleanupPartialDownload(partialPath, statePath)
            }
          } else {
            log.info('URL changed, starting fresh download')
            await this.cleanupPartialDownload(partialPath, statePath)
          }
        } catch (error) {
          log.warn('Failed to read download state, starting fresh:', error)
          await this.cleanupPartialDownload(partialPath, statePath)
        }
      }
    } catch (error) {
      // Ignore errors during state check
    }

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

      // Save download state periodically
      const saveDownloadState = async (downloaded: number, total: number) => {
        try {
          const state: DownloadState = {
            url,
            downloadedBytes: downloaded + startByte,
            totalSize: total,
            timestamp: Date.now()
          }
          await fs.writeFile(statePath, JSON.stringify(state), 'utf-8')
        } catch (error) {
          log.warn('Failed to save download state:', error)
        }
      }

      try {
        // Build headers with compression and resume support
        const headers: Record<string, string> = {
          'User-Agent': 'MoodleBox/1.0 (+https://github.com/yourrepo)',
          'Accept-Encoding': 'gzip, deflate, br'
        }

        // Add Range header if resuming
        if (startByte > 0) {
          headers['Range'] = `bytes=${startByte}-`
          log.info(`Requesting download resume from byte ${startByte}`)
        }

        const response = await fetch(url, {
          headers,
          signal: controller.signal
        })

        // Handle different response statuses
        if (response.status === 206 && startByte > 0) {
          // Partial Content - resume successful
          log.info('Server supports resume, continuing download')
        } else if (response.status === 416 && startByte > 0) {
          // Range Not Satisfiable - file may have changed, restart
          log.warn('Server returned 416 (Range Not Satisfiable), restarting download')
          await this.cleanupPartialDownload(partialPath, statePath)
          startByte = 0
          // Retry without Range header
          const retryResponse = await fetch(url, {
            headers: {
              'User-Agent': 'MoodleBox/1.0 (+https://github.com/yourrepo)',
              'Accept-Encoding': 'gzip, deflate, br'
            },
            signal: controller.signal
          })
          if (!retryResponse.ok) {
            throw new Error(
              `Failed to download Moodle: ${retryResponse.status} ${retryResponse.statusText}\n\n` +
                `URL: ${url}\n\n` +
                `This could mean:\n` +
                `- Network connection issue\n` +
                `- GitHub rate limiting (try again in a few minutes)\n` +
                `- Invalid Moodle version URL\n\n` +
                `Please check your internet connection and try again.`
            )
          }
          // Use retry response
          const contentLength = retryResponse.headers.get('content-length')
          totalSize = parseInt(contentLength || '0', 10)
          const { createWriteStream } = await import('fs')
          const retryFileStream = createWriteStream(partialPath, { flags: 'w' })
          
          try {
            // Download with buffering
            await this.downloadWithBuffer(
              retryResponse,
              retryFileStream,
              startByte,
              totalSize,
              onProgress,
              resetInactivityTimeout,
              saveDownloadState
            )
            
            // Properly close the stream
            retryFileStream.end()
            await new Promise<void>((resolve, reject) => {
              let streamTimeout: NodeJS.Timeout | null = null
              const cleanup = () => {
                if (streamTimeout) {
                  clearTimeout(streamTimeout)
                }
              }

              retryFileStream.on('finish', () => {
                cleanup()
                resolve()
              })
              retryFileStream.on('error', (err) => {
                cleanup()
                reject(err)
              })

              streamTimeout = setTimeout(() => {
                if (!retryFileStream.destroyed) {
                  retryFileStream.destroy()
                  cleanup()
                  reject(new Error('File stream close timeout'))
                }
              }, 30000)
            })
            
            // Rename partial to final
            await fs.rename(partialPath, archivePath)
            await this.cleanupPartialDownload(partialPath, statePath)
            return
          } catch (retryError) {
            // Clean up file stream on error
            if (!retryFileStream.destroyed) {
              retryFileStream.destroy()
            }
            throw retryError
          }
        } else if (!response.ok) {
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

        // Get total size from response
        const contentLength = response.headers.get('content-length')
        const contentRange = response.headers.get('content-range')
        
        if (contentRange && startByte > 0) {
          // Parse Content-Range: bytes START-END/TOTAL
          const match = contentRange.match(/bytes \d+-\d+\/(\d+)/)
          if (match) {
            totalSize = parseInt(match[1], 10)
          }
        } else {
          totalSize = parseInt(contentLength || '0', 10)
        }

        // If resuming and we don't have total size, use existing state
        if (totalSize === 0 && existingState) {
          totalSize = existingState.totalSize
        }

        // Stream download to file with proper error handling
        // Use append mode if resuming, write mode if starting fresh
        const { createWriteStream } = await import('fs')
        const fileStream = createWriteStream(partialPath, { 
          flags: startByte > 0 ? 'a' : 'w' 
        })

        try {
          // Download with buffering for better Windows performance
          await this.downloadWithBuffer(
            response,
            fileStream,
            startByte,
            totalSize,
            onProgress,
            resetInactivityTimeout,
            saveDownloadState
          )

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

          // Rename partial to final archive
          await fs.rename(partialPath, archivePath)
          
          // Clean up state file on successful completion
          await this.cleanupPartialDownload(partialPath, statePath)
        } catch (streamError) {
          // Save state before throwing error for resumability
          try {
            const currentSize = await fs.stat(partialPath).then(s => s.size).catch(() => 0)
            if (currentSize > 0) {
              await saveDownloadState(currentSize - startByte, totalSize)
              log.info(`Download state saved at ${currentSize} bytes for resume`)
            }
          } catch {
            // Ignore state save errors
          }

          // Clean up file stream on error
          if (!fileStream.destroyed) {
            fileStream.destroy()
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

      // Extract with progress reporting
      log.info('Extracting Moodle archive...')
      const extractStartTime = Date.now()
      await extract(archivePath, { dir: extractTempPath })
      const extractDuration = Math.round((Date.now() - extractStartTime) / 1000)
      log.info(`Extraction completed in ${extractDuration} seconds`)

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
      // Don't clean up temp dir on error - preserve partial download for resume
      // Only clean up if it's a non-resumable error

      // Enhance error message
      if (error.name === 'AbortError') {
        const elapsedMinutes = Math.round((Date.now() - startTime) / 1000 / 60)
        const errorMsg = `Download timed out after ${elapsedMinutes} minutes.\n\n` +
          `Possible causes:\n` +
          `- Slow or unstable internet connection\n` +
          `- Network interruption\n` +
          `- Server connection lost\n\n` +
          `The download can be resumed automatically on retry.\n` +
          `For very slow connections, please ensure your internet is stable and try again.\n\n` +
          `Tip: Moodle downloads can be large (100-200MB+). On slow connections, this may take 20-30+ minutes.`
        throw new Error(errorMsg)
      } else if (error.message?.includes('Failed to download')) {
        throw error
      } else {
        throw new Error(
          `Download or extraction failed: ${error.message}\n\n` +
            `Possible causes:\n` +
            `- Network interruption during download\n` +
            `- Insufficient disk space\n` +
            `- File permissions issue\n\n` +
            `The download can be resumed automatically on retry.\n\n` +
            `Original error: ${error.message}`
        )
      }
    }
  }

  /**
   * Download with buffered writes for better Windows performance
   */
  private async downloadWithBuffer(
    response: any,
    fileStream: NodeJS.WritableStream & { destroyed?: boolean },
    startByte: number,
    totalSize: number,
    onProgress?: (percentage: number, downloaded: number, total: number) => void,
    resetInactivityTimeout?: () => void,
    saveDownloadState?: (downloaded: number, total: number) => Promise<void>
  ): Promise<void> {
    const startTime = Date.now()
    let downloadedSize = 0
    let writeBuffer = Buffer.alloc(0)
    let lastStateSave = 0 // Track last saved position for state persistence

    const flushBuffer = async (force = false) => {
      if (writeBuffer.length >= this.BUFFER_SIZE || (force && writeBuffer.length > 0)) {
        if (fileStream.destroyed) {
          throw new Error('File stream was closed unexpectedly')
        }
        
        return new Promise<void>((resolve, reject) => {
          fileStream.write(writeBuffer, (err) => {
            if (err) {
              reject(err)
            } else {
              writeBuffer = Buffer.alloc(0)
              resolve()
            }
          })
        })
      }
    }

    if (response.body) {
      for await (const chunk of response.body) {
        // Check if stream was closed
        if (fileStream.destroyed) {
          throw new Error('File stream was closed unexpectedly')
        }
        
        // Reset inactivity timeout whenever we receive data
        if (resetInactivityTimeout) {
          resetInactivityTimeout()
        }
        
        // Add chunk to buffer
        writeBuffer = Buffer.concat([writeBuffer, chunk])
        downloadedSize += chunk.length

        // Flush buffer when it reaches threshold
        await flushBuffer()

        // Save state periodically
        if (saveDownloadState && downloadedSize - lastStateSave >= this.STATE_SAVE_INTERVAL) {
          await saveDownloadState(downloadedSize, totalSize)
          lastStateSave = downloadedSize
        }

        if (onProgress && totalSize > 0) {
          const totalDownloaded = downloadedSize + startByte
          const percentage = (totalDownloaded / totalSize) * 100
          const elapsedMinutes = Math.round((Date.now() - startTime) / 1000 / 60)
          
          // Calculate download speed
          const speedMBps = elapsedMinutes > 0 
            ? (downloadedSize / 1024 / 1024) / (elapsedMinutes / 60)
            : 0
          
          // Estimate remaining time
          const remainingMB = (totalSize - totalDownloaded) / 1024 / 1024
          const estimatedMinutes = speedMBps > 0 ? Math.round(remainingMB / speedMBps) : null
          
          onProgress(percentage, totalDownloaded, totalSize)
          
          // Log progress every 10% or every minute for slow connections
          if (percentage % 10 < 1 || elapsedMinutes % 1 === 0) {
            const status = startByte > 0 ? ' (resumed)' : ''
            log.info(
              `Download progress: ${percentage.toFixed(1)}%${status} ` +
              `(${(totalDownloaded / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB) ` +
              `- ${elapsedMinutes} min elapsed` +
              (estimatedMinutes ? ` - ~${estimatedMinutes} min remaining` : '')
            )
          }
        }
      }

      // Flush any remaining buffer
      await flushBuffer(true)
    }
  }

  /**
   * Clean up partial download files
   */
  private async cleanupPartialDownload(partialPath: string, statePath: string): Promise<void> {
    try {
      await fs.unlink(partialPath).catch(() => {})
      await fs.unlink(statePath).catch(() => {})
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Safely move a file or directory, handling cross-device links and Windows locking
   * Enhanced with retry logic and exponential backoff for Windows
   */
  private async safeMove(source: string, dest: string, retries = 3): Promise<void> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await fs.rename(source, dest)
        return
      } catch (error: any) {
        if (error.code === 'EXDEV' || error.code === 'EPERM' || error.code === 'EBUSY') {
          // Cross-device move or locked file - copy and delete
          // On Windows, wait with exponential backoff before retrying
          if (this.isWindows && attempt < retries - 1) {
            const backoffMs = Math.min(100 * Math.pow(2, attempt), 1000)
            log.debug(`File locked, retrying move in ${backoffMs}ms (attempt ${attempt + 1}/${retries})`)
            await new Promise(resolve => setTimeout(resolve, backoffMs))
            continue
          }
          
          // Last attempt or non-Windows: use copy+delete fallback
          log.debug(`Using copy+delete fallback for move operation`)
          await fs.cp(source, dest, { recursive: true })
          await fs.rm(source, { recursive: true, force: true })
          return
        } else if (this.isWindows && (error.code === 'ENOENT' || error.code === 'EACCES') && attempt < retries - 1) {
          // Windows-specific: file may be temporarily locked by antivirus
          const backoffMs = Math.min(200 * Math.pow(2, attempt), 2000)
          log.debug(`File access error, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${retries})`)
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          continue
        } else {
          throw error
        }
      }
    }
  }

  /**
   * Safely remove a directory with retries and exponential backoff
   * Enhanced for Windows file locking issues
   */
  private async safeRemove(path: string, retries = 5): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await fs.rm(path, { recursive: true, force: true })
        return
      } catch (error: any) {
        if (i === retries - 1) {
          // Last attempt failed, log but don't throw for Windows
          if (this.isWindows) {
            log.warn(`Failed to remove directory after ${retries} attempts: ${path}`, error)
            return // Don't throw on Windows - file may be locked by antivirus
          }
          throw error
        }
        // Exponential backoff with longer delays on Windows
        const baseDelay = this.isWindows ? 200 : 100
        const backoffMs = baseDelay * Math.pow(2, i)
        log.debug(`Retrying directory removal in ${backoffMs}ms (attempt ${i + 1}/${retries})`)
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), backoffMs)
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
