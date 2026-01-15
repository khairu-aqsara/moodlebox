import { memo, useState, useCallback, useMemo } from 'react'
import { Project } from '../types'
import {
  Play,
  Square,
  Trash2,
  FolderOpen,
  ExternalLink,
  RefreshCw,
  Database,
  FileText
} from 'lucide-react'
import { useProjectStore } from '../store/project-store'
import { useSettingsStore } from '../store/settings-store'
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

const STATUS_CONFIG: Record<Project['status'], { color: string; symbol: string; text: string }> = {
  ready: { color: 'text-green-500', symbol: '✓', text: 'Running' },
  stopped: { color: 'text-muted-foreground', symbol: '◯', text: 'Stopped' },
  provisioning: { color: 'text-yellow-500', symbol: '◯', text: 'Provisioning' },
  installing: { color: 'text-yellow-500', symbol: '◯', text: 'Installing' },
  starting: { color: 'text-yellow-500', symbol: '◯', text: 'Starting' },
  waiting: { color: 'text-yellow-500', symbol: '◯', text: 'Waiting' },
  stopping: { color: 'text-yellow-500', symbol: '◯', text: 'Stopping' },
  deleting: { color: 'text-red-500', symbol: '◯', text: 'Deleting' },
  error: { color: 'text-red-500', symbol: '⚠️', text: 'Error' }
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
  const phpMyAdminPort = useSettingsStore((state) => state.phpMyAdminPort)

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
    window.open(`http://localhost:${phpMyAdminPort}`, '_blank')
  }, [phpMyAdminPort])

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

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <div
          className="border-b last:border-b-0 px-6 py-5 hover:bg-accent/50 transition-colors"
          role="article"
          aria-label={`Project ${project.name}, Moodle version ${project.moodleVersion}, status ${statusConfig.text}`}
        >
          <span
            aria-live="polite"
            aria-atomic="true"
            className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0"
          >
            Project {project.name} is {statusConfig.text}
          </span>
          <div className="flex items-start justify-between gap-4">
            {/* Left: Project Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-lg ${statusConfig.color}`} aria-hidden="true">
                  {statusConfig.symbol}
                </span>
                <h3 className="font-semibold text-base truncate">
                  {project.name}{' '}
                  <span className="text-sm text-muted-foreground font-normal">
                    (Moodle {project.moodleVersion})
                  </span>
                </h3>
              </div>

              <div className="flex flex-col gap-2 text-sm">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  <div>
                    <span className="font-medium">Status:</span> {statusConfig.text}
                  </div>
                  {project.status === 'ready' && (
                    <>
                      <div>
                        <span className="font-medium">URL:</span>{' '}
                        <button
                          onClick={handleOpenBrowser}
                          className="text-primary hover:underline"
                        >
                          localhost:{project.port}
                        </button>
                      </div>
                      <div>
                        <span className="font-medium">Admin:</span> admin / admin
                      </div>
                    </>
                  )}
                  {project.status === 'stopped' && lastUsedDate && (
                    <div>
                      <span className="font-medium">Last used:</span> {lastUsedDate}
                    </div>
                  )}
                </div>

                {/* Status detail message - only show when progress is not available */}
                {project.statusDetail &&
                  !project.progress &&
                  project.status !== 'error' &&
                  project.status !== 'stopped' && (
                    <div className="text-sm text-muted-foreground italic">
                      {project.statusDetail}
                    </div>
                  )}

                {/* Progress bar */}
                {project.progress && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {project.progress.message ||
                          (project.progress.percentage !== undefined
                            ? `${project.progress.percentage.toFixed(0)}%`
                            : 'Downloading...')}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      {project.progress.percentage !== undefined ? (
                        <div
                          className="bg-primary h-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(0, project.progress.percentage))}%`
                          }}
                        />
                      ) : (
                        // Indeterminate progress bar (animated pulse at 50% to indicate unknown progress)
                        <div className="bg-primary h-full animate-pulse" style={{ width: '50%' }} />
                      )}
                    </div>
                  </div>
                )}

                {/* Error message */}
                {project.status === 'error' && project.errorMessage && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md p-3 mt-1">
                    <div className="flex items-start gap-2">
                      <span className="text-red-500 text-lg flex-shrink-0 mt-0.5">⚠️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap font-medium">
                          {project.errorMessage}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {project.status === 'stopped' ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={handleStart}
                      size="icon"
                      variant="outline"
                      aria-label={`Start project ${project.name}`}
                    >
                      <Play className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Start Project</TooltipContent>
                </Tooltip>
              ) : project.status === 'ready' ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleOpenBrowser} size="icon" variant="outline">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open Moodle</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleOpenPhpMyAdmin} size="icon" variant="outline">
                        <Database className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open phpMyAdmin</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleStop} size="icon" variant="outline">
                        <Square className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Stop Project</TooltipContent>
                  </Tooltip>
                </>
              ) : project.status === 'error' ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={handleStart} size="icon" variant="outline">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Retry</TooltipContent>
                </Tooltip>
              ) : project.status === 'stopping' || project.status === 'deleting' ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button disabled size="icon" variant="outline">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {project.status === 'stopping' ? 'Stopping...' : 'Deleting...'}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button disabled size="icon" variant="outline">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Processing...</TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleOpenFolder}
                    size="icon"
                    variant="outline"
                    disabled={project.status === 'deleting'}
                  >
                    <FolderOpen className="h-4 w-4" />
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
                    <Button onClick={handleViewLogs} size="icon" variant="outline">
                      <FileText className="h-4 w-4" />
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
                  >
                    <Trash2 className="h-4 w-4" />
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
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Loading logs...</span>
              </div>
            ) : (
              <div className="relative flex-1 min-h-0 border border-border rounded-lg bg-muted/50 overflow-hidden flex flex-col">
                <div className="absolute top-2 right-2 z-10">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(logs || '')
                    }}
                    className="h-7 text-xs bg-background/80 backdrop-blur-sm"
                  >
                    Copy
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0">
                  <pre className="text-sm font-mono whitespace-pre-wrap break-words leading-relaxed text-foreground">
                    {logs || 'No logs available'}
                  </pre>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="px-6 pb-6 pt-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setLogsDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleViewLogs} disabled={logsLoading} variant="secondary">
              <RefreshCw className={`h-4 w-4 mr-2 ${logsLoading ? 'animate-spin' : ''}`} />
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
