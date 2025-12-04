import { MoodleVersion, Project } from '../types'

export class ComposeGenerator {
  generate(project: Project, version: MoodleVersion): string {
    const webroot = version.webroot ? `/var/www/html/${version.webroot}` : '/var/www/html'
    const commandOverride = version.webroot
      ? `command: /bin/bash -c "sed -i 's|/var/www/html|${webroot}|g' /etc/apache2/sites-available/000-default.conf && docker-php-entrypoint apache2-foreground"`
      : ''

    const password = this.generatePassword()

    // Determine docker images based on requirements
    const moodleImage = `moodlehq/moodle-php-apache:${version.requirements.php}`
    const dbImage = `mysql:${version.requirements.mysql}`

    return `services:
  moodle:
    image: ${moodleImage}
    ${commandOverride}
    ports:
      - "${project.port}:80"
    volumes:
      - ./moodlecode:/var/www/html
      - ./moodledata:/var/www/moodledata
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
    environment:
      - MOODLE_DBTYPE=mysqli
      - MOODLE_DBHOST=db
      - MOODLE_DBNAME=moodle
      - MOODLE_DBUSER=moodle
      - MOODLE_DBPASSWORD=${password}
      - MOODLE_DOCKER_WWWROOT=/var/www/html
    depends_on:
      moodle:
        condition: service_healthy


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
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${password}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 60s
  
  phpmyadmin:
    image: phpmyadmin:latest
    ports:
      - "${project.port + 1}:80"
    environment:
      - PMA_HOST=db
      - PMA_USER=root
      - PMA_PASSWORD=${password}
    depends_on:
      - db
`
  }

  private generatePassword(): string {
    return 'moodle_dev_' + Math.random().toString(36).substring(2, 15)
  }
}
