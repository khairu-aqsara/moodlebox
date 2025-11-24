import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { MoodleVersion } from '../types'

export interface DockerExecOptions {
  container: string
  command: string[]
  cwd: string
  onStdout?: (data: string) => void
  onStderr?: (data: string) => void
}

export class MoodleInstaller {
  /**
   * Create initial config.php file from template
   */
  async createConfig(projectPath: string, port: number, version: MoodleVersion): Promise<void> {
    // Read config template
    const templatePath = app.isPackaged
      ? join(process.resourcesPath, 'assets', 'config.php')
      : join(__dirname, '../../assets/config.php')

    let configContent = await fs.readFile(templatePath, 'utf-8')

    // Read docker-compose.yml to get the generated database password
    const composeContent = await fs.readFile(join(projectPath, 'docker-compose.yml'), 'utf-8')
    const passwordMatch = composeContent.match(/MYSQL_PASSWORD[=:]\s*['"]?([^'"\s]+)['"]?/)
    const dbPassword = passwordMatch ? passwordMatch[1] : 'moodle'

    // Replace placeholders
    configContent = configContent.replace('http://localhost:8080', `http://localhost:${port}`)

    // Database settings - need to match docker-compose
    configContent = configContent.replace(/\$CFG->dbtype\s*=\s*'[^']+';/, "$CFG->dbtype    = 'mysqli';")
    configContent = configContent.replace(/\$CFG->dbhost\s*=\s*'[^']+';/, "$CFG->dbhost    = 'db';")
    configContent = configContent.replace(/\$CFG->dbuser\s*=\s*'[^']+';/, "$CFG->dbuser    = 'moodle';")
    configContent = configContent.replace(/\$CFG->dbpass\s*=\s*'[^']+';/, `$CFG->dbpass    = '${dbPassword}';`)

    // Remove Redis session handling if present (we don't have Redis in docker-compose)
    configContent = configContent.replace(/\/\/ Session settings.*?\$CFG->pathtophp[^\n]*\n/s, '')

    // For Moodle 5.1+ with webroot, we need to adjust dirroot
    if (version.webroot) {
      // dirroot should still be /var/www/html, not /var/www/html/public
      // The webserver DocumentRoot points to /public, but dirroot is the main directory
      configContent = configContent.replace(
        "$CFG->dirroot   = '/var/www/html';",
        "$CFG->dirroot   = '/var/www/html';"
      )
    }

    // Write config.php to local moodlecode folder (which is mounted in container)
    const configPath = join(projectPath, 'moodlecode', 'config.php')
    await fs.writeFile(configPath, configContent)
  }

  /**
   * Install Composer in the container
   */
  async installComposer(projectPath: string, onLog?: (log: string) => void): Promise<void> {
    onLog?.('📦 Installing Composer...')

    // Install Composer using the official installer
    const installCommand = [
      'sh',
      '-c',
      'curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer'
    ]

    return this.dockerExec({
      container: 'moodle',
      command: installCommand,
      cwd: projectPath,
      onStdout: onLog,
      onStderr: onLog
    })
  }

  /**
   * Run composer install (for Moodle 5.1+)
   */
  async runComposerInstall(projectPath: string, onLog?: (log: string) => void): Promise<void> {
    // First, install Composer if not already installed
    await this.installComposer(projectPath, onLog)

    onLog?.('📦 Running composer install...')

    return this.dockerExec({
      container: 'moodle',
      command: ['composer', 'install', '--no-interaction', '--prefer-dist'],
      cwd: projectPath,
      onStdout: onLog,
      onStderr: onLog
    })
  }

  /**
   * Clean up partial installation by dropping and recreating the database
   */
  async cleanDatabase(projectPath: string, onLog?: (log: string) => void): Promise<void> {
    onLog?.('🧹 Cleaning up partial installation...')

    // Get database password from docker-compose.yml
    const composeContent = await fs.readFile(join(projectPath, 'docker-compose.yml'), 'utf-8')
    const passwordMatch = composeContent.match(/MYSQL_PASSWORD[=:]\s*['"]?([^'"\s]+)['"]?/)
    const dbPassword = passwordMatch ? passwordMatch[1] : 'moodle'

    // Drop and recreate the database using mysql command
    const dropCommand = [
      'mysql',
      '-h', '127.0.0.1',
      '-u', 'root',
      `-p${dbPassword}`,
      '-e',
      'DROP DATABASE IF EXISTS moodle; CREATE DATABASE moodle CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON moodle.* TO moodle@\'%\';'
    ]

    await this.dockerExec({
      container: 'db',
      command: dropCommand,
      cwd: projectPath,
      onStdout: onLog,
      onStderr: onLog
    })

    onLog?.('✓ Database cleaned')
  }

  /**
   * Fix permissions for moodledata
   */
  async fixPermissions(projectPath: string, onLog?: (log: string) => void): Promise<void> {
    onLog?.('🔒 Fixing permissions...')

    const command = [
      'sh',
      '-c',
      'chown -R www-data:www-data /var/www/moodledata && chmod -R 777 /var/www/moodledata'
    ]

    await this.dockerExec({
      container: 'moodle',
      command,
      cwd: projectPath,
      onStdout: onLog,
      onStderr: onLog
    })

    onLog?.('✓ Permissions fixed')
  }

