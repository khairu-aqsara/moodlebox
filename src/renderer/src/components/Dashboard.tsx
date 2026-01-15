import { useEffect, useState, useMemo } from 'react'
import { useProjectStore } from '../store/project-store'
import { ProjectCard } from './ProjectCard'
import { SettingsModal } from './SettingsModal'
import { Plus, Settings, Sliders, AlertTriangle, RefreshCw, Search, X } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { cn } from '../lib/utils'

interface DashboardProps {
  onNewProject: () => void
}

export function Dashboard({ onNewProject }: DashboardProps): React.JSX.Element {
  const projects = useProjectStore((state) => state.projects)
  const loadProjects = useProjectStore((state) => state.loadProjects)
  const [isFabOpen, setIsFabOpen] = useState(false)
  const [dockerError, setDockerError] = useState(false)
  const [isCheckingDocker, setIsCheckingDocker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [versionFilter, setVersionFilter] = useState<string>('all')

  const checkDocker = async (): Promise<void> => {
    // Prevent multiple simultaneous checks
    if (isCheckingDocker) return

    setIsCheckingDocker(true)
    try {
      const isRunning = await window.api.projects.checkDocker()
      setDockerError(!isRunning)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error('Docker check failed:', errorMessage)
      setDockerError(true)
    } finally {
      setIsCheckingDocker(false)
    }
  }

  useEffect(() => {
    loadProjects()
    checkDocker()

    // Sync project states when window gains focus
    // This handles case where Docker was started after app launch
    // or containers were started/stopped outside the app
    // Note: syncStates() is now debounced on backend, so multiple calls are safe
    const syncOnFocus = async (): Promise<void> => {
      try {
        await window.api.projects.syncStates()
        await loadProjects() // Reload to get updated states
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        console.warn('Failed to sync project states on focus:', errorMessage)
        // Non-critical - sync happens on startup anyway
      }
    }

    // Debounce Docker check and sync on focus to avoid excessive checks
    let focusTimeout: NodeJS.Timeout | null = null
    const onFocus = (): void => {
      if (focusTimeout) {
        clearTimeout(focusTimeout)
      }
      focusTimeout = setTimeout(() => {
        checkDocker()
        syncOnFocus()
      }, 500) // Debounce by 500ms
    }

    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      if (focusTimeout) {
        clearTimeout(focusTimeout)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleFab = (): void => setIsFabOpen(!isFabOpen)

  // Memoize filtered projects - must be at top level, not conditional
  const filteredProjects = useMemo(() => {
    let filtered = projects

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.moodleVersion.toLowerCase().includes(query) ||
          p.path.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter)
    }

    // Version filter
    if (versionFilter !== 'all') {
      filtered = filtered.filter((p) => p.moodleVersion === versionFilter)
    }

    return filtered
  }, [projects, searchQuery, statusFilter, versionFilter])

  return (
    <div className="flex flex-col h-full relative">
      {/* Modern Glassmorphic Header */}
      <header
        className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
        role="banner"
      >
        <div className="flex h-16 items-center px-6">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-xl font-bold tracking-tight">MoodleBox</h1>
            <p className="text-xs text-muted-foreground font-medium">Local Moodle Environment</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden flex flex-col px-4 py-6 pb-32" role="main">
        {dockerError ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <div className="max-w-md">
              <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/15">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-destructive">Docker is not running</h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                MoodleBox requires Docker Desktop to create and manage local Moodle environments.
                <br />
                Please start Docker Desktop and try again.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={checkDocker}
                  disabled={isCheckingDocker}
                  size="lg"
                  className="rounded-full"
                >
                  <RefreshCw className={cn('mr-2 h-5 w-5', isCheckingDocker && 'animate-spin')} />
                  {isCheckingDocker ? 'Checking...' : 'Retry Connection'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Don&apos;t have Docker?{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      window.open('https://docker.com')
                    }}
                    className="text-primary hover:underline"
                  >
                    Download Docker Desktop
                  </a>
                </p>
              </div>
            </div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <div className="max-w-md">
              <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
              <p className="text-muted-foreground mb-6">
                Create your first Moodle project to get started. It takes less than 5 minutes!
              </p>
              <Button onClick={onNewProject} size="lg" className="rounded-full">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Project
              </Button>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto flex flex-col h-full w-full">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h2 className="text-lg font-semibold tracking-tight">Active Projects</h2>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
              </span>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6 flex-shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search projects by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                  aria-label="Search projects"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]" aria-label="Filter by status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="stopped">Stopped</SelectItem>
                  <SelectItem value="starting">Starting</SelectItem>
                  <SelectItem value="installing">Installing</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
              <Select value={versionFilter} onValueChange={setVersionFilter}>
                <SelectTrigger className="w-[180px]" aria-label="Filter by version">
                  <SelectValue placeholder="All Versions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Versions</SelectItem>
                  {Array.from(new Set(projects.map((p) => p.moodleVersion)))
                    .sort()
                    .reverse()
                    .map((version) => (
                      <SelectItem key={version} value={version}>
                        Moodle {version}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtered Projects */}
            <div className="flex-1 min-h-0">
              {filteredProjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No projects match your filters.</p>
                  {(searchQuery || statusFilter !== 'all' || versionFilter !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setSearchQuery('')
                        setStatusFilter('all')
                        setVersionFilter('all')
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-y-auto overflow-x-hidden h-full custom-scrollbar">
                  <div className="grid gap-4 pr-2">
                    {filteredProjects.map((project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Speed Dial FAB */}
      {!dockerError && (
        <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
          {/* Menu Items */}
          <div
            className={cn(
              'flex flex-col items-end gap-3 transition-all duration-300 ease-in-out',
              isFabOpen
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium bg-background/90 backdrop-blur px-2 py-1 rounded-md shadow-sm border border-border/50">
                Settings
              </span>
              <Button
                size="icon"
                variant="secondary"
                className="h-10 w-10 rounded-full shadow-md [&_svg]:size-4"
                onClick={() => {
                  setIsFabOpen(false)
                  setShowSettings(true)
                }}
              >
                <Sliders className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-medium bg-background/90 backdrop-blur px-2 py-1 rounded-md shadow-sm border border-border/50">
                New Project
              </span>
              <Button
                size="icon"
                className="h-10 w-10 rounded-full shadow-md [&_svg]:size-4"
                onClick={() => {
                  setIsFabOpen(false)
                  onNewProject()
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Main Trigger Button */}
          <Button
            size="icon"
            className={cn(
              'h-14 w-14 rounded-full shadow-lg transition-transform duration-300 [&_svg]:size-6',
              isFabOpen ? 'rotate-90' : 'rotate-0'
            )}
            onClick={toggleFab}
          >
            <Settings className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
