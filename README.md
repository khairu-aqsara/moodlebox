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

| State | Description | User Action |
|-------|-------------|-------------|
| **Provisioning** | Creating Docker containers (first run only) | Wait |
| **Installing** | Running Moodle installation (first run only) | Wait |
| **Starting** | Booting up containers | Wait |
| **Waiting** | Health checks in progress | Wait |
| **Ready** | Fully operational | Click "Open Moodle" |
| **Stopping** | Shutting down containers | Wait |
| **Stopped** | Containers halted | Click "Start" to restart |
| **Error** | Something went wrong | Check error message |

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

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Desktop Framework | Electron 38+ | Cross-platform desktop app |
| Frontend | React 19 + TypeScript | UI components |
| Build Tool | Vite 7 | Fast development and bundling |
| UI Components | shadcn/ui | Pre-built accessible components |
| Styling | Tailwind CSS 3.4 | Utility-first CSS framework |
| State Management | Zustand | Lightweight state management |
| Validation | Zod | Schema validation |
| Icons | Lucide React | Icon library |
| Docker Integration | Native Docker API | Container management |
| Storage | electron-store | Persistent local storage |

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

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production (all platforms) |
| `npm run build:win` | Build for Windows |
| `npm run build:mac` | Build for macOS |
| `npm run build:linux` | Build for Linux |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

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
1. Ensure Docker Desktop is installed
2. Launch Docker Desktop and wait for it to fully start
3. Click "Retry Connection" in MoodleBox

### Port Already in Use

**Error**: "Port 8080 is already in use"

**Solution**:
1. Stop any services using port 8080
2. Or modify the port in `docker-compose.yml` (advanced users)
3. Restart the project

### Project Stuck in "Installing" State

**Issue**: Project shows "Installing" for more than 10 minutes

**Solution**:
1. Check Docker Desktop is running properly
2. View Docker logs: `docker logs {container-name}`
3. Stop and recreate the project
4. Check disk space (projects require 2-3GB each)

### MySQL Container Fails to Start

**Error**: "MySQL healthcheck failed"

**Solution**:
1. Ensure MySQL 8.4+ is used (check `versions.json`)
2. Delete `mysql_data/` folder in project directory
3. Restart project to recreate database
4. Check Docker Desktop has sufficient memory allocated (4GB+)

### Moodle Shows "Error establishing a database connection"

**Solution**:
1. Wait for MySQL healthcheck to pass (can take 30-60 seconds)
2. Check `docker-compose.yml` for correct database credentials
3. Restart the project

### App Won't Launch

**Issue**: Application crashes on startup

**Solution**:
1. Check system meets minimum requirements
2. Update Docker Desktop to latest version
3. Delete app data:
   - **Windows**: `%APPDATA%\moodlebox`
   - **macOS**: `~/Library/Application Support/moodlebox`
   - **Linux**: `~/.config/moodlebox`
4. Reinstall the application

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
