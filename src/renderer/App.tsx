import { useState } from 'react'
import Dashboard from './components/dashboard/Dashboard'
import AppHeader from './components/layout/AppHeader'
import ConfirmDialog from './components/layout/ConfirmDialog'
import ProgramDetail from './components/program/ProgramDetail'
import StudyProgramWizard from './components/wizard/StudyProgramWizard'

type View =
  | { name: 'dashboard' }
  | { name: 'wizard'; mode: 'create' }
  | { name: 'wizard'; mode: 'edit'; programId: number; returnTo: View }
  | { name: 'program'; programId: number }

function App() {
  const [view, setView] = useState<View>({ name: 'dashboard' })
  const [confirmLeave, setConfirmLeave] = useState(false)
  const backToDashboard = () => setView({ name: 'dashboard' })

  function goHome() {
    if (view.name === 'wizard') setConfirmLeave(true)
    else backToDashboard()
  }

  function renderView() {
    if (view.name === 'wizard') {
      const leave = view.mode === 'edit' ? () => setView(view.returnTo) : backToDashboard
      return (
        <StudyProgramWizard
          mode={view.mode}
          programId={view.mode === 'edit' ? view.programId : undefined}
          onSaved={leave}
          onCancel={leave}
        />
      )
    }

    if (view.name === 'program') {
      return (
        <ProgramDetail
          key={view.programId}
          programId={view.programId}
          onBack={backToDashboard}
          onEdit={(programId) => setView({ name: 'wizard', mode: 'edit', programId, returnTo: view })}
        />
      )
    }

    return (
      <Dashboard
        onCreate={() => setView({ name: 'wizard', mode: 'create' })}
        onEdit={(programId) =>
          setView({ name: 'wizard', mode: 'edit', programId, returnTo: { name: 'dashboard' } })
        }
        onOpen={(programId) => setView({ name: 'program', programId })}
      />
    )
  }

  return (
    <AppHeader onHome={goHome}>
      {renderView()}
      {confirmLeave && (
        <ConfirmDialog
          title="לצאת בלי לשמור?"
          message="השינויים שלא נשמרו יאבדו."
          confirmLabel="יציאה"
          cancelLabel="המשך עריכה"
          onConfirm={() => {
            setConfirmLeave(false)
            backToDashboard()
          }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </AppHeader>
  )
}

export default App
