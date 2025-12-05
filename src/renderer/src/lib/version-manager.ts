import { VersionsData, VersionsDataSchema } from '../types'
import versionsData from '../../../../assets/versions.json'

class VersionManager {
  private data: VersionsData

  constructor() {
    // Validate the JSON data at runtime
    const result = VersionsDataSchema.safeParse(versionsData)

    if (!result.success) {
      // Invalid versions.json - this is a critical error
      // Throw error to prevent app from running with invalid data
      throw new Error(`Failed to load versions.json: ${result.error.message}`)
    }

    this.data = result.data
  }

  getAllVersions(): VersionsData['releases'] {
    return this.data.releases
  }

  getVersionByNumber(version: string): VersionsData['releases'][0] | undefined {
    return this.data.releases.find((r) => r.version === version)
  }

  getLatestVersion(): VersionsData['releases'][0] {
    return this.data.releases[0]
  }

  getLTSVersions(): VersionsData['releases'] {
    return this.data.releases.filter((r) => r.type === 'lts')
  }

  getLastUpdate(): string {
    return this.data.latest_update
  }
}

export const versionManager = new VersionManager()
