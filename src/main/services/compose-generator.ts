import { MoodleVersion, Project } from '../types'
import { randomBytes } from 'crypto'

export class ComposeGenerator {
  generate(project: Project, version: MoodleVersion): string {
    const password = this.generatePassword()

    // Determine docker images based on requirements
    const moodleImage = `moodlehq/moodle-php-apache:${version.requirements.php}`
    const dbImage = `mysql:${version.requirements.mysql}`

    return `services:
  moodle:
    image: ${moodleImage}
    command: /bin/bash -c "a2enmod rewrite headers && docker-php-entrypoint apache2-foreground"
    ports:
      - "${project.port}:80"
    volumes:
      - ./moodlecode:/var/www/html
      - ./moodledata:/var/www/moodledata
      - ./config/php.ini:/usr/local/etc/php/conf.d/moodlebox.ini
      - ./config/apache.conf:/etc/apache2/sites-available/000-default.conf
    environment:
      - MOODLE_DBTYPE=mysqli
      - MOODLE_DBHOST=db
      - MOODLE_DBNAME=moodle
      - MOODLE_DBUSER=moodle
      - MOODLE_DBPASSWORD=${password}
      - MOODLE_DOCKER_WWWROOT=/var/www/html
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/lib/ajax/service.php"]
      interval: 10s
      timeout: 5s
      retries: 5

  cron:
    image: ${moodleImage}
    command: >
      /bin/bash -c "while true; do php /var/www/html/admin/cli/cron.php; sleep 60; done"
    volumes:
      - ./moodlecode:/var/www/html
      - ./moodledata:/var/www/moodledata
      - ./config/php.ini:/usr/local/etc/php/conf.d/moodlebox.ini
    environment:
      - MOODLE_DBTYPE=mysqli
      - MOODLE_DBHOST=db
      - MOODLE_DBNAME=moodle
      - MOODLE_DBUSER=moodle
      - MOODLE_DBPASSWORD=${password}
      - MOODLE_DOCKER_WWWROOT=/var/www/html
    depends_on:
      moodle:
        condition: service_started


  db:
    image: ${dbImage}
    command: >
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
      --innodb-file-per-table=1
      --max_allowed_packet=512M
      --wait_timeout=36000
      --interactive_timeout=36000
      --connect_timeout=600
      --net_read_timeout=7200
      --net_write_timeout=7200
      --innodb_buffer_pool_size=256M
      --innodb_flush_log_at_trx_commit=2
      --max_connections=200
      --skip-name-resolve
    ports:
      - "${project.dbPort || 3306}:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=${password}
      - MYSQL_DATABASE=moodle
      - MYSQL_USER=moodle
      - MYSQL_PASSWORD=${password}
    volumes:
      - ./mysql_data:/var/lib/mysql
      - ./config/mysql.cnf:/etc/mysql/conf.d/moodlebox.cnf
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "--password=${password}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 60s
  
  phpmyadmin:
    image: phpmyadmin:latest
    ports:
      - "${project.phpMyAdminPort}:80"
    environment:
      - PMA_HOST=db
      - PMA_USER=root
      - PMA_PASSWORD=${password}
    depends_on:
      - db
`
  }

  generateApacheConfig(version: MoodleVersion): string {
    const documentRoot = version.webroot ? `/var/www/html/${version.webroot}` : '/var/www/html'
    return this.buildApacheConfig(documentRoot, !!(version.router || version.webroot))
  }

  private buildApacheConfig(documentRoot: string, withRouter: boolean = false): string {
    const rules = [
      '(\\/vendor\\/)',
      '(\\/node_modules\\/)',
      '(^|/)\\.(?!well-known\\/)',
      '(composer\\.json)',
      '(\\.lock)',
      '(\\/environment.xml)',
      '(\\/lib\\/classes)',
      '(\\/install.xml)',
      '(\\/README)',
      '(\\/readme)',
      '(\\/moodle_readme)',
      '(\\/upgrade\\.txt)',
      '(phpunit\\.xml\\.dist)',
      '(\\/tests\\/behat\\/)',
      '(\\/fixtures\\/)',
      '(\\/upgrade\\.txt|UPGRADING\\.md|UPGRADING\\-CURRENT\\.md)'
    ]
      .map((rule) => `\tRewriteRule "${rule}" - [L,R=404]`)
      .join('\n')

    return `<VirtualHost *:80>
\tServerAdmin webmaster@localhost
\tDocumentRoot ${documentRoot}

\t<Directory ${documentRoot}>
\t\tOptions Indexes FollowSymLinks
\t\tAllowOverride None
\t\tRequire all granted${withRouter ? `
\t\tFallbackResource /r.php` : ''}
\t</Directory>

\tRewriteEngine On
${rules}
\t# Handling 40x errors - enables missing files to be themed by Moodle
\tErrorDocument 404 /error/index.php
\tErrorDocument 403 /error/index.php?code=404

\tErrorLog \${APACHE_LOG_DIR}/error.log
\tCustomLog \${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
`
  }

  private generatePassword(): string {
    // Use cryptographically secure random bytes for password generation
    const randomPart = randomBytes(12).toString('base64').replace(/[+/=]/g, '').substring(0, 16)
    return 'moodle_dev_' + randomPart
  }
}
