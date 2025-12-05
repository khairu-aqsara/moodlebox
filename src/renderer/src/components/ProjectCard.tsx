import { Project } from '../types'
import { Play, Square, Trash2, FolderOpen, ExternalLink, RefreshCw, Database, FileText } from 'lucide-react'
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
import { useState } from 'react'

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

export function ProjectCard({ project }: ProjectCardProps) {
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

  const handleViewLogs = async () => {
    setLogsDialogOpen(true)
    setLogsLoading(true)
    try {
      const projectLogs = await window.api.projects.getLogs(project.id)
      setLogs(projectLogs)
    } catch (error: any) {
      setLogs(`Error loading logs: ${error.message || 'Unknown error'}`)
    } finally {
      setLogsLoading(false)
    }
  }

  const statusConfig = STATUS_CONFIG[project.status]

  const handleStart = () => startProject(project.id)
  const handleStop = async () => {
    await stopProject(project.id)
  }
  const handleDeleteConfirm = () => {
    deleteProject(project.id)
    setDeleteDialogOpen(false)
  }
  const handleOpenFolder = () => openFolder(project.path)
  const handleOpenBrowser = () => openBrowser(project.port)
  const handleOpenPhpMyAdmin = () => {
    window.open(`http://localhost:${phpMyAdminPort}`, '_blank')
  }

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <div 
          className="border-b last:border-b-0 px-6 py-5 hover:bg-accent/50 transition-colors"
          role="article"
          aria-label={`Project ${project.name}, Moodle version ${project.moodleVersion}, status ${statusConfig.text}`}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Left: Project Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-lg ${statusConfig.color}`} aria-hidden="true">{statusConfig.symbol}</span>
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
                  {project.status === 'stopped' && project.lastUsed && (
                    <div>
                      <span className="font-medium">Last used:</span>{' '}
                      {new Date(project.lastUsed).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Status detail message */}
                {project.statusDetail &&
                  project.status !== 'error' &&
                  project.status !== 'stopped' && (
                    <div className="text-sm text-muted-foreground italic">
                      {project.statusDetail}
                    </div>
                  )}

                {/* Progress bar */}
                {project.progress && project.progress.percentage !== undefined && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {project.progress.message || `${project.progress.percentage.toFixed(0)}%`}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-full transition-all duration-300"
                        style={{ width: `${project.progress.percentage}%` }}
                      />
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
                      <Button onClick={handleViewLogs} size="icon" variant="outline">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>View Logs</TooltipContent>
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

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleViewLogs}
                    size="icon"
                    variant="outline"
                    disabled={project.status === 'deleting'}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Logs</TooltipContent>
              </Tooltip>

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
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Docker Logs - {project.name}</DialogTitle>
            <DialogDescription>Container logs for debugging</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {logsLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading logs...</span>
              </div>
            ) : (
              <pre className="bg-muted p-4 rounded-md overflow-auto max-h-[60vh] text-xs font-mono whitespace-pre-wrap break-words">
                {logs || 'No logs available'}
              </pre>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsDialogOpen(false)}>
              Close
            </Button>
            <Button
              onClick={handleViewLogs}
              disabled={logsLoading}
              variant="secondary"
            >
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
              Are you sure you want to delete "{project.name}"? This action cannot be undone and
              will remove all project files.
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
