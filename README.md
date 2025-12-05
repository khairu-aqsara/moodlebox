# MoodleBox

<div align="center">

![MoodleBox Logo](assets/icon.png)

**A local Moodle environment for everyone**

[![Electron](https://img.shields.io/badge/Electron-38.0+-9FEAF9?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.0+-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Building](#-building)
- [Configuration](#-configuration)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**MoodleBox** is a cross-platform desktop application built with Electron that simplifies local Moodle development environments. It eliminates the complexity of manually configuring PHP, MySQL, Docker, and development tools by providing a **one-click setup** for Moodle developers.

### Problem Statement

Moodle developers traditionally waste **2-4 hours** setting up local development environments, struggle with version compatibility, and frequently encounter "works on my machine" issues.

### Solution

MoodleBox is a Docker-wrapper desktop application that automates environment provisioning with Moodle-specific configurations, reducing setup time from hours to **less than 5 minutes**.

### Target Audience

- 🧑‍💻 **Moodle Plugin Developers** - Test plugins across multiple Moodle versions
- 🎓 **Educators & Evaluators** - Try out Moodle features without technical knowledge
- 🏢 **IT Administrators** - Standardize development environments across teams
- 🌱 **New Developers** - Learn Moodle architecture with guided onboarding

---

## ✨ Features

### Core Features (MVP)

#### 🚀 One-Click Project Creation

- Select Moodle version from dropdown (3.11 LTS, 4.x, 5.x, daily builds)
- Automatic PHP and MySQL version resolution based on Moodle requirements
- Advanced mode for manual version override
- Project provisioning completes in less than 5 minutes

#### 🐳 Automated Docker Environment

- **Services Included**: PHP, Apache, MySQL, phpMyAdmin
- **Auto-Installation**: Moodle CLI install runs automatically
- **Default Credentials**: Pre-configured admin account (`admin` / `admin`)
- **Password Policy**: Disabled for development convenience
- **Sample Content**: Pre-loaded example course with assignments, quizzes, and forums

#### 🎨 Modern UI/UX

- **Glassmorphic Design**: Premium dark/light theme support
- **Speed Dial FAB**: Quick access to Create Project and Settings
- **Project Cards**: Visual status indicators with real-time updates
- **State Management**: Clear lifecycle states (Installing → Starting → Ready)

#### 📊 Project Management

- Create, start, stop, and delete projects with ease
- View project status, resource usage, and uptime at a glance
- Quick access to Moodle site, phpMyAdmin, and project directory
- Configurable workspace folder for organized project storage

#### 🔧 Smart Configuration

- **Version Matrix**: Bundled `assets/versions.json` for offline support
- **Intelligent Dependency Resolution**: Automatic PHP/DB version selection
- **Configurable Settings**: Theme, workspace folder, phpMyAdmin port
- **Persistent State**: Projects and settings saved with electron-store

#### 🛡️ Robust Error Handling

- Docker availability detection with actionable error messages
- Download progress indicators for Moodle source files
- Health check monitoring for containers (MySQL, Web Server)
- Clear visual feedback for all lifecycle states

### Coming Soon (Roadmap)

#### Phase 2 (Advanced Development Tools)

- PHP version switcher per project
- Xdebug integration with IDE support
- Email capture with built-in mail-catcher
- Custom port assignment for multiple simultaneous projects

#### Phase 3 (Moodle-Specific Tools)

- PHPUnit & Behat automated test setup
- Plugin generator GUI
- Sample data generator (courses, users, activities)
- Multi-site Moodle configurations

#### Phase 4 (Collaboration & Backup)

- Environment backup/restore
- Export/share environment configurations
- Custom project templates
- Performance monitoring dashboard

---

## 📸 Screenshots

![MoodleBox Screenshot](image.jpg)

---

## 📦 Prerequisites

### System Requirements

**Minimum**:

- **OS**: Windows 10+, macOS 10.15+, Ubuntu 18.04+
- **CPU**: 2 cores
- **RAM**: 4GB (8GB recommended)
- **Disk**: 10GB free space (each project requires ~2-3GB)

### Required Software

1. **Docker Desktop** or **Docker Engine** (20.10+)
   - [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Ensure Docker is running before launching MoodleBox

2. **Node.js** 18+ (for development only)
   - [Download Node.js](https://nodejs.org/)

---

## 🚀 Installation

### Option 1: Download Pre-built Binaries (Recommended)

Download the latest release for your platform:

- **Windows**: `moodlebox-{version}-setup.exe`
- **macOS**: `moodlebox-{version}.dmg`
- **Linux**: `moodlebox-{version}.AppImage` or `.deb`

> _Note: Releases coming soon on GitHub Releases page_

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/ezadevbox.git
cd ezadevbox

# Install dependencies
npm install

# Run in development mode
npm run dev

# Or build for your platform
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
```

---

## ⚡ Quick Start

### Step 1: Ensure Docker is Running

Before launching MoodleBox, make sure Docker Desktop is running. The app will detect if Docker is unavailable and display clear instructions.

### Step 2: Launch MoodleBox

Open the MoodleBox application.

### Step 3: Configure Settings (Optional)

Click the **Settings** button (gear icon) in the Speed Dial FAB to:

- Choose your preferred theme (dark/light)
- Set workspace folder for project storage
- Configure phpMyAdmin port (default: 8081)

### Step 4: Create Your First Project

1. Click the **Add Project** button (+ icon) in the Speed Dial FAB
2. Enter a project name (e.g., "My Moodle Project")
3. Select Moodle version from dropdown (e.g., "5.1 - Development")
4. Review auto-selected PHP and MySQL versions
5. Click **Create Project**

### Step 5: Wait for Installation

- **First Run**: Installation takes ~3-5 minutes
  - Downloads Moodle source
  - Creates Docker containers
  - Runs Moodle installation
  - Restores sample course
- Progress bar shows real-time status

### Step 6: Open Moodle

Once the project status shows **"Ready"**, click:

- **Open Moodle** - Access your Moodle site at `http://localhost:{port}`
- **Open phpMyAdmin** - Manage database at `http://localhost:8081`
- **Open Folder** - Browse project files

### Step 7: Login

Use the default credentials:

- **Username**: `admin`
- **Password**: `admin`

---

## 📖 Usage

### Managing Projects

#### Start a Project

Click the **Play** button (▶) on the project card. The status will change to "Starting" → "Ready".

#### Stop a Project

Click the **Stop** button (■) on the project card. The status will change to "Stopping" → "Stopped".

#### Delete a Project

1. Click the **Delete** button (🗑) on the project card
2. Confirm deletion in the styled dialog
3. All project files and Docker containers will be removed

#### Open Project Resources

- **Open Moodle**: Launches Moodle site in your default browser
- **Open phpMyAdmin**: Launches database management tool in browser
- **Open Folder**: Opens project directory in file explorer

### Project Lifecycle States

| State            | Description                                  | User Action              |
| ---------------- | -------------------------------------------- | ------------------------ |
| **Provisioning** | Creating Docker containers (first run only)  | Wait                     |
| **Installing**   | Running Moodle installation (first run only) | Wait                     |
| **Starting**     | Booting up containers                        | Wait                     |
| **Waiting**      | Health checks in progress                    | Wait                     |
| **Ready**        | Fully operational                            | Click "Open Moodle"      |
| **Stopping**     | Shutting down containers                     | Wait                     |
| **Stopped**      | Containers halted                            | Click "Start" to restart |
| **Error**        | Something went wrong                         | Check error message      |

### Settings Configuration

Access settings via the Speed Dial FAB:

- **Theme**: Toggle between dark and light mode
- **Workspace Folder**: Choose where projects are stored (default: `~/MoodleBoxProjects`)
- **phpMyAdmin Port**: Customize the phpMyAdmin port (default: 8081)

---

## 🏗️ Project Structure

```
ezadevbox/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts            # Main entry point
│   │   ├── types.ts            # TypeScript type definitions
│   │   └── services/           # Core services
│   │       ├── docker-service.ts      # Docker integration
│   │       ├── download-service.ts    # Moodle download handling
│   │       ├── project-service.ts     # Project CRUD operations
│   │       ├── settings-service.ts    # Settings management
│   │       └── ...
│   ├── preload/                # Preload scripts (IPC bridge)
│   │   ├── index.ts           # IPC API exposure
│   │   └── index.d.ts         # TypeScript definitions
│   └── renderer/              # React frontend
│       ├── src/
│       │   ├── App.tsx        # Main React component
│       │   ├── main.tsx       # React entry point
│       │   ├── components/    # UI components
│       │   │   ├── ProjectCard.tsx
│       │   │   ├── CreateProjectModal.tsx
│       │   │   ├── SettingsModal.tsx
│       │   │   ├── SpeedDialFab.tsx
│       │   │   └── ...
│       │   └── store/         # Zustand state management
│       └── index.html         # HTML entry point
├── assets/
│   ├── icon.png              # App icon
│   └── versions.json         # Moodle version matrix
├── build/                    # Build resources (icons, etc.)
├── out/                      # Build output
├── resources/                # Additional resources
├── electron-builder.yml      # Electron builder config
├── electron.vite.config.ts   # Vite config
├── package.json             # Dependencies and scripts
├── tailwind.config.js       # Tailwind CSS config
├── tsconfig.json            # TypeScript config
├── PRD.md                   # Product Requirements Document
└── README.md                # This file
```

### Key Technologies

| Layer              | Technology            | Purpose                         |
| ------------------ | --------------------- | ------------------------------- |
| Desktop Framework  | Electron 38+          | Cross-platform desktop app      |
| Frontend           | React 19 + TypeScript | UI components                   |
| Build Tool         | Vite 7                | Fast development and bundling   |
| UI Components      | shadcn/ui             | Pre-built accessible components |
| Styling            | Tailwind CSS 3.4      | Utility-first CSS framework     |
| State Management   | Zustand               | Lightweight state management    |
| Validation         | Zod                   | Schema validation               |
| Icons              | Lucide React          | Icon library                    |
| Docker Integration | Native Docker API     | Container management            |
| Storage            | electron-store        | Persistent local storage        |

---

## 🛠️ Development

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or pnpm
- Docker Desktop running

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will launch in development mode with hot-reload enabled.

### Available Scripts

| Script                | Description                          |
| --------------------- | ------------------------------------ |
| `npm run dev`         | Start development server             |
| `npm run build`       | Build for production (all platforms) |
| `npm run build:win`   | Build for Windows                    |
| `npm run build:mac`   | Build for macOS                      |
| `npm run build:linux` | Build for Linux                      |
| `npm run typecheck`   | Run TypeScript type checking         |
| `npm run lint`        | Run ESLint                           |
| `npm run format`      | Format code with Prettier            |

### Development Workflow

1. **Make changes** to code in `src/`
2. **Hot reload** automatically updates the app
3. **Test changes** in the running app
4. **Run type checks**: `npm run typecheck`
5. **Lint code**: `npm run lint`
6. **Format code**: `npm run format`
7. **Commit changes** with clear commit messages

### Debugging

#### Main Process (Electron Backend)

- Use Chrome DevTools: `Menu → View → Toggle Developer Tools`
- Add breakpoints in `src/main/` files
- Console logs appear in terminal running `npm run dev`

#### Renderer Process (React Frontend)

- Use Chrome DevTools: `Menu → View → Toggle Developer Tools`
- Use React Developer Tools browser extension
- Console logs appear in DevTools Console

---

## 📦 Building

### Build for Your Platform

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### Build Output

Built applications are located in:

- **Windows**: `out/moodlebox-{version}-setup.exe`
- **macOS**: `out/moodlebox-{version}.dmg`
- **Linux**: `out/moodlebox-{version}.AppImage`, `.deb`, `.snap`

### Distribution

Upload built files to GitHub Releases for distribution.

---

## ⚙️ Configuration

### Workspace Folder

By default, projects are stored in:

- **Windows**: `C:\Users\{username}\MoodleBoxProjects`
- **macOS/Linux**: `~/MoodleBoxProjects`

Change this in **Settings → Workspace Folder**.

### Project Structure (Per Project)

Each project creates the following structure:

```
{workspace}/{project-name}/
├── moodle_code/          # Moodle source code
├── moodledata/           # Moodle data directory
├── mysql_data/           # MySQL database files
├── docker-compose.yml    # Docker configuration
└── .project-config.json  # Project metadata
```

### Moodle Version Matrix

The `assets/versions.json` file defines supported Moodle versions and their requirements:

```json
{
  "latest_update": "2025-11-21",
  "releases": [
    {
      "version": "5.1",
      "type": "dev",
      "requirements": {
        "php": "8.3",
        "mysql": "8.0"
      },
      "docker_images": {
        "moodle_base": "moodlehq/moodle-php-apache:8.3",
        "db": "mysql:8.0"
      },
      "download_url": "https://github.com/moodle/moodle/archive/master.zip",
      "webroot": "public"
    }
  ]
}
```

To add a new Moodle version, update this file and rebuild the app.

---

## 🐛 Troubleshooting

### Docker Not Running

**Error**: "Docker is not running. Please start Docker Desktop and try again."

**Solution**:

1. Ensure Docker Desktop is installed from [docker.com](https://docker.com)
2. Launch Docker Desktop and wait for it to fully start (check system tray/menu bar)
3. Verify Docker is running: Open terminal and run `docker info`
4. Click "Retry Connection" in MoodleBox
5. On Linux, ensure Docker service is running: `sudo systemctl start docker`

### Port Already in Use

**Error**: "Port 8080 is already in use"

**Solution**:

1. **Find what's using the port**:
   - **macOS/Linux**: `lsof -i :8080` or `netstat -an | grep 8080`
   - **Windows**: `netstat -ano | findstr :8080`
2. Stop the conflicting service or choose a different port
3. When creating a project, use a port like 8082, 8083, etc.
4. Ports below 1024 require root privileges - use ports 1024-65535

### Project Stuck in "Installing" State

**Issue**: Project shows "Installing" for more than 10 minutes

**Solution**:

1. **Check Docker Desktop** is running properly and has sufficient resources
2. **View project logs**: Click "View Logs" button on the project card
3. **Check disk space**: Projects require 2-3GB each (Moodle source + database)
4. **Check internet connection**: Moodle download may be slow on poor connections
5. **Restart project**: Stop and start again (downloads are resumable)
6. **Check Docker logs manually**:
   ```bash
   cd ~/Documents/MoodleBox/{project-name}
   docker compose logs moodle
   docker compose logs db
   ```

### Download Fails or Times Out

**Error**: "Download timed out" or "Failed to download Moodle"

**Solution**:

1. **Check internet connection**: Moodle downloads are 100-200MB+
2. **Retry automatically**: Downloads support resume - just retry the operation
3. **Check GitHub status**: Visit [status.github.com](https://www.githubstatus.com/)
4. **Slow connections**: Downloads may take 20-30+ minutes on slow connections
5. **Partial downloads**: The app preserves partial downloads for automatic resume
6. **Firewall/Proxy**: Ensure GitHub is accessible, configure Docker proxy if needed

### MySQL Container Fails to Start

**Error**: "MySQL healthcheck failed" or "Database connection error"

**Solution**:

1. **Check Docker memory**: Ensure Docker Desktop has 4GB+ RAM allocated
2. **Delete corrupted database**: 
   ```bash
   cd ~/Documents/MoodleBox/{project-name}
   rm -rf mysql_data/
   ```
   Then restart the project
3. **Check MySQL logs**: `docker compose logs db`
4. **Port conflict**: Ensure database port (default 3306) isn't in use
5. **Disk space**: Ensure sufficient disk space for MySQL data files

### Moodle Shows "Error establishing a database connection"

**Solution**:

1. **Wait for MySQL**: Healthcheck can take 30-60 seconds on first start
2. **Check container status**: Ensure `db` container is healthy
3. **View logs**: Check project logs for database connection errors
4. **Restart project**: Stop and start again
5. **Verify credentials**: Check `docker-compose.yml` for correct database password

### Project Won't Start

**Error**: "Failed to start project" or containers won't start

**Solution**:

1. **Check Docker daemon**: Ensure Docker Desktop is fully started
2. **Check port conflicts**: Another project or service may be using the port
3. **Check disk space**: Ensure sufficient space for containers
4. **View error message**: Check the error message in the project card
5. **Check Docker Desktop logs**: Look for errors in Docker Desktop
6. **Restart Docker Desktop**: Sometimes a restart fixes issues
7. **Check permissions**: On Linux, ensure user is in docker group

### App Won't Launch

**Issue**: Application crashes on startup or won't open

**Solution**:

1. **Check system requirements**: 
   - macOS 10.15+, Windows 10+, or Linux with recent kernel
   - Node.js 18+ (if running from source)
2. **Update Docker Desktop** to latest version
3. **Clear app data** (this will reset all projects and settings):
   - **Windows**: `%APPDATA%\moodlebox`
   - **macOS**: `~/Library/Application Support/moodlebox`
   - **Linux**: `~/.config/moodlebox`
4. **Check log files**: 
   - Logs are stored in `{workspace}/.moodlebox/logs/main.log`
   - Click "Open Log Folder" in Settings
5. **Reinstall the application**: Download latest release from GitHub

### Permission Errors (Linux)

**Error**: "Permission denied" when accessing Docker

**Solution**:

1. **Add user to docker group**:
   ```bash
   sudo usermod -aG docker $USER
   ```
2. **Log out and back in** (or run `newgrp docker`)
3. **Verify permissions**: `docker info` should work without sudo
4. **Check Docker socket permissions**: `/var/run/docker.sock` should be accessible

### Slow Performance

**Issue**: App is slow or unresponsive

**Solution**:

1. **Check Docker resources**: Allocate more CPU/RAM to Docker Desktop
2. **Close unused projects**: Stop projects you're not using
3. **Check disk I/O**: Ensure SSD for better performance
4. **Reduce project count**: Too many projects can slow down sync operations
5. **Restart Docker Desktop**: Clears cached resources

### Project Status Out of Sync

**Issue**: Project shows wrong status (e.g., "Ready" but containers are stopped)

**Solution**:

1. **Sync states**: Window focus automatically syncs, or restart app
2. **Manual sync**: Restart the app to force a full sync
3. **Check Docker directly**: `docker compose ps` in project folder
4. **Report bug**: If status consistently wrong, report with project logs

---

## ❓ Frequently Asked Questions (FAQ)

### General Questions

**Q: Is MoodleBox free?**

A: Yes! MoodleBox is completely free and open-source under the MIT License.

**Q: Do I need Docker knowledge to use MoodleBox?**

A: No! MoodleBox handles all Docker operations automatically. You just need Docker Desktop installed.

**Q: Can I use MoodleBox for production?**

A: No, MoodleBox is designed for **local development only**. It uses default credentials and development configurations that are not secure for production.

**Q: What Moodle versions are supported?**

A: MoodleBox supports all recent Moodle versions (3.11 LTS, 4.x, 5.x, and daily builds). Check `assets/versions.json` for the full list.

**Q: Can I run multiple projects simultaneously?**

A: Yes! Each project uses different ports, so you can run as many as your system resources allow.

### Technical Questions

**Q: Where are projects stored?**

A: By default, projects are stored in `~/Documents/MoodleBox` (or `C:\Users\{username}\Documents\MoodleBox` on Windows). You can change this in Settings.

**Q: Can I customize PHP/MySQL versions?**

A: PHP and MySQL versions are automatically selected based on Moodle requirements. Advanced customization requires editing `docker-compose.yml` manually.

**Q: How do I access phpMyAdmin?**

A: phpMyAdmin is available at `http://localhost:{port+1}` (e.g., if Moodle is on 8080, phpMyAdmin is on 8081). Default credentials match your project's database password (found in `docker-compose.yml`).

**Q: Can I use my own Moodle source code?**

A: Currently, MoodleBox downloads Moodle from GitHub. To use custom code, you can replace the contents of `moodlecode/` folder after project creation.

**Q: How do I backup a project?**

A: Projects are stored locally. To backup:
1. Stop the project
2. Copy the entire project folder
3. Restore by copying back and creating a new project with the same name/port

**Q: Can I export/import projects?**

A: Project duplication is available. Full export/import is planned for a future release.

### Troubleshooting Questions

**Q: Why is my download so slow?**

A: Moodle downloads are 100-200MB+. On slow connections, this can take 20-30+ minutes. Downloads support automatic resume if interrupted.

**Q: Can I change the default admin password?**

A: Yes! After first login, go to Site Administration → Users → Accounts → Change password. The default is `admin` / `admin`.

**Q: Why does my project keep failing to start?**

A: Common causes:
- Docker Desktop not running
- Port conflicts
- Insufficient disk space
- Docker resource limits too low

Check the error message in the project card for specific guidance.

**Q: How do I completely remove a project?**

A: Use the "Delete" button in the project card. This removes:
- Docker containers and volumes
- Project files and folders
- Project metadata

**Q: Can I recover a deleted project?**

A: No, deletion is permanent. Always backup important projects before deleting.

### Development Questions

**Q: Can I contribute to MoodleBox?**

A: Yes! See the [Contributing](#-contributing) section. We welcome bug reports, feature requests, and pull requests.

**Q: How do I report a bug?**

A: Open an issue on GitHub with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- System information (OS, Docker version, MoodleBox version)
- Log files (if applicable)

**Q: Can I request a feature?**

A: Absolutely! Open a feature request on GitHub explaining the use case and benefits.

---

## 📞 Getting Help

If you're still experiencing issues:

1. **Check this troubleshooting guide** first
2. **Search existing issues** on [GitHub Issues](https://github.com/yourusername/ezadevbox/issues)
3. **View logs**: Settings → Open Log Folder
4. **Create a new issue** with detailed information
5. **Join discussions** on [GitHub Discussions](https://github.com/yourusername/ezadevbox/discussions)

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Reporting Bugs

1. Check if the issue already exists in [GitHub Issues](https://github.com/yourusername/ezadevbox/issues)
2. Create a new issue with:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - System information (OS, Docker version, MoodleBox version)

### Suggesting Features

1. Open a [Feature Request](https://github.com/yourusername/ezadevbox/issues/new)
2. Describe the feature and its use case
3. Explain why it would benefit users

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run typecheck && npm run lint`
5. Commit with clear messages: `git commit -m 'Add amazing feature'`
6. Push to your fork: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Guidelines

- Follow existing code style (use `npm run format`)
- Add TypeScript types for new code
- Update documentation for user-facing changes
- Test on multiple platforms when possible

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Moodle](https://moodle.org/) - The open-source LMS that powers education worldwide
- [Electron](https://www.electronjs.org/) - Framework for building cross-platform desktop apps
- [Docker](https://www.docker.com/) - Container platform that makes environments portable
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful, accessible UI components
- All contributors and community members who make this project possible

---

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/yourusername/ezadevbox/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/ezadevbox/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/ezadevbox/discussions)
- **Email**: support@moodlebox.dev

---

## 🗺️ Roadmap

See the [PRD.md](PRD.md) for detailed product roadmap and planned features.

**Current Status**: MVP Development (v1.0)

**Upcoming Releases**:

- **v1.1**: PHP version switcher, custom ports
- **v1.2**: Xdebug integration, email capture
- **v2.0**: PHPUnit/Behat setup, plugin generator
- **v3.0**: Backup/restore, cloud sync, templates

---

<div align="center">

**Made with ❤️ by the MoodleBox Team**

[⭐ Star us on GitHub](https://github.com/yourusername/ezadevbox) | [🐛 Report Bug](https://github.com/yourusername/ezadevbox/issues) | [💡 Request Feature](https://github.com/yourusername/ezadevbox/issues)

</div>
