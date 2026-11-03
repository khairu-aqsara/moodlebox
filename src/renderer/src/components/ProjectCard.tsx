import { memo, useState, useCallback, useMemo } from 'react'
import { Project } from '../types'
import {
  AlertTriangle,
  Play,
  Square,
  Trash2,
  FolderOpen,
  ExternalLink,
  RefreshCw,
  Database,
  FileText,
  Info
} from 'lucide-react'
import { useProjectStore } from '../store/project-store'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'

interface ProjectCardProps {
  project: Project
}

// The tone decides the status chip: green for a running site, tangerine while work is
// under way, red for a failure. No decorative symbols: the word carries the state.
type StatusTone = 'live' | 'idle' | 'busy' | 'fault'

const STATUS_CONFIG: Record<Project['status'], { tone: StatusTone; text: string }> = {
  ready: { tone: 'live', text: 'Running' },
  stopped: { tone: 'idle', text: 'Stopped' },
  provisioning: { tone: 'busy', text: 'Provisioning' },
  installing: { tone: 'busy', text: 'Installing' },
  starting: { tone: 'busy', text: 'Starting' },
  waiting: { tone: 'busy', text: 'Waiting' },
  stopping: { tone: 'busy', text: 'Stopping' },
  deleting: { tone: 'fault', text: 'Deleting' },
  error: { tone: 'fault', text: 'Error' }
}

// Short labels for the start steps that lifecycle-manager reports in progress.phase.
// Stopping and deleting send no phase, so the row falls back to the status text.
const STEP_LABEL: Record<string, string> = {
  resolve: 'Checking version',
  download: 'Downloading Moodle',
  pull: 'Pulling images',
  containers: 'Starting containers',
  database: 'Waiting for database',
  install: 'Installing Moodle',
  course: 'Restoring course',
  webserver: 'Starting web server'
}

const CHIP_TONE: Record<StatusTone, string> = {
  live: 'bg-green-soft text-green',
  idle: 'bg-paper-3 text-ink-2',
  busy: 'bg-signal-soft text-ink',
  fault: 'bg-danger-soft text-danger'
}

