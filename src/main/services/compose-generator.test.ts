import { describe, it, expect } from 'vitest'
import { ComposeGenerator } from './compose-generator'
import { Project } from '../types'

describe('ComposeGenerator', () => {
  const generator = new ComposeGenerator()

  const mockProject: Project = {
    id: 'test-project-id',
    name: 'Test Project',
    port: 8080,
    moodleVersion: '4.4',
    path: '/Users/test/moodle',
    status: 'stopped',
    createdAt: '2024-01-01T00:00:00.000Z'
  }

  const mockVersion44 = {
    version: '4.4',
    type: 'stable' as const,
    download: 'https://download.moodle.org/download.php/direct/stable404/moodle-4.4.tgz',
    requirements: {
      php: '8.1',
      mysql: '8.0',
      postgres: '13'
    }
  }

  const mockVersion51 = {
    version: '5.1',
    type: 'stable' as const,
    download: 'https://download.moodle.org/download.php/direct/stable500/moodle-5.1.tgz',
    requirements: {
      php: '8.2',
      mysql: '8.0',
      postgres: '13'
    },
    webroot: 'public'
  }

  describe('generate', () => {
    it('should generate valid docker-compose.yml for Moodle 4.4', () => {
      const output = generator.generate(mockProject, mockVersion44)

      expect(output).toContain('services:')
      expect(output).toContain('image: moodlehq/moodle-php-apache:8.1')
      expect(output).toContain('image: mysql:8.0')
      expect(output).toContain('image: phpmyadmin:latest')
      expect(output).toContain('"8080:80"')
    })

    it('should generate valid docker-compose.yml for Moodle 5.1 with webroot', () => {
      const output = generator.generate(mockProject, mockVersion51)

      expect(output).toContain('services:')
      expect(output).toContain('image: moodlehq/moodle-php-apache:8.2')
      expect(output).toContain('image: mysql:8.0')
      expect(output).toContain('/var/www/html/public')
      expect(output).toContain("sed -i 's|/var/www/html|/var/www/html/public|g'")
    })

    it('should include all required services', () => {
      const output = generator.generate(mockProject, mockVersion44)

      expect(output).toContain('moodle:')
      expect(output).toContain('cron:')
      expect(output).toContain('db:')
      expect(output).toContain('phpmyadmin:')
    })

    it('should include password environment variables', () => {
      const output = generator.generate(mockProject, mockVersion44)

      expect(output).toContain('MYSQL_ROOT_PASSWORD=')
      expect(output).toContain('MYSQL_PASSWORD=')
      expect(output).toContain('MOODLE_DBPASSWORD=')
      expect(output).toContain('PMA_PASSWORD=')
    })

    it('should include healthchecks for services', () => {
      const output = generator.generate(mockProject, mockVersion44)

      // MySQL healthcheck with --password= syntax (cross-platform compatible)
      expect(output).toContain('healthcheck:')
      expect(output).toContain('mysqladmin')
      expect(output).toContain('--password=')
      expect(output).toContain('ping')

      // Moodle healthcheck
      expect(output).toContain('curl')
      expect(output).toContain('/lib/ajax/service.php')
    })

    it('should use correct password syntax for cross-platform compatibility', () => {
      const output = generator.generate(mockProject, mockVersion44)

      // Should use --password= (works on Windows, macOS, Linux)
      // NOT -p (fails on Windows)
      // The password is generated at runtime, so we check for the pattern
      expect(output).toContain('--password=')
      expect(output).not.toMatch(/["[]-p\$\{/)
    })

    it('should configure MySQL with optimized settings', () => {
      const output = generator.generate(mockProject, mockVersion44)

      expect(output).toContain('--character-set-server=utf8mb4')
      expect(output).toContain('--collation-server=utf8mb4_unicode_ci')
      expect(output).toContain('--innodb-file-per-table=1')
      expect(output).toContain('--max_allowed_packet=512M')
      expect(output).toContain('--innodb_buffer_pool_size=256M')
    })

    it('should include proper service dependencies', () => {
      const output = generator.generate(mockProject, mockVersion44)

      expect(output).toContain('depends_on:')
      expect(output).toContain('condition: service_healthy')
    })

    it('should configure cron service', () => {
      const output = generator.generate(mockProject, mockVersion44)

      expect(output).toContain('cron:')
      expect(output).toContain(
        '/bin/bash -c "while true; do php /var/www/html/admin/cli/cron.php; sleep 60; done"'
      )
    })

    it('should map project volumes correctly', () => {
      const output = generator.generate(mockProject, mockVersion44)

      expect(output).toContain('- ./moodlecode:/var/www/html')
      expect(output).toContain('- ./moodledata:/var/www/moodledata')
      expect(output).toContain('- ./mysql_data:/var/lib/mysql')
    })

    it('should handle custom db port', () => {
      const projectWithCustomDbPort = { ...mockProject, dbPort: 3307 }
      const output = generator.generate(projectWithCustomDbPort, mockVersion44)

      expect(output).toContain('"3307:3306"')
    })

    it('should use default db port when not specified', () => {
      const output = generator.generate(mockProject, mockVersion44)

      expect(output).toContain('"3306:3306"')
    })

    it('should increment port for phpMyAdmin', () => {
      const output = generator.generate(mockProject, mockVersion44)

      expect(output).toContain('"8081:80"') // port + 1
    })

    it('should include correct Moodle environment variables', () => {
      const output = generator.generate(mockProject, mockVersion44)

      expect(output).toContain('MOODLE_DBTYPE=mysqli')
      expect(output).toContain('MOODLE_DBHOST=db')
      expect(output).toContain('MOODLE_DBNAME=moodle')
      expect(output).toContain('MOODLE_DBUSER=moodle')
    })

    it('should handle Moodle 5.1 webroot override correctly', () => {
      const output = generator.generate(mockProject, mockVersion51)

      // Should include Apache config modification command
      expect(output).toContain('command: /bin/bash -c')
      expect(output).toContain('sed -i')
      expect(output).toContain('/etc/apache2/sites-available/000-default.conf')
      expect(output).toContain('/var/www/html/public')
    })

    it('should handle Moodle 5.1 webroot in WWWROOT env vars', () => {
      const output = generator.generate(mockProject, mockVersion51)

      // WWWROOT should remain /var/www/html even for 5.1
      expect(output).toContain('MOODLE_DOCKER_WWWROOT=/var/www/html')
    })

    it('should generate password placeholder for MySQL', () => {
      const output = generator.generate(mockProject, mockVersion44)

      // Password is generated at runtime with moodle_dev_ prefix
      expect(output).toContain('MOODLE_DBPASSWORD=moodle_dev_')
      expect(output).toContain('MYSQL_PASSWORD=moodle_dev_')
      expect(output).toContain('MYSQL_ROOT_PASSWORD=moodle_dev_')
      expect(output).toContain('PMA_PASSWORD=moodle_dev_')
    })
  })

  describe('generatePassword', () => {
    it('should generate different passwords each time', () => {
      const output1 = generator.generate(mockProject, mockVersion44)
      const output2 = generator.generate(mockProject, mockVersion44)

      // Extract the passwords from the output
      const pass1 = output1.match(/MYSQL_PASSWORD=(moodle_dev_[A-Za-z0-9]+)/)?.[1]
      const pass2 = output2.match(/MYSQL_PASSWORD=(moodle_dev_[A-Za-z0-9]+)/)?.[1]

      expect(pass1).toBeTruthy()
      expect(pass2).toBeTruthy()
      expect(pass1).not.toBe(pass2) // Random passwords should differ
    })

    it('should use moodle_dev_ prefix for password', () => {
      const output = generator.generate(mockProject, mockVersion44)

      // All password references should use the moodle_dev_ prefix
      expect(output).toContain('moodle_dev_')
    })
  })

  describe('Edge Cases', () => {
    it('should handle minimum port (1024)', () => {
      const project = { ...mockProject, port: 1024 }
      const output = generator.generate(project, mockVersion44)

      expect(output).toContain('"1024:80"')
      expect(output).toContain('"1025:80"') // phpMyAdmin port + 1
    })

    it('should handle maximum port (65534)', () => {
      const project = { ...mockProject, port: 65534 }
      const output = generator.generate(project, mockVersion44)

      expect(output).toContain('"65534:80"')
      expect(output).toContain('"65535:80"') // phpMyAdmin port + 1
    })

    it('should handle long project names in compose file', () => {
      const longName = 'A'.repeat(100)
      const project = { ...mockProject, name: longName }
      const output = generator.generate(project, mockVersion44)

      // Compose file should be generated without errors
      expect(output).toContain('services:')
    })

    it('should handle special characters in moodleVersion', () => {
      // Version with patch number
      const versionWithPatch = {
        ...mockVersion44,
        version: '4.4.1'
      }
      const output = generator.generate(mockProject, versionWithPatch)

      expect(output).toContain('moodlehq/moodle-php-apache')
    })
  })
})
