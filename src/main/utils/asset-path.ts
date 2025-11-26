import { join } from 'path'
import { app } from 'electron'
import { promises as fs } from 'fs'
import log from 'electron-log'

/**
 * Get the correct path to assets in both development and production
 * In development: uses relative path from __dirname
 * In production: uses process.resourcesPath (assets are unpacked from asar)
 */
export function getAssetPath(...pathSegments: string[]): string {
  if (app.isPackaged) {
    // In production, assets are unpacked to app.asar.unpacked/assets/
    return join(process.resourcesPath, 'assets', ...pathSegments)
  } else {
    // In development, assets are in the assets/ directory relative to __dirname
    return join(__dirname, '../../assets', ...pathSegments)
  }
}

/**
 * Verify that all required asset files exist and are accessible
 * This can be called during app startup to ensure assets are properly loaded
 */
export async function verifyAssets(): Promise<boolean> {
  const requiredAssets = ['versions.json', 'config.php', 'courses.mbz']

  try {
    for (const asset of requiredAssets) {
      const assetPath = getAssetPath(asset)
      log.info(`Verifying asset: ${assetPath}`)

      await fs.access(assetPath)
      log.info(`✓ Asset accessible: ${asset}`)
    }

    log.info('✅ All assets verified successfully')
    return true
  } catch (error) {
    log.error('❌ Asset verification failed:', error)
    return false
  }
}
