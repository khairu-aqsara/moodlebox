import { useEffect, useState } from 'react'
import { useProjectStore } from '../store/project-store'
import { ProjectCard } from './ProjectCard'
import { SettingsModal } from './SettingsModal'
import { Plus, Settings, Sliders, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

interface DashboardProps {
    onNewProject: () => void
}

export function Dashboard({ onNewProject }: DashboardProps) {
    const projects = useProjectStore((state) => state.projects)
    const loadProjects = useProjectStore((state) => state.loadProjects)
    const [isFabOpen, setIsFabOpen] = useState(false)
    const [dockerError, setDockerError] = useState(false)
    const [isCheckingDocker, setIsCheckingDocker] = useState(false)
    const [showSettings, setShowSettings] = useState(false)

    const checkDocker = async () => {
        setIsCheckingDocker(true)
        try {
            const isRunning = await window.api.projects.checkDocker()
            setDockerError(!isRunning)
        } catch (err) {
            console.error('Failed to check Docker:', err)
            setDockerError(true)
        } finally {
            setIsCheckingDocker(false)
        }
    }

    useEffect(() => {
        loadProjects()
        checkDocker()

        // Re-check when window gains focus
        const onFocus = () => checkDocker()
        window.addEventListener('focus', onFocus)
        return () => window.removeEventListener('focus', onFocus)
    }, [])

    const toggleFab = () => setIsFabOpen(!isFabOpen)

    return (
        <div className="flex flex-col h-full relative">
            {/* Modern Glassmorphic Header */}
            <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-16 items-center px-6">
                    <div className="flex flex-col gap-0.5">
                        <h1 className="text-xl font-bold tracking-tight">MoodleBox</h1>
                        <p className="text-xs text-muted-foreground font-medium">Local Moodle Environment</p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-auto p-6 pb-32">
                {dockerError ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
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
                                    <RefreshCw className={cn("mr-2 h-5 w-5", isCheckingDocker && "animate-spin")} />
                                    {isCheckingDocker ? 'Checking...' : 'Retry Connection'}
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    Don't have Docker? <a href="#" onClick={(e) => { e.preventDefault(); window.open('https://docker.com'); }} className="text-primary hover:underline">Download Docker Desktop</a>
                                </p>
                            </div>
                        </div>
                    </div>
                ) : projects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
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
                    <div className="max-w-5xl mx-auto space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold tracking-tight">Active Projects</h2>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
                                {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
                            </span>
                        </div>

                        <div className="grid gap-4">
                            {projects.map((project) => (
                                <ProjectCard key={project.id} project={project} />
                            ))}
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
                            "flex flex-col items-end gap-3 transition-all duration-300 ease-in-out",
                            isFabOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95 pointer-events-none"
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
                            "h-14 w-14 rounded-full shadow-lg transition-transform duration-300 [&_svg]:size-6",
                            isFabOpen ? "rotate-90" : "rotate-0"
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
