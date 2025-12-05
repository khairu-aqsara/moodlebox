/**
 * Application-wide constants
 * Centralized configuration values to improve maintainability
 */

// Docker-related constants
export const DOCKER = {
  STATUS_CACHE_TTL_MS: 5000, // Cache Docker status for 5 seconds
  HEALTH_CHECK_TIMEOUT_MS: 120000, // 2 minutes timeout for health checks
  COMPOSE_COMMAND_TIMEOUT_MS: 300000 // 5 minutes timeout for compose commands
}

// Download-related constants
export const DOWNLOAD = {
  BUFFER_SIZE: 1024 * 1024, // 1MB buffer for Windows optimization
  STATE_SAVE_INTERVAL: 5 * 1024 * 1024, // Save state every 5MB
  MAX_RETRIES: 3, // Maximum retry attempts for transient errors
  INITIAL_RETRY_DELAY_MS: 1000, // Initial delay in ms (1 second)
  PROGRESS_THROTTLE_MS: 100, // Throttle progress updates to max 10 per second
  INACTIVITY_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes of no data = timeout
  MAX_DOWNLOAD_TIME_MS: 60 * 60 * 1000 // Absolute maximum: 60 minutes (safety net)
}

// Project state sync constants
export const PROJECT_SYNC = {
  DEBOUNCE_MS: 1000, // Debounce sync by 1 second
  COOLDOWN_MS: 5000 // Minimum time between syncs (5 seconds)
}

// Port validation constants
export const PORTS = {
  MIN_PORT: 1024, // Minimum port (below 1024 requires root)
  MAX_PORT: 65535, // Maximum port
  DB_PORT_MIN: 10000, // Minimum database port
  DB_PORT_MAX: 60000, // Maximum database port
  RESERVED_PORTS: [
    3306, // MySQL default
    5432, // PostgreSQL default
    27017, // MongoDB default
    6379, // Redis default
    8080, // Common HTTP alternative
    8443, // HTTPS alternative
    9000, // Common development port
    3000, // Common development port
    5000, // Common development port
    8000, // Common development port
    8888 // Common development port
  ]
}

// HTTP wait constants
export const HTTP_WAIT = {
  TIMEOUT_MS: 60000, // 60 seconds timeout for HTTP checks
  RETRY_INTERVAL_MS: 2000 // Wait 2 seconds between retries
}

// File operation constants
export const FILE_OPS = {
  MOVE_RETRIES: 3, // Number of retries for file moves
  REMOVE_RETRIES: 5, // Number of retries for directory removal
  WINDOWS_BACKOFF_BASE_MS: 200, // Base delay for Windows retries
  NON_WINDOWS_BACKOFF_BASE_MS: 100 // Base delay for non-Windows retries
}

// Window constants
export const WINDOW = {
  DEFAULT_WIDTH: 1000,
  DEFAULT_HEIGHT: 700,
  MIN_WIDTH: 800,
  MIN_HEIGHT: 600
}
