import { useEffect, useState, useMemo } from 'react'
import { useProjectStore } from '../store/project-store'
import { ProjectCard } from './ProjectCard'
import { SettingsModal } from './SettingsModal'
import { AboutModal } from './AboutModal'
import {
  Plus,
  Sliders,
  CircleQuestionMark,
  AlertTriangle,
  RefreshCw,
  Search,
  X
} from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { cn } from '../lib/utils'

const EMPTY_STEPS = [
  { title: 'Name it', detail: 'Pick a Moodle version and a port.' },
  { title: 'Start it', detail: 'Docker runs Moodle with PHP, MySQL and phpMyAdmin.' },
  {
    title: 'Sign in',
    detail: (
      <>
        Open <span className="font-mono text-ink">localhost:&lt;port&gt;</span> and log in as{' '}
        <span className="font-mono text-ink">admin / admin</span>.
      </>
    )
  }
]

interface DashboardProps {
  onNewProject: () => void
}

export function Dashboard({ onNewProject }: DashboardProps): React.JSX.Element {
  const projects = useProjectStore((state) => state.projects)
  const loadProjects = useProjectStore((state) => state.loadProjects)
  const [dockerError, setDockerError] = useState(false)
  const [isCheckingDocker, setIsCheckingDocker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
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

  const hasFilters = Boolean(searchQuery) || statusFilter !== 'all' || versionFilter !== 'all'

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-ink bg-paper" role="banner">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-4 px-6">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="font-display text-2xl font-semibold leading-none tracking-display">
              MoodleDocks
            </h1>
            <p className="truncate text-sm text-muted-foreground">Local Moodle Environment</p>
          </div>
          {!dockerError && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowSettings(true)}
                aria-label="Settings"
                title="Settings"
              >
                <Sliders aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowAbout(true)}
                aria-label="About MoodleDocks"
                title="About MoodleDocks"
              >
                <CircleQuestionMark aria-hidden="true" />
              </Button>
              {projects.length > 0 && (
                <Button onClick={onNewProject} title="New Project (Ctrl or Cmd + N)">
                  <Plus aria-hidden="true" />
                  New Project
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="custom-scrollbar min-h-0 flex-1 overflow-y-auto" role="main">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-6 pb-16 pt-10">
          {dockerError ? (
            <section className="max-w-xl" aria-labelledby="docker-error-title">
              <div className="overflow-hidden rounded-entry bg-paper-2 shadow-lift ring-1 ring-ink">
                <div className="flex items-center gap-2 bg-head px-5 py-3 text-sm font-medium text-head-ink">
                  <AlertTriangle className="h-4 w-4 text-signal" aria-hidden="true" />
                  Docker
                </div>
                <div className="flex flex-col gap-4 p-6">
                  <h2
                    id="docker-error-title"
                    className="font-display text-3xl font-semibold leading-none tracking-display"
                  >
                    Docker is not running
                  </h2>
                  <p className="text-muted-foreground">
                    MoodleDocks requires Docker Desktop to create and manage local Moodle
                    environments. Please start Docker Desktop and try again.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <Button
                      onClick={checkDocker}
                      disabled={isCheckingDocker}
                      aria-busy={isCheckingDocker}
                    >
                      <RefreshCw
                        className={cn(
                          isCheckingDocker && 'animate-spin motion-reduce:animate-none'
                        )}
                        aria-hidden="true"
                      />
                      {isCheckingDocker ? 'Checking…' : 'Retry Connection'}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Don&apos;t have Docker?{' '}
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          window.open('https://docker.com')
                        }}
                        className="font-medium text-ink underline decoration-signal decoration-2 underline-offset-4 hover:decoration-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        Download Docker Desktop
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : projects.length === 0 ? (
            <section
              className="my-auto grid items-center gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]"
              aria-labelledby="empty-title"
            >
              <div className="min-w-0">
                <h2
                  id="empty-title"
                  className="font-display text-4xl font-semibold leading-none tracking-display [overflow-wrap:break-word]"
                >
                  No projects yet
                </h2>
                <p className="mt-4 max-w-sm text-muted-foreground">
                  Create your first Moodle project to get started. It takes less than 5 minutes.
                </p>
                <Button onClick={onNewProject} className="mt-8">
                  <Plus aria-hidden="true" />
                  Create Your First Project
                </Button>
              </div>

              <div className="overflow-hidden rounded-entry bg-sheet shadow-lift ring-1 ring-rule dark:notebook dark:ring-ink">
                <p className="bg-head px-5 py-3 text-sm font-medium text-head-ink">
                  How a project starts
                </p>
                <ol>
                  {EMPTY_STEPS.map((step, index) => (
                    <li
                      key={step.title}
                      className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-2 border-t border-rule px-5 py-4 first:border-t-0"
                    >
                      <span className="font-mono text-sm text-signal">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <p className="font-medium text-ink">{step.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ) : (
            <section aria-labelledby="projects-title">
              <div className="mb-6 flex items-baseline justify-between gap-4">
                <h2
                  id="projects-title"
                  className="font-display text-3xl font-semibold leading-none tracking-display"
                >
                  Active Projects
                </h2>
                <span className="text-sm text-muted-foreground">
                  <span className="font-mono">{projects.length}</span>{' '}
                  {projects.length === 1 ? 'Project' : 'Projects'}
                </span>
              </div>

              <div className="mb-8 flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    placeholder="Search projects by name…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-10"
                    aria-label="Search projects"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 active:-translate-y-[calc(50%-1px)]"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="sm:w-44" aria-label="Filter by status">
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
                  <SelectTrigger className="sm:w-44" aria-label="Filter by version">
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

              {filteredProjects.length === 0 ? (
                <div className="border-t border-ink py-10">
                  <p className="text-muted-foreground">No projects match your filters.</p>
                  {hasFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
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
                <div className="border-t border-ink">
                  {filteredProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  )
}
