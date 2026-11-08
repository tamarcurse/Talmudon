import { useEffect, useState } from 'react'
import type { ProgramSummary } from '../../../main/database'
import ProgramCard from './ProgramCard'

type Props = {
  onCreate: () => void
  onEdit: (id: number) => void
  onOpen: (id: number) => void
}

function Dashboard({ onCreate, onEdit, onOpen }: Props) {
  const [summaries, setSummaries] = useState<ProgramSummary[] | null>(null)

  const [reloadCount, setReloadCount] = useState(0)

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

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">תוכניות הלימוד שלי</h1>
          {summaries !== null && summaries.length > 0 && (
            <p className="mt-1 text-sm text-muted">{summaries.length} תוכניות</p>
          )}
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

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(summaries ?? []).map((summary) => (
          <ProgramCard
            key={summary.id}
            summary={summary}
            onOpen={onOpen}
            onEdit={onEdit}
            onToggleStatus={(s) => void toggleStatus(s)}
          />
        ))}
      </section>
    </>
  )
}

export default Dashboard
