import fetch from 'node-fetch'
import extract from 'extract-zip'
import { promises as fs } from 'fs'
import { join } from 'path'

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

    try {
      console.log(`Starting download from ${url}`)
      // Download archive with timeout
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 300000) // 5 minutes timeout

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

        // Stream download to file
        const fileStream = (await import('fs')).createWriteStream(archivePath)

        if (response.body) {
          for await (const chunk of response.body) {
            fileStream.write(chunk)
            downloadedSize += chunk.length

            if (onProgress && totalSize > 0) {
              const percentage = (downloadedSize / totalSize) * 100
              onProgress(percentage, downloadedSize, totalSize)
            }
          }
        }

        fileStream.end()
        await new Promise<void>((resolve, reject) => {
          fileStream.on('finish', () => resolve())
          fileStream.on('error', reject)
        })
      } finally {
        clearTimeout(timeout)
      }

      console.log('Download complete, starting extraction...')

      // Extract archive to temp location first
      const extractTempPath = join(tempDir, 'extracted')
      await fs.mkdir(extractTempPath, { recursive: true })

      await extract(archivePath, { dir: extractTempPath })
      console.log('Extraction complete, processing files...')

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

      console.log('Files moved successfully')

      // Clean up temp directory
      await this.safeRemove(tempDir)
    } catch (error: any) {
      console.error('Download/Extraction error:', error)
      // Clean up on error
      await this.safeRemove(tempDir).catch(() => {})

      // Enhance error message
      if (error.name === 'AbortError') {
        throw new Error(
          'Download timed out after 5 minutes. Please check your internet connection.'
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
        await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)))
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
