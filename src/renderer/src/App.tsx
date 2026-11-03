import { useState, useEffect } from 'react'
import { Dashboard } from './components/Dashboard'
import { NewProjectModal } from './components/NewProjectModal'
import { useSettingsStore } from './store/settings-store'

function App(): React.JSX.Element {
  const [showNewProject, setShowNewProject] = useState(false)
  const { theme, loadSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Dialogs, selects and tooltips render in portals outside the app root, so the
  // theme class goes on <html> for the dark tokens to reach them too.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      // Cmd+N or Ctrl+N: Create new project
      if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault()
        if (!showNewProject) {
          setShowNewProject(true)
        }
      }

      // Escape: Close modals
      if (event.key === 'Escape' && showNewProject) {
        setShowNewProject(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showNewProject])

  return (
    <div className="h-screen bg-background text-foreground">
      <Dashboard onNewProject={() => setShowNewProject(true)} />
      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  )
}

export default App
