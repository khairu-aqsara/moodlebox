import { useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settings-store'
import { X, Sun, Moon, FolderOpen } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

interface SettingsModalProps {
  onClose: () => void
}

export function SettingsModal({ onClose }: SettingsModalProps): React.JSX.Element {
  const { theme, workspaceFolder, updateSettings, selectFolder } = useSettingsStore()
  const [localTheme, setLocalTheme] = useState(theme)
  const [localFolder, setLocalFolder] = useState(workspaceFolder)

  useEffect(() => {
    setLocalTheme(theme)
    setLocalFolder(workspaceFolder)
  }, [theme, workspaceFolder])

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleSave = async (): Promise<void> => {
    await updateSettings({
      theme: localTheme,
      workspaceFolder: localFolder
    })
    onClose()
  }

  const handleBrowse = async (): Promise<void> => {
    await selectFolder()
    // Update local state with the new folder
    setLocalFolder(useSettingsStore.getState().workspaceFolder)
  }

  const themeOption = (
    value: 'light' | 'dark',
    label: string,
    Icon: typeof Sun
  ): React.JSX.Element => (
    <button
      type="button"
      onClick={() => setLocalTheme(value)}
      aria-pressed={localTheme === value}
      className={cn(
        'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-key text-sm font-medium transition-[background-color,transform] duration-micro ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px motion-reduce:transition-none',
        localTheme === value
          ? 'bg-signal text-signal-ink shadow-key-primary'
          : 'text-ink-2 hover:bg-paper-2'
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-entry bg-paper-2 shadow-lift ring-1 ring-ink">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 bg-head px-6 py-4 text-head-ink">
          <div>
            <h2
              id="settings-title"
              className="font-display text-xl font-semibold leading-none tracking-display"
            >
              Settings
            </h2>
            <p className="mt-2 text-sm opacity-80">Configure your MoodleDocks preferences</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-key text-head-ink transition-colors duration-micro hover:bg-head-ink/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-6 p-6">
          {/* Theme Selection */}
          <div className="flex flex-col gap-3" role="group" aria-labelledby="settings-theme">
            <span id="settings-theme" className="text-sm font-medium text-ink-2">
              Theme
            </span>
            <div className="flex gap-1 rounded-key bg-paper-3 p-1">
              {themeOption('light', 'Light', Sun)}
              {themeOption('dark', 'Dark', Moon)}
            </div>
          </div>

          {/* Workspace Folder */}
          <div className="flex flex-col gap-3" role="group" aria-labelledby="settings-folder">
            <div>
              <span id="settings-folder" className="text-sm font-medium text-ink-2">
                Workspace Folder
              </span>
              <p className="mt-1 text-sm text-muted-foreground">
                Location for storing Docker Compose files and Moodle source code
              </p>
            </div>
            <div className="flex gap-2">
              <div
                className="flex h-10 min-w-0 flex-1 items-center truncate rounded-key border border-input bg-sheet px-3 font-mono text-sm text-ink"
                title={localFolder || undefined}
              >
                {localFolder || 'Not set'}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleBrowse}
                aria-label="Choose workspace folder"
              >
                <FolderOpen aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-rule px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </div>
  )
}
