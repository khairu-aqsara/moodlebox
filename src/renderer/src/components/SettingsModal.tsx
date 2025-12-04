import { useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settings-store'
import { X, Sun, Moon, FolderOpen } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { theme, workspaceFolder, phpMyAdminPort, updateSettings, selectFolder } =
    useSettingsStore()
  const [localTheme, setLocalTheme] = useState(theme)
  const [localFolder, setLocalFolder] = useState(workspaceFolder)
  const [localPhpMyAdminPort, setLocalPhpMyAdminPort] = useState(phpMyAdminPort)

  useEffect(() => {
    setLocalTheme(theme)
    setLocalFolder(workspaceFolder)
    setLocalPhpMyAdminPort(phpMyAdminPort)
  }, [theme, workspaceFolder, phpMyAdminPort])

  const handleSave = async () => {
    await updateSettings({
      theme: localTheme,
      workspaceFolder: localFolder,
      phpMyAdminPort: localPhpMyAdminPort
    })
    onClose()
  }

  const handleBrowse = async () => {
    await selectFolder()
    // Update local state with the new folder
    setLocalFolder(useSettingsStore.getState().workspaceFolder)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border/50">
          <div>
            <h2 className="text-xl font-bold">Settings</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure your MoodleBox preferences
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Theme Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Theme</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLocalTheme('light')}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                  localTheme === 'light'
                    ? 'border-primary bg-primary/10'
                    : 'border-border/50 hover:border-border bg-background/50'
                )}
              >
                <Sun className="h-6 w-6" />
                <span className="text-sm font-medium">Light</span>
                {localTheme === 'light' && (
                  <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
                )}
              </button>

              <button
                onClick={() => setLocalTheme('dark')}
                className={cn(
                  'relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                  localTheme === 'dark'
                    ? 'border-primary bg-primary/10'
                    : 'border-border/50 hover:border-border bg-background/50'
                )}
              >
                <Moon className="h-6 w-6" />
                <span className="text-sm font-medium">Dark</span>
                {localTheme === 'dark' && (
                  <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            </div>
          </div>

          {/* Workspace Folder */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Workspace Folder</label>
            <p className="text-xs text-muted-foreground">
              Location for storing Docker Compose files and Moodle source code
            </p>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 text-sm bg-muted/50 rounded-lg border border-border/50 truncate">
                {localFolder || 'Not set'}
              </div>
              <Button
                variant="secondary"
                size="icon"
                onClick={handleBrowse}
                className="h-10 w-10 shrink-0"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* phpMyAdmin Port */}
          <div className="space-y-3">
            <label className="text-sm font-medium">phpMyAdmin Port</label>
            <p className="text-xs text-muted-foreground">
              Port for accessing phpMyAdmin (default: 8081)
            </p>
            <input
              type="number"
              value={localPhpMyAdminPort}
              onChange={(e) => setLocalPhpMyAdminPort(Number(e.target.value))}
              min="1024"
              max="65535"
              className="w-full px-3 py-2 text-sm bg-muted/50 rounded-lg border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border/50">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="rounded-full">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
