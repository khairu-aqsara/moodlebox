export interface Project {
  id: string
  name: string
  moodleVersion: string
  port: number
  dbPort?: number // External port for database access
  status: 'provisioning' | 'installing' | 'starting' | 'waiting' | 'ready' | 'stopped' | 'stopping' | 'deleting' | 'error'
  path: string
  createdAt: string
  lastUsed?: string
  errorMessage?: string
  progress?: ProgressInfo
  statusDetail?: string // e.g., "Downloading Moodle...", "Pulling Docker images..."
}

export interface ProgressInfo {
  phase: string // e.g., "download", "docker-pull", "install"
  percentage?: number // 0-100
  current?: number // e.g., current bytes downloaded
  total?: number // e.g., total bytes to download
  message?: string // Human-readable progress message
}

export interface MoodleVersion {
  version: string
  type: 'lts' | 'stable'
  download: string // URL to download Moodle source
  requirements: {
    php: string
    mariadb?: string // MariaDB version requirement
    mysql?: string // MySQL version requirement
    postgres: string
  }
  webroot?: string // e.g., "public" for Moodle 5.1+
  composer?: boolean // Whether Composer is required for this version
}

export interface VersionsData {
  latest_update: string
  releases: MoodleVersion[]
}
