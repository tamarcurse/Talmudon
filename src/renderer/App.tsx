import { useState } from 'react'
import Dashboard from './components/dashboard/Dashboard'
import AppHeader from './components/layout/AppHeader'
import ConfirmDialog from './components/layout/ConfirmDialog'
import ProgramDetail from './components/program/ProgramDetail'
import StatsScreen from './components/stats/StatsScreen'
import TodayScreen from './components/today/TodayScreen'
import StudyProgramWizard from './components/wizard/StudyProgramWizard'

type View =
  | { name: 'today' }
  | { name: 'dashboard' }
  | { name: 'stats' }
  | { name: 'wizard'; mode: 'create' }
  | { name: 'wizard'; mode: 'edit'; programId: number; returnTo: View }
  | { name: 'program'; programId: number }

function App() {
  const [view, setView] = useState<View>({ name: 'today' })
  // The destination chosen while the wizard is open, awaiting confirmation to discard unsaved changes.
  const [pendingLeave, setPendingLeave] = useState<View | null>(null)
  const backToDashboard = () => setView({ name: 'dashboard' })

  function navigate(target: View) {
    if (view.name === 'wizard') setPendingLeave(target)
    else setView(target)
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
          onDeleted={backToDashboard}
          onEdit={(programId) => setView({ name: 'wizard', mode: 'edit', programId, returnTo: view })}
        />
      )
    }

    if (view.name === 'stats') {
      return <StatsScreen />
    }

    if (view.name === 'today') {
      return (
        <TodayScreen
          onCreate={() => setView({ name: 'wizard', mode: 'create' })}
          onOpen={(programId) => setView({ name: 'program', programId })}
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
    <AppHeader onHome={() => navigate({ name: 'today' })} onAllPrograms={() => navigate({ name: 'dashboard' })}
      onStats={() => navigate({ name: 'stats' })}
    >
      {renderView()}
      {pendingLeave && (
        <ConfirmDialog
          title="לצאת בלי לשמור?"
          message="השינויים שלא נשמרו יאבדו."
          confirmLabel="יציאה"
          cancelLabel="המשך עריכה"
          onConfirm={() => {
            setView(pendingLeave)
            setPendingLeave(null)
          }}
          onCancel={() => setPendingLeave(null)}
        />
      )}
    </AppHeader>
  )
}

export default App
