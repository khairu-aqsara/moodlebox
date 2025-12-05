import { useState, useEffect } from 'react'
import { Dashboard } from './components/Dashboard'
import { NewProjectModal } from './components/NewProjectModal'
import { useSettingsStore } from './store/settings-store'

function App() {
  const [showNewProject, setShowNewProject] = useState(false)
  const { theme, loadSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
    <div className={`${theme} h-screen bg-background text-foreground`}>
      <Dashboard onNewProject={() => setShowNewProject(true)} />
      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  )
}

export default App
