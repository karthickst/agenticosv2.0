import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import { useStore } from './store/useStore.js'
import { initDB, getProject } from './db/database.js'
import { useLiveQuery } from './hooks/useLiveQuery.js'
import { Loader2, AlertTriangle } from 'lucide-react'

import ProjectsPage     from './pages/ProjectsPage.jsx'
import DomainsPage      from './pages/DomainsPage.jsx'
import RequirementsPage from './pages/RequirementsPage.jsx'
import TestCasesPage    from './pages/TestCasesPage.jsx'
import DataBagsPage     from './pages/DataBagsPage.jsx'
import SimulationPage   from './pages/SimulationPage.jsx'
import SpecGeneratorPage from './pages/SpecGeneratorPage.jsx'
import SettingsPage     from './pages/SettingsPage.jsx'

export default function App() {
  const { activePage, activeProjectId } = useStore()
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState(null)

  // Initialise Turso schema once on startup
  useEffect(() => {
    initDB()
      .then(() => setDbReady(true))
      .catch(err => setDbError(err?.message || String(err)))
  }, [])

  const project = useLiveQuery(
    () => activeProjectId ? getProject(activeProjectId) : Promise.resolve(null),
    [activeProjectId]
  )

  if (dbError) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-center p-8">
        <div>
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-100 mb-2">Database connection failed</h1>
          <p className="text-sm text-gray-400 mb-1">Could not connect to Turso database.</p>
          <pre className="text-xs text-red-400 bg-red-900/20 rounded-lg p-3 max-w-xl mx-auto text-left mt-3">{dbError}</pre>
        </div>
      </div>
    )
  }

  if (!dbReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-brand-400" />
          <p className="text-sm text-gray-500">Connecting to Turso database…</p>
        </div>
      </div>
    )
  }

  const pages = {
    projects:     <ProjectsPage />,
    domains:      <DomainsPage />,
    requirements: <RequirementsPage />,
    testcases:    <TestCasesPage />,
    databags:     <DataBagsPage />,
    simulation:   <SimulationPage />,
    specgen:      <SpecGeneratorPage />,
    settings:     <SettingsPage />,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <Sidebar projectName={project?.name} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {pages[activePage] || <ProjectsPage />}
      </main>
    </div>
  )
}
