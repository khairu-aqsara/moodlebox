import { useState } from 'react'
import { versionManager } from '../lib/version-manager'
import { useProjectStore } from '../store/project-store'
import { useSettingsStore } from '../store/settings-store'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select'

interface NewProjectModalProps {
    onClose: () => void
}

export function NewProjectModal({ onClose }: NewProjectModalProps) {
    const [projectName, setProjectName] = useState('')
    const [selectedVersion, setSelectedVersion] = useState('')
    const [port, setPort] = useState('8080')
    const addProject = useProjectStore((state) => state.addProject)
    const workspaceFolder = useSettingsStore((state) => state.workspaceFolder)

    const versions = versionManager.getAllVersions()
    const selectedVersionData = selectedVersion ? versionManager.getVersionByNumber(selectedVersion) : null

    const handleCreate = () => {
        if (!projectName || !selectedVersion || !workspaceFolder) return

        const projectSlug = projectName.toLowerCase().replace(/\s+/g, '-')

        addProject({
            name: projectName,
            moodleVersion: selectedVersion,
            port: parseInt(port),
            status: 'stopped',
            path: `${workspaceFolder}/${projectSlug}`,
        })

        onClose()
    }

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>
                        Set up a new Moodle development environment
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Project Name</Label>
                        <Input
                            id="name"
                            placeholder="My Moodle Site"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="version">Moodle Version</Label>
                        <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                            <SelectTrigger id="version">
                                <SelectValue placeholder="Select a version" />
                            </SelectTrigger>
                            <SelectContent>
                                {versions.map((version) => (
                                    <SelectItem key={version.version} value={version.version}>
                                        Moodle {version.version} ({version.type.toUpperCase()}) - PHP {version.requirements.php}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="port">Port</Label>
                        <Input
                            id="port"
                            type="number"
                            value={port}
                            onChange={(e) => setPort(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            Your Moodle site will be available at http://localhost:{port}
                        </p>
                    </div>

                    {selectedVersionData && (
                        <div className="rounded-lg bg-muted p-3 text-sm">
                            <p className="font-medium mb-1">Auto-configured:</p>
                            <ul className="text-muted-foreground space-y-1">
                                <li>• PHP {selectedVersionData.requirements.php}</li>
                                <li>• Mysql {selectedVersionData.requirements.mysql}</li>
                                <li>• Admin credentials: admin / admin</li>
                            </ul>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={!projectName || !selectedVersion}>
                        Create Project
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