const ProjectCardComponent = ({ project }: ProjectCardProps): React.JSX.Element => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [logsDialogOpen, setLogsDialogOpen] = useState(false)
  const [logs, setLogs] = useState<string>('')
  const [logsLoading, setLogsLoading] = useState(false)
  const startProject = useProjectStore((state) => state.startProject)
  const stopProject = useProjectStore((state) => state.stopProject)
  const deleteProject = useProjectStore((state) => state.deleteProject)
  const openFolder = useProjectStore((state) => state.openFolder)
  const openBrowser = useProjectStore((state) => state.openBrowser)

  const statusConfig = STATUS_CONFIG[project.status]

  const lastUsedDate = useMemo(() => {
    return project.lastUsed ? new Date(project.lastUsed).toLocaleDateString() : null
  }, [project.lastUsed])

  const handleStart = useCallback((): void => {
    startProject(project.id)
  }, [startProject, project.id])

  const handleStop = useCallback(async (): Promise<void> => {
    await stopProject(project.id)
  }, [stopProject, project.id])

  const handleDeleteConfirm = useCallback((): void => {
    deleteProject(project.id)
    setDeleteDialogOpen(false)
  }, [deleteProject, project.id])

  const handleOpenFolder = useCallback((): void => {
    openFolder(project.path)
  }, [openFolder, project.path])

  const handleOpenBrowser = useCallback((): void => {
    openBrowser(project.port)
  }, [openBrowser, project.port])

  const handleOpenPhpMyAdmin = useCallback((): void => {
    window.open(`http://localhost:${project.phpMyAdminPort}`, '_blank')
  }, [project.phpMyAdminPort])

  const handleViewLogs = useCallback(async (): Promise<void> => {
    setLogsDialogOpen(true)
    setLogsLoading(true)
    try {
      const projectLogs = await window.api.projects.getLogs(project.id)
      setLogs(projectLogs)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setLogs(`Error loading logs: ${errorMessage}`)
    } finally {
      setLogsLoading(false)
    }
  }, [project.id])

  const isBusy = statusConfig.tone === 'busy' || project.status === 'deleting'
  const progressPercent =
    project.progress?.percentage !== undefined
      ? Math.round(Math.min(100, Math.max(0, project.progress.percentage)))
      : undefined
  const busyDetail = project.progress?.message || project.statusDetail || `${statusConfig.text}…`

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <div
          className="relative border-b border-rule py-6"
          role="article"
          aria-label={`Project ${project.name}, Moodle version ${project.moodleVersion}, status ${statusConfig.text}`}
        >
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            Project {project.name} is {statusConfig.text}
          </span>
          <div className="flex items-start justify-between gap-6">
            {/* Left: Project Info */}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="min-w-0 truncate font-display text-xl font-semibold leading-tight tracking-display">
                  {project.name}
                </h3>
                <span className="text-sm text-muted-foreground">
                  Moodle <span className="font-mono">{project.moodleVersion}</span>
                </span>
              </div>

              <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {/* While busy, the label names the step; the chip states keep "Status" */}
                  <dt className={isBusy ? 'text-ink-2' : 'text-muted-foreground'}>
                    {isBusy
                      ? (STEP_LABEL[project.progress?.phase ?? ''] ?? statusConfig.text)
                      : 'Status'}
                  </dt>
                  {/* min-h-7 keeps the row height when the chip changes to the progress bar */}
                  <dd className="flex min-h-7 items-center gap-1">
                    {isBusy ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            tabIndex={0}
                            role="progressbar"
                            aria-label={`${statusConfig.text}: ${busyDetail}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progressPercent}
                            className="relative h-1.5 w-32 overflow-hidden rounded-key bg-paper-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                          >
                            {progressPercent !== undefined ? (
                              <div
                                className="h-full w-full origin-left bg-signal transition-transform duration-short ease-out motion-reduce:transition-none"
                                style={{ transform: `scaleX(${progressPercent / 100})` }}
                              />
                            ) : (
                              <div className="absolute inset-y-0 left-0 w-2/5 rounded-key bg-signal animate-indeterminate motion-reduce:animate-none" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{busyDetail}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <>
                        <span
                          className={`rounded-key px-2 py-0.5 font-medium ${CHIP_TONE[statusConfig.tone]}`}
                        >
                          {statusConfig.text}
                        </span>
                        {(project.status === 'ready' ||
                          (project.status === 'error' && project.errorMessage)) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={
                                  project.status === 'ready'
                                    ? 'Site address and login'
                                    : 'Error details'
                                }
                                className="inline-flex h-6 w-6 items-center justify-center rounded-key text-muted-foreground transition-colors duration-micro hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              >
                                <Info className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm px-3 py-2">
                              {project.status === 'ready' ? (
                                <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1">
                                  <dt className="opacity-70">URL</dt>
                                  <dd className="font-mono">http://localhost:{project.port}</dd>
                                  <dt className="opacity-70">Login</dt>
                                  <dd className="font-mono">admin / admin</dd>
                                </dl>
                              ) : (
                                <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                                  {project.errorMessage}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </>
                    )}
                  </dd>
                </div>
                {lastUsedDate && (
                  <div className="flex items-center gap-2">
                    <dt className="text-muted-foreground">Last used</dt>
                    <dd className="font-mono text-ink-2">{lastUsedDate}</dd>
                  </div>
                )}
              </dl>

              {/* One line of the error stays visible; the info icon shows all of it */}
              {project.status === 'error' && project.errorMessage && (
                <p className="mt-2 flex items-start gap-2 text-sm text-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="line-clamp-1 min-w-0">{project.errorMessage}</span>
                </p>
              )}
            </div>

            {/* Right: Action Buttons */}
            <div className="flex shrink-0 items-center gap-2">
              {project.status === 'stopped' ? (
                <Button
                  onClick={handleStart}
                  variant="outline"
                  aria-label={`Start project ${project.name}`}
                >
                  <Play aria-hidden="true" />
                  Start
                </Button>
              ) : project.status === 'ready' ? (
                <>
                  <Button onClick={handleOpenBrowser} variant="outline">
                    <ExternalLink aria-hidden="true" />
                    Open Moodle
                  </Button>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleOpenPhpMyAdmin}
                        size="icon"
                        variant="outline"
                        aria-label="Open phpMyAdmin"
                      >
                        <Database aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open phpMyAdmin</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleStop}
                        size="icon"
                        variant="outline"
                        aria-label="Stop Project"
                      >
                        <Square aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Stop Project</TooltipContent>
                  </Tooltip>
                </>
              ) : project.status === 'error' ? (
                <Button onClick={handleStart} variant="outline">
                  <RefreshCw aria-hidden="true" />
                  Retry
                </Button>
              ) : project.status === 'stopping' || project.status === 'deleting' ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      disabled
                      size="icon"
                      variant="outline"
                      aria-busy="true"
                      aria-label={project.status === 'stopping' ? 'Stopping…' : 'Deleting…'}
                    >
                      <RefreshCw
                        className="animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {project.status === 'stopping' ? 'Stopping…' : 'Deleting…'}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      disabled
                      size="icon"
                      variant="outline"
                      aria-busy="true"
                      aria-label="Processing…"
                    >
                      <RefreshCw
                        className="animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Processing…</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleOpenFolder}
                    size="icon"
                    variant="outline"
                    disabled={project.status === 'deleting'}
                    aria-label="Open Folder"
                  >
                    <FolderOpen aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open Folder</TooltipContent>
              </Tooltip>

              {/* Only show log button when containers are active */}
              {(project.status === 'ready' ||
                project.status === 'starting' ||
                project.status === 'waiting' ||
                project.status === 'installing' ||
                project.status === 'provisioning' ||
                project.status === 'stopping') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleViewLogs}
                      size="icon"
                      variant="outline"
                      aria-label="View Logs"
                    >
                      <FileText aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View Logs</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setDeleteDialogOpen(true)}
                    size="icon"
                    variant="outline"
                    disabled={project.status === 'deleting' || project.status === 'stopping'}
                    aria-label="Delete Project"
                    className="hover:text-danger"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Project</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </TooltipProvider>

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-3xl w-[90vw] h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle>Docker Logs - {project.name}</DialogTitle>
            <DialogDescription>Container logs for debugging and troubleshooting</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-4 overflow-hidden flex flex-col">
            {logsLoading ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw
                  className="h-5 w-5 animate-spin text-muted-foreground motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <span className="ml-3 text-muted-foreground">Loading logs…</span>
              </div>
            ) : (
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-card bg-paper-3">
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(logs || '')
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pr-24">
                  <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-ink">
                    {logs || 'No logs available'}
                  </pre>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0 border-t border-rule px-6 pb-6 pt-4">
            <Button onClick={() => setLogsDialogOpen(false)}>Close</Button>
            <Button onClick={handleViewLogs} disabled={logsLoading} variant="outline">
              <RefreshCw
                className={logsLoading ? 'animate-spin motion-reduce:animate-none' : ''}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{project.name}&quot;? This action cannot be
              undone and will remove all project files.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export const ProjectCard = memo(ProjectCardComponent)
