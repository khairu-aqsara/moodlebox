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
      // Download archive
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MoodleBox/1.0 (+https://github.com/yourrepo)'
        }
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

      // Extract archive to temp location first
      const extractTempPath = join(tempDir, 'extracted')
      await fs.mkdir(extractTempPath, { recursive: true })

      await extract(archivePath, { dir: extractTempPath })

      // GitHub zips have a nested folder (e.g., moodle-master/)
      // We need to move contents up one level
      const extractedContents = await fs.readdir(extractTempPath)

      if (extractedContents.length === 1) {
        // Single folder - likely the nested Moodle folder
        const nestedFolder = join(extractTempPath, extractedContents[0])
        const stat = await fs.stat(nestedFolder)

        if (stat.isDirectory()) {
          // Move nested folder contents to moodlecode/
          const finalPath = join(destination, 'moodlecode')
          await fs.mkdir(finalPath, { recursive: true })

          // Move all files from nested folder to final destination
          const files = await fs.readdir(nestedFolder)
          for (const file of files) {
            await fs.rename(join(nestedFolder, file), join(finalPath, file))
          }
        } else {
          // Not a folder, just move the temp extract to moodlecode
          await fs.rename(extractTempPath, join(destination, 'moodlecode'))
        }
      } else {
        // Multiple items at root - move temp extract to moodlecode
        await fs.rename(extractTempPath, join(destination, 'moodlecode'))
      }

      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error: any) {
      // Clean up on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})

      // Enhance error message
      if (error.message?.includes('Failed to download')) {
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
