import fetch, { Response } from 'node-fetch'
import extract from 'extract-zip'
import { promises as fs } from 'fs'
import { join, resolve } from 'path'
import log from 'electron-log'
import { DOWNLOAD, FILE_OPS } from '../constants'

interface DownloadState {
  url: string
  downloadedBytes: number
  totalSize: number
  timestamp: number
}

export class MoodleDownloader {
  private readonly BUFFER_SIZE = DOWNLOAD.BUFFER_SIZE
  private readonly STATE_SAVE_INTERVAL = DOWNLOAD.STATE_SAVE_INTERVAL
  private readonly isWindows = process.platform === 'win32'
  private readonly MAX_RETRIES = DOWNLOAD.MAX_RETRIES
  private readonly INITIAL_RETRY_DELAY = DOWNLOAD.INITIAL_RETRY_DELAY_MS
  private readonly PROGRESS_THROTTLE_MS = DOWNLOAD.PROGRESS_THROTTLE_MS

  /**
   * Get file size using Range request (bytes=0-0)
   * This method requests only the first byte and parses Content-Range header
   * to get the total file size.
   *
   * @param url - URL to check
   * @param signal - AbortSignal for cancellation
   * @returns Total file size in bytes, or null if unavailable
   */
  private async getFileSizeFromRangeRequest(
    url: string,
    signal: AbortSignal
  ): Promise<number | null> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'MoodleBox/1.0 (+https://github.com/yourrepo)',
          Range: 'bytes=0-0' // Request only first byte
        },
        signal
      })

      if (response.status === 206) {
        // Partial Content - Range request successful
        const contentRange = response.headers.get('content-range')
        if (contentRange) {
          // Parse Content-Range: bytes 0-0/TOTAL
          const match = contentRange.match(/bytes \d+-\d+\/(\d+)/)
          if (match && match[1]) {
            const totalSize = parseInt(match[1], 10)
            if (totalSize > 0) {
              // Consume the response body (we only requested 1 byte) to avoid warnings
              if (response.body) {
                response.body.destroy()
              }
              return totalSize
            }
          }
        }
        // Consume response body even if parsing failed
        if (response.body) {
          response.body.destroy()
        }
      } else if (response.status === 200) {
        // Server doesn't support Range requests, but might have Content-Length
        const contentLength = response.headers.get('content-length')
        if (contentLength) {
          const parsedSize = parseInt(contentLength, 10)
          if (parsedSize > 0) {
            // Consume the response body to avoid warnings
            if (response.body) {
              response.body.destroy()
            }
            return parsedSize
          }
        }
        // Consume response body even if no Content-Length
        if (response.body) {
          response.body.destroy()
        }
      }
    } catch (error) {
      // Range request failed - return null to indicate failure
      log.debug('Range request failed:', error)
      return null
    }

    return null
  }

  /**
   * Check if an error is transient and retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!error) return false

    // Network errors that are typically transient
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'EAI_AGAIN',
      'NetworkError',
      'Failed to fetch',
      'fetch failed'
    ]

    const errAny = error as any
    const errorMessage = (errAny.message || String(error)).toLowerCase()
    const errorCode = errAny.code || ''

    return (
      retryableErrors.some(
        (err) => errorMessage.includes(err.toLowerCase()) || errorCode.includes(err)
      ) ||
      errAny.name === 'AbortError' ||
      (errAny.status && errAny.status >= 500) // Server errors
    )
  }

  /**
   * Retry a function with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    operation: string,
    maxRetries: number = this.MAX_RETRIES
  ): Promise<T> {
    let lastError: unknown
    let delay = this.INITIAL_RETRY_DELAY

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error: unknown) {
        lastError = error

        // Don't retry if it's not a retryable error or if we've exhausted retries
        if (!this.isRetryableError(error) || attempt === maxRetries) {
          throw error
        }

        // Calculate exponential backoff delay: 1s, 2s, 4s, etc.
        delay = this.INITIAL_RETRY_DELAY * Math.pow(2, attempt)
        log.warn(
          `${operation} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`,
          (error as any).message || String(error)
        )

        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  /**
   * Download Moodle source code from URL and extract to destination
   *
   * Downloads Moodle source code with the following features:
   * - **Resume support**: Automatically resumes interrupted downloads
   * - **Progress tracking**: Reports download progress via callback
   * - **Retry logic**: Exponential backoff retry for transient network errors
   * - **Adaptive timeouts**: Only times out on inactivity, not slow connections
   * - **Windows optimization**: Buffered writes for better Windows performance
   *
   * **Download state is preserved** in `.tmp/download-state.json` for resume capability.
   *
   * @param url - URL to download Moodle from (typically GitHub release)
   * @param destination - Directory where Moodle will be extracted
   * @param onProgress - Optional callback for progress updates (percentage, downloaded bytes, total bytes, speed text)
   * @throws {Error} If download fails, times out, or extraction fails
   *
   * @example
   * ```typescript
   * await downloader.download(
   *   'https://github.com/moodle/moodle/archive/v5.1.zip',
   *   '/path/to/project',
   *   (percentage, downloaded, total) => {
   *     console.log(`Downloaded: ${percentage}%`)
   *   }
   * )
   * ```
   */
  async download(
    url: string,
    destination: string,
    onProgress?: (percentage: number, downloaded: number, total: number, speed?: string) => void
  ): Promise<void> {
    // Ensure destination is an absolute path (required by extract-zip)
    const absoluteDestination = resolve(destination)

    // Create temp directory for download
    const tempDir = join(absoluteDestination, '.tmp')
    await fs.mkdir(tempDir, { recursive: true })

    const partialPath = join(tempDir, 'moodle.zip.partial')
    const statePath = join(tempDir, 'download-state.json')
    const archivePath = join(tempDir, 'moodle.zip')

    // Check for existing partial download and resume if possible
    let startByte = 0
    let totalSize = 0
    let existingState: DownloadState | null = null

    try {
      const stateExists = await fs
        .access(statePath)
        .then(() => true)
        .catch(() => false)
      const partialExists = await fs
        .access(partialPath)
        .then(() => true)
        .catch(() => false)

      if (stateExists && partialExists) {
        try {
          const parsedState = JSON.parse(await fs.readFile(statePath, 'utf-8')) as DownloadState
          // Verify URL matches (in case user changed version)
          if (parsedState.url === url) {
            const stat = await fs.stat(partialPath)
            // Allow small size differences (up to 1MB) due to buffering/flushing
            const sizeDiff = Math.abs(stat.size - parsedState.downloadedBytes)
            const allowedDiff = 1024 * 1024 // 1MB tolerance

            if (sizeDiff <= allowedDiff && parsedState.downloadedBytes > 0) {
              existingState = parsedState
              // Use actual file size as source of truth (may be slightly ahead due to buffering)
              startByte = stat.size
              totalSize = parsedState.totalSize
              log.info(
                `Resuming download from byte ${startByte} (${(startByte / 1024 / 1024).toFixed(1)}MB)`
              )
            } else {
              log.warn(
                `Partial file size mismatch (file: ${stat.size}, state: ${parsedState.downloadedBytes}), starting fresh download`
              )
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
    } catch {
      // Ignore errors during state check
    }

    // Adaptive timeout: Only timeout if no data received for inactivity period
    // This allows slow connections to take as long as needed
    const INACTIVITY_TIMEOUT = DOWNLOAD.INACTIVITY_TIMEOUT_MS
    const MAX_DOWNLOAD_TIME = DOWNLOAD.MAX_DOWNLOAD_TIME_MS

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
      const resetInactivityTimeout = (): void => {
        if (inactivityTimeout) {
          clearTimeout(inactivityTimeout)
        }
        inactivityTimeout = setTimeout(() => {
          controller.abort()
          const elapsed = Math.round((Date.now() - startTime) / 1000 / 60)
          log.warn(
            `Download timeout: No data received for ${INACTIVITY_TIMEOUT / 60000} minutes (Total elapsed: ${elapsed} minutes)`
          )
        }, INACTIVITY_TIMEOUT)
      }

      // Start inactivity timer
      resetInactivityTimeout()

      // Save download state periodically
      const saveDownloadState = async (downloaded: number, total: number): Promise<void> => {
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

      // Save initial state immediately (even at 0 bytes) to track download attempts
      // This ensures we can resume even if download fails very early
      if (startByte === 0) {
        await saveDownloadState(0, 0)
      }

      try {
        // Try to get file size via multiple methods (only on fresh downloads)
        // This helps us get accurate Content-Length before compression
        if (startByte === 0 && totalSize === 0) {
          // Method 1: Try HEAD request with explicit no-compression
          try {
            const headResponse = await fetch(url, {
              method: 'HEAD',
              headers: {
                'User-Agent': 'MoodleBox/1.0 (+https://github.com/yourrepo)',
                'Accept-Encoding': 'identity' // Explicitly request no compression
              },
              signal: controller.signal
            })

            if (headResponse.ok) {
              const headContentLength = headResponse.headers.get('content-length')
              if (headContentLength) {
                const parsedSize = parseInt(headContentLength, 10)
                if (parsedSize > 0) {
                  totalSize = parsedSize
                  log.info(
                    `File size detected via HEAD request: ${(totalSize / 1024 / 1024).toFixed(1)}MB`
                  )
                  // Save the total size we discovered
                  await saveDownloadState(0, totalSize)
                }
              }
            }
          } catch (headError) {
            // HEAD request failed - try Range request fallback
            log.debug('HEAD request failed, trying Range request fallback:', headError)
          }

          // Method 2: Try Range request if HEAD didn't work
          if (totalSize === 0) {
            try {
              const rangeSize = await this.getFileSizeFromRangeRequest(url, controller.signal)
              if (rangeSize && rangeSize > 0) {
                totalSize = rangeSize
                log.info(
                  `File size detected via Range request: ${(totalSize / 1024 / 1024).toFixed(1)}MB`
                )
                // Save the total size we discovered
                await saveDownloadState(0, totalSize)
              }
            } catch (rangeError) {
              // Range request also failed - will proceed with indeterminate progress
              log.debug('Range request failed, will show indeterminate progress:', rangeError)
            }
          }
        }

        // Wrap fetch in retry logic for transient network errors
        const response = await this.retryWithBackoff(async () => {
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

          const fetchResponse = await fetch(url, {
            headers,
            signal: controller.signal
          })

          // Check for server errors that might be transient
          if (!fetchResponse.ok && fetchResponse.status >= 500) {
            throw new Error(`Server error: ${fetchResponse.status} ${fetchResponse.statusText}`)
          }

          return fetchResponse
        }, 'Download fetch')

        // Handle different response statuses
        if (response.status === 206 && startByte > 0) {
          // Partial Content - resume successful
          log.info('Server supports resume, continuing download')
        } else if (response.status === 416 && startByte > 0) {
          // Range Not Satisfiable - file may have changed, restart
          log.warn('Server returned 416 (Range Not Satisfiable), restarting download')
          await this.cleanupPartialDownload(partialPath, statePath)
          startByte = 0
          // Retry without Range header (with exponential backoff)
          const retryResponse = await this.retryWithBackoff(async () => {
            const retryFetchResponse = await fetch(url, {
              headers: {
                'User-Agent': 'MoodleBox/1.0 (+https://github.com/yourrepo)',
                'Accept-Encoding': 'gzip, deflate, br'
              },
              signal: controller.signal
            })

            if (!retryFetchResponse.ok && retryFetchResponse.status >= 500) {
              throw new Error(
                `Server error: ${retryFetchResponse.status} ${retryFetchResponse.statusText}`
              )
            }

            return retryFetchResponse
          }, 'Download retry after 416')
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
              const cleanup = (): void => {
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
        // Note: When using compression (gzip/deflate), Content-Length may be missing or represent compressed size
        // We try to get the actual size via HEAD request first (above), but fall back to response headers here
        const contentLength = response.headers.get('content-length')
        const contentRange = response.headers.get('content-range')

        if (contentRange && startByte > 0) {
          // Parse Content-Range: bytes START-END/TOTAL
          // This is the most reliable way to get total size when resuming
          const match = contentRange.match(/bytes \d+-\d+\/(\d+)/)
          if (match) {
            const rangeTotalSize = parseInt(match[1], 10)
            if (rangeTotalSize > 0) {
              totalSize = rangeTotalSize
              log.info(
                `File size detected via Content-Range header: ${(totalSize / 1024 / 1024).toFixed(1)}MB`
              )
            }
          }
        } else if (contentLength && totalSize === 0) {
          // Only use Content-Length if we don't already have totalSize from HEAD request
          // Note: This may be compressed size if server sent compressed content
          const parsedSize = parseInt(contentLength, 10)
          if (parsedSize > 0) {
            totalSize = parsedSize
            log.info(
              `File size detected via Content-Length header: ${(totalSize / 1024 / 1024).toFixed(1)}MB`
            )
            // If this seems unusually small (likely compressed), log a warning
            // Typical Moodle zip files are 50-200MB uncompressed
            if (totalSize < 10 * 1024 * 1024) {
              // Less than 10MB seems suspicious
              log.warn(
                'Content-Length seems unusually small - may be compressed size. Progress may be inaccurate.'
              )
            }
          }
        }

        // If resuming and we don't have total size, use existing state
        if (totalSize === 0 && existingState && existingState.totalSize > 0) {
          totalSize = existingState.totalSize
          log.info(
            `Using total size from previous download state: ${(totalSize / 1024 / 1024).toFixed(1)}MB`
          )
        }

        // Log if we still don't have total size
        if (totalSize === 0) {
          log.info(
            'Total file size unknown - will show indeterminate progress. This is normal for compressed downloads.'
          )
        }

        // Update state with total size once we know it (if we didn't have it before)
        if (totalSize > 0 && (startByte === 0 || !existingState || existingState.totalSize === 0)) {
          await saveDownloadState(0, totalSize)
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
            const cleanup = (): void => {
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
            const currentSize = await fs
              .stat(partialPath)
              .then((s) => s.size)
              .catch(() => 0)
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
      // Ensure extract path is absolute (required by extract-zip)
      const extractTempPath = resolve(join(tempDir, 'extracted'))
      await fs.mkdir(extractTempPath, { recursive: true })

      // Extract with progress reporting
      log.info('Extracting Moodle archive...')
      log.debug(`Extracting to absolute path: ${extractTempPath}`)
      const extractStartTime = Date.now()
      await extract(archivePath, { dir: extractTempPath })
      const extractDuration = Math.round((Date.now() - extractStartTime) / 1000)
      log.info(`Extraction completed in ${extractDuration} seconds`)

      // GitHub zips have a nested folder (e.g., moodle-master/)
      // We need to move contents up one level
      const extractedContents = await fs.readdir(extractTempPath)
      const finalPath = join(absoluteDestination, 'moodlecode')

      log.info(`Moving Moodle files to final destination: ${finalPath}`)

      if (extractedContents.length === 1) {
        // Single folder - likely the nested Moodle folder
        const nestedFolder = join(extractTempPath, extractedContents[0])
        const stat = await fs.stat(nestedFolder)

        if (stat.isDirectory()) {
          log.debug(`Found nested folder: ${extractedContents[0]}`)
          // Move nested folder contents to moodlecode/
          await fs.mkdir(finalPath, { recursive: true })

          // Move all files from nested folder to final destination
          const files = await fs.readdir(nestedFolder)
          log.debug(`Moving ${files.length} items from nested folder`)
          for (const file of files) {
            await this.safeMove(join(nestedFolder, file), join(finalPath, file))
          }
        } else {
          // Not a folder, just move the temp extract to moodlecode
          await this.safeMove(extractTempPath, finalPath)
        }
      } else {
        // Multiple items at root - move temp extract to moodlecode
        log.debug(`Moving ${extractedContents.length} items from root extract`)
        await this.safeMove(extractTempPath, finalPath)
      }

      // Verify the move was successful
      const verifyPath = join(finalPath, 'config-dist.php')
      try {
        await fs.access(verifyPath)
        log.info(`Verified Moodle files at ${finalPath}`)
      } catch {
        throw new Error(
          `Failed to verify Moodle files at ${finalPath}. ` +
            `The extraction may have failed silently. ` +
            `Please delete the project folder and try again.`
        )
      }

      // Clean up temp directory
      await this.safeRemove(tempDir)
    } catch (error: unknown) {
      // Don't clean up temp dir on error - preserve partial download for resume
      // Only clean up if it's a non-resumable error

      // Enhance error message
      const errAny = error as any
      if (errAny.name === 'AbortError') {
        const elapsedMinutes = Math.round((Date.now() - startTime) / 1000 / 60)
        const errorMsg =
          `Download timed out after ${elapsedMinutes} minutes.\n\n` +
          `Possible causes:\n` +
          `- Slow or unstable internet connection\n` +
          `- Network interruption\n` +
          `- Server connection lost\n\n` +
          `The download can be resumed automatically on retry.\n` +
          `For very slow connections, please ensure your internet is stable and try again.\n\n` +
          `Tip: Moodle downloads can be large (100-200MB+). On slow connections, this may take 20-30+ minutes.`
        throw new Error(errorMsg)
      } else if (errAny.message?.includes('Failed to download')) {
        throw error
      } else {
        throw new Error(
          `Download or extraction failed: ${errAny.message || String(error)}\n\n` +
            `Possible causes:\n` +
            `- Network interruption during download\n` +
            `- Insufficient disk space\n` +
            `- File permissions issue\n\n` +
            `The download can be resumed automatically on retry.\n\n` +
            `Original error: ${errAny.message || String(error)}`
        )
      }
    }
  }

  /**
   * Download with buffered writes for better Windows performance
   */
  private async downloadWithBuffer(
    response: Response,
    fileStream: NodeJS.WritableStream & { destroyed?: boolean },
    startByte: number,
    totalSize: number,
    onProgress?: (percentage: number, downloaded: number, total: number, speed?: string) => void,
    resetInactivityTimeout?: () => void,
    saveDownloadState?: (downloaded: number, total: number) => Promise<void>
  ): Promise<void> {
    const startTime = Date.now()
    let downloadedSize = 0
    let writeBuffer = Buffer.alloc(0)
    let lastStateSave = 0 // Track last saved position for state persistence
    let lastProgressUpdate = 0 // Track last progress update time for throttling

    const flushBuffer = async (force = false): Promise<void> => {
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

        // Throttle progress updates to reduce IPC overhead (max 10 updates per second)
        const now = Date.now()
        if (
          onProgress &&
          (now - lastProgressUpdate >= this.PROGRESS_THROTTLE_MS || downloadedSize === 0)
        ) {
          lastProgressUpdate = now
          const totalDownloaded = downloadedSize + startByte
          // Calculate percentage only if we know total size, otherwise use 0 (indeterminate)
          const percentage = totalSize > 0 ? (totalDownloaded / totalSize) * 100 : 0
          const elapsedSeconds = (Date.now() - startTime) / 1000

          // Calculate download speed (MB/s)
          const speedMBps = elapsedSeconds > 0 ? downloadedSize / 1024 / 1024 / elapsedSeconds : 0

          // Format speed with appropriate unit
          let speedText = ''
          if (speedMBps > 0) {
            if (speedMBps >= 1) {
              speedText = `${speedMBps.toFixed(1)}MB/s`
            } else {
              // Show in KB/s if less than 1 MB/s
              const speedKBps = speedMBps * 1024
              speedText = `${speedKBps.toFixed(0)}KB/s`
            }
          }

          // Estimate remaining time (only if we know total size)
          const remainingMB = totalSize > 0 ? (totalSize - totalDownloaded) / 1024 / 1024 : 0
          const estimatedMinutes =
            speedMBps > 0 && totalSize > 0 ? Math.round(remainingMB / speedMBps) : null

          // Always call progress callback, even if totalSize is unknown
          // Pass 0 for percentage when totalSize is unknown (lifecycle manager will handle indeterminate display)
          // Pass speed as 4th parameter
          onProgress(percentage, totalDownloaded, totalSize, speedText)

          // Calculate elapsed minutes for logging
          const elapsedMinutes = Math.round(elapsedSeconds / 60)

          // Log progress every 10% or every minute for slow connections
          if (totalSize > 0 && (percentage % 10 < 1 || elapsedMinutes % 1 === 0)) {
            const status = startByte > 0 ? ' (resumed)' : ''
            log.info(
              `Download progress: ${percentage.toFixed(1)}%${status} ` +
                `(${(totalDownloaded / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB) ` +
                `- ${elapsedMinutes} min elapsed` +
                (estimatedMinutes ? ` - ~${estimatedMinutes} min remaining` : '')
            )
          } else if (totalSize === 0 && elapsedMinutes % 1 === 0) {
            // Log when total size is unknown (every minute)
            const status = startByte > 0 ? ' (resumed)' : ''
            log.info(
              `Download progress${status}: ${(totalDownloaded / 1024 / 1024).toFixed(1)}MB downloaded ` +
                `- ${elapsedMinutes} min elapsed (total size unknown)`
            )
          }
        }
      }

      // Flush any remaining buffer
      await flushBuffer(true)

      // Send final progress update (100% or final size if total was unknown)
      if (onProgress) {
        const finalDownloaded = downloadedSize + startByte
        const finalPercentage =
          totalSize > 0
            ? 100 // We know total, so we're at 100%
            : undefined // Total was unknown, let lifecycle manager handle it
        const finalElapsedSeconds = (Date.now() - startTime) / 1000
        const finalSpeedMBps =
          finalElapsedSeconds > 0 ? downloadedSize / 1024 / 1024 / finalElapsedSeconds : 0
        const finalSpeedText =
          finalSpeedMBps >= 1
            ? `${finalSpeedMBps.toFixed(1)}MB/s`
            : finalSpeedMBps > 0
              ? `${(finalSpeedMBps * 1024).toFixed(0)}KB/s`
              : ''
        onProgress(
          finalPercentage || 100,
          finalDownloaded,
          totalSize || finalDownloaded,
          finalSpeedText
        )
      }
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
  private async safeMove(
    source: string,
    dest: string,
    retries = FILE_OPS.MOVE_RETRIES
  ): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await fs.rename(source, dest)
        log.debug(`Successfully moved ${source} to ${dest}`)
        return
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error))
        const errorCode = (error as NodeJS.ErrnoException).code

        if (errorCode === 'EXDEV' || errorCode === 'EPERM' || errorCode === 'EBUSY') {
          // Cross-device move or locked file - copy and delete
          // On Windows, wait with exponential backoff before retrying
          if (this.isWindows && attempt < retries - 1) {
            const backoffMs = Math.min(
              FILE_OPS.WINDOWS_BACKOFF_BASE_MS * Math.pow(2, attempt),
              2000 // Increased max backoff to 2 seconds
            )
            log.debug(
              `File locked (${errorCode}), retrying move in ${backoffMs}ms (attempt ${attempt + 1}/${retries})`
            )
            await new Promise((resolve) => setTimeout(resolve, backoffMs))
            continue
          }

          // Last attempt or non-Windows: use copy+delete fallback
          log.info(`Using copy+delete fallback for move operation (${errorCode})`)
          try {
            await fs.cp(source, dest, { recursive: true })
            await fs.rm(source, { recursive: true, force: true })
            log.debug(`Successfully moved ${source} to ${dest} via copy+delete`)
            return
          } catch (copyError) {
            lastError = copyError instanceof Error ? copyError : new Error(String(copyError))
            log.error(`Copy+delete fallback failed: ${lastError.message}`)
            throw lastError
          }
        } else if (this.isWindows && errorCode === 'EACCES' && attempt < retries - 1) {
          // Windows-specific: file may be temporarily locked by antivirus
          const backoffMs = Math.min(
            FILE_OPS.WINDOWS_BACKOFF_BASE_MS * 2 * Math.pow(2, attempt),
            3000 // Increased max backoff to 3 seconds for EACCES
          )
          log.debug(
            `File access denied (EACCES), retrying in ${backoffMs}ms (attempt ${attempt + 1}/${retries})`
          )
          await new Promise((resolve) => setTimeout(resolve, backoffMs))
          continue
        } else {
          // Non-retryable error (including ENOENT - file not found)
          log.error(`Move failed with non-retryable error: ${errorCode} - ${lastError.message}`)
          throw lastError
        }
      }
    }

    // All retries exhausted - throw the last error
    const errorMsg = `Failed to move ${source} to ${dest} after ${retries} attempts`
    log.error(errorMsg, lastError)
    throw lastError || new Error(errorMsg)
  }

  /**
   * Safely remove a directory with retries and exponential backoff
   * Enhanced for Windows file locking issues
   */
  private async safeRemove(path: string, retries = FILE_OPS.REMOVE_RETRIES): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await fs.rm(path, { recursive: true, force: true })
        return
      } catch (error: unknown) {
        if (i === retries - 1) {
          // Last attempt failed, log but don't throw for Windows
          if (this.isWindows) {
            log.warn(`Failed to remove directory after ${retries} attempts: ${path}`, error)
            return // Don't throw on Windows - file may be locked by antivirus
          }
          throw error
        }
        // Exponential backoff with longer delays on Windows
        const baseDelay = this.isWindows
          ? FILE_OPS.WINDOWS_BACKOFF_BASE_MS
          : FILE_OPS.NON_WINDOWS_BACKOFF_BASE_MS
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
      // Ensure project path is absolute
      const absoluteProjectPath = resolve(projectPath)
      const moodleCodePath = join(absoluteProjectPath, 'moodlecode')
      const configPath = join(moodleCodePath, 'config-dist.php')
      await fs.access(configPath)
      return true
    } catch {
      return false
    }
  }
}
