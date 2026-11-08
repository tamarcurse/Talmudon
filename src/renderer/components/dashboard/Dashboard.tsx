import { useEffect, useState } from 'react'
import type { ProgramSummary } from '../../../main/database'
import ConfirmDialog from '../layout/ConfirmDialog'
import ProgramCard from './ProgramCard'

type Props = {
  onCreate: () => void
  onEdit: (id: number) => void
  onOpen: (id: number) => void
}

function Dashboard({ onCreate, onEdit, onOpen }: Props) {
  const [summaries, setSummaries] = useState<ProgramSummary[] | null>(null)

  const [reloadCount, setReloadCount] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<ProgramSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.talmudonBridge.listProgramSummaries().then((loaded) => {
      if (!cancelled) setSummaries(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [reloadCount])

  async function toggleStatus(summary: ProgramSummary) {
    await window.talmudonBridge.setProgramStatus(summary.id, summary.status === 'paused' ? 'active' : 'paused')
    setReloadCount((count) => count + 1)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    await window.talmudonBridge.deleteProgram(pendingDelete.id)
    setPendingDelete(null)
    setReloadCount((count) => count + 1)
  }

  const ongoing = (summaries ?? []).filter((summary) => summary.status !== 'completed')
  const completed = (summaries ?? []).filter((summary) => summary.status === 'completed')

  function renderCard(summary: ProgramSummary) {
    return (
      <ProgramCard
        key={summary.id}
        summary={summary}
        onOpen={onOpen}
        onEdit={onEdit}
        onToggleStatus={(s) => void toggleStatus(s)}
        onDelete={setPendingDelete}
      />
    )
  }

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">תוכניות הלימוד שלי</h1>
          {ongoing.length > 0 && <p className="mt-1 text-sm text-muted">{ongoing.length} תוכניות</p>}
        </div>
        <button type="button" onClick={onCreate} className="btn-primary">
          צור תוכנית חדשה
        </button>
      </header>

      {summaries !== null && summaries.length === 0 && (
        <div className="card flex flex-col items-center gap-4 p-12 text-center">
          <p className="text-muted">אין עדיין תוכניות</p>
        </div>
      )}

      {ongoing.length > 0 && (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{ongoing.map(renderCard)}</section>
      )}

      {completed.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-2xl font-bold text-ink">הושלמו</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{completed.map(renderCard)}</div>
        </section>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="למחוק את התוכנית?"
          message="כל ההתקדמות תימחק לצמיתות."
          confirmLabel="מחיקה"
          cancelLabel="ביטול"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}

export default Dashboard
