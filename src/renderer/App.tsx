import { useState } from 'react'
import Dashboard from './components/dashboard/Dashboard'
import StudyProgramWizard from './components/wizard/StudyProgramWizard'

type View =
  | { name: 'dashboard' }
  | { name: 'wizard'; mode: 'create' }
  | { name: 'wizard'; mode: 'edit'; programId: number }
  | { name: 'program'; programId: number }

function App() {
  const [view, setView] = useState<View>({ name: 'dashboard' })
  const backToDashboard = () => setView({ name: 'dashboard' })

  if (view.name === 'wizard') {
    return (
      <StudyProgramWizard
        mode={view.mode}
        programId={view.mode === 'edit' ? view.programId : undefined}
        onSaved={backToDashboard}
        onCancel={backToDashboard}
      />
    )
  }

  if (view.name === 'program') {
    // Placeholder until the program screen (ticket 06) exists.
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-slate-100" dir="rtl" lang="he">
        <button type="button" onClick={backToDashboard} className="text-sm text-cyan-300">
          חזרה לתוכניות
        </button>
        <p className="mt-4 text-slate-300">מסך התוכנית (בקרוב)</p>
      </main>
    )
  }

  return (
    <Dashboard
      onCreate={() => setView({ name: 'wizard', mode: 'create' })}
      onEdit={(programId) => setView({ name: 'wizard', mode: 'edit', programId })}
      onOpen={(programId) => setView({ name: 'program', programId })}
    />
  )
}

export default App
