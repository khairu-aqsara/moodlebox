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

  return (
    <div className={`${theme} h-screen bg-background text-foreground`}>
      <Dashboard onNewProject={() => setShowNewProject(true)} />
      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </div>
  )
}

export default App