  /**
   * Run Moodle CLI installation
   */
  async install(projectPath: string, projectName: string, port: number, version: MoodleVersion, onLog?: (log: string) => void): Promise<void> {
    // First, clean up any partial installation
    await this.cleanDatabase(projectPath, onLog)

    // Fix permissions for moodledata
    await this.fixPermissions(projectPath, onLog)

    // Create config.php
    await this.createConfig(projectPath, port, version)

    // If composer is required, run composer install
    if (version.composer) {
      await this.runComposerInstall(projectPath, onLog)
    }

    // Then run database installation with increased PHP timeouts
    const command = [
      'php',
      '-d', 'max_execution_time=0',           // No execution time limit
      '-d', 'memory_limit=2048M',             // More memory
      '-d', 'default_socket_timeout=7200',    // Socket timeout 2 hours
      'admin/cli/install_database.php',
      '--lang=en',
      '--adminuser=admin',
      '--adminpass=admin',
      '--adminemail=admin@example.com',
      '--agree-license',
      `--fullname=${projectName}`,
      `--shortname=moodle`
    ]

    onLog?.('⏳ Running Moodle installation (this may take 5-10 minutes for FULLTEXT indexes)...')

    return this.dockerExec({
      container: 'moodle',
      command,
      cwd: projectPath,
      onStdout: onLog,
      onStderr: onLog
    })
  }

  /**
   * Disable password policy in Moodle config
   */
  async disablePasswordPolicy(projectPath: string): Promise<void> {
    const command = [
      'php',
      '-r',
      `define('CLI_SCRIPT', true);
       require('/var/www/html/config.php'); 
       $CFG->passwordpolicy = 0; 
       file_put_contents('/var/www/html/config.php', 
         str_replace('?>', '', file_get_contents('/var/www/html/config.php')) . 
         "\\n\\$CFG->passwordpolicy = 0;\\n"
       );`
    ]

    return this.dockerExec({
      container: 'moodle',
      command,
      cwd: projectPath
    })
  }

  /**
   * Restore sample course from backup
   */
  async restoreCourse(projectPath: string, courseBackupPath: string): Promise<void> {
    // Copy course backup to moodledata
    const moodledataPath = join(projectPath, 'moodledata')
    const tempBackupPath = join(moodledataPath, 'temp', 'backup')
    await fs.mkdir(tempBackupPath, { recursive: true })

    const backupFileName = 'sample_course.mbz'
    const targetPath = join(tempBackupPath, backupFileName)

    // Copy the backup file to moodledata
    await fs.copyFile(courseBackupPath, targetPath)

    // Run Moodle CLI to restore the course
    const command = [
      'php',
      'admin/cli/restore_backup.php',
      `--file=/var/www/moodledata/temp/backup/${backupFileName}`,
      '--categoryid=1'
    ]

    return this.dockerExec({
      container: 'moodle',
      command,
      cwd: projectPath
    })
  }

  /**
   * Check if Moodle is installed by checking if database tables exist
   * This must be called AFTER containers are up and running
   */
  async isInstalled(projectPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Check if mdl_config table exists in the database
      const composeContent = require('fs').readFileSync(require('path').join(projectPath, 'docker-compose.yml'), 'utf-8')
      const passwordMatch = composeContent.match(/MYSQL_PASSWORD[=:]\s*['"]?([^'"\s]+)['"]?/)
      const dbPassword = passwordMatch ? passwordMatch[1] : 'moodle'

      const args = [
        'compose',
        'exec',
        '-T',
        'db',
        'mysql',
        '-h', '127.0.0.1',
        '-u', 'moodle',
        `-p${dbPassword}`,
        'moodle',
        '-e',
        'SELECT COUNT(*) FROM mdl_config;'
      ]

      const proc = spawn('docker', args, {
        cwd: projectPath,
        windowsHide: true
      })

      let output = ''
      proc.stdout?.on('data', (data) => {
        output += data.toString()
      })

      proc.on('close', (code) => {
        // If query succeeds, database tables exist (installed)
        // If it fails, tables don't exist (not installed)
        resolve(code === 0 && output.includes('COUNT'))
      })

      proc.on('error', () => {
        // If command fails, assume not installed
        resolve(false)
      })
    })
  }

  /**
   * Execute command in Docker container
   */
  private dockerExec(options: DockerExecOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        'compose',
        'exec',
        '-T', // Disable TTY
        options.container,
        ...options.command
      ]

      const proc = spawn('docker', args, {
        cwd: options.cwd,
        windowsHide: true
      })

      let stdout = ''
      let stderr = ''

      proc.stdout?.on('data', (data) => {
        const output = data.toString()
        stdout += output
        if (options.onStdout) {
          options.onStdout(output)
        }
      })

      proc.stderr?.on('data', (data) => {
        const output = data.toString()
        stderr += output
        if (options.onStderr) {
          options.onStderr(output)
        }
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          const errorMsg = stderr || stdout || `Command exited with code ${code}`
          reject(new Error(`Docker exec failed: ${errorMsg}`))
        }
      })

      proc.on('error', (err) => {
        reject(err)
      })
    })
  }
}
