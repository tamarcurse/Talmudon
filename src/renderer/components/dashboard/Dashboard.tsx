import { useEffect, useState } from 'react'
import type { ProgramSummary } from '../../../main/database'
import CalendarToggle from './CalendarToggle'
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
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 lg:p-8" dir="rtl" lang="he">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-white">תוכניות הלימוד שלי</h1>
        <div className="flex items-center gap-3">
          <CalendarToggle />
          <button
            type="button"
            onClick={onCreate}
            className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
          >
            צור תוכנית חדשה
          </button>
        </div>
      </header>

      {summaries !== null && summaries.length === 0 && <p className="text-slate-400">אין עדיין תוכניות</p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
    </main>
  )
}

export default Dashboard
