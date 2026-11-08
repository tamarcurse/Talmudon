import { useCallback, useEffect, useState } from 'react'
import type { PageProgressRecord, TodayProgramPlan } from '../../../main/database'
import { UNIT_KEYS, isPageComplete, type UnitTarget } from '../../../main/progress'
import { useCalendar } from '../../context/CalendarContext'
import { formatIsoDate } from '../../lib/hebrewDate'
import { buildProgressTree, unitsUnder, type PageNode } from '../../lib/progressTree'
import { SideRow } from '../program/ProgressTree'

type Props = {
  onCreate: () => void
  onOpen: (programId: number) => void
}

type SetUnits = (programId: number, targets: UnitTarget[], done: boolean) => void

const MAX_OVERDUE_SHOWN = 3

function localTodayIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function toPageNodes(rows: PageProgressRecord[]): PageNode[] {
  return buildProgressTree(rows).flatMap((day) => day.pages)
}

function TodayPageRow({ page, programId, onSetUnits }: { page: PageNode; programId: number; onSetUnits: SetUnits }) {
  const [expanded, setExpanded] = useState(false)
  const pageName = `דף ${page.label}`
  const done = page.status === 'done'
  const setUnits = (targets: UnitTarget[], value: boolean) => onSetUnits(programId, targets, value)

  return (
    <li className="py-2">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-ink">{pageName}</span>
        <button
          type="button"
          aria-pressed={done}
          aria-label={`למדתי ${pageName}`}
          onClick={() => setUnits(unitsUnder(page), !done)}
          className={done ? 'btn-primary' : 'btn-secondary'}
        >
          למדתי
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`פתח ${pageName}`}
          onClick={() => setExpanded((value) => !value)}
          className="rounded px-2 text-sm text-brand hover:bg-brand-soft"
        >
          {expanded ? '▾' : '◂'}
        </button>
      </div>
      {expanded && (
        <ul className="me-6 mt-2 space-y-1 border-s border-line ps-4">
          {page.sides.map((side) => (
            <SideRow key={side.side} side={side} pageName={pageName} onSetUnits={setUnits} />
          ))}
        </ul>
      )}
    </li>
  )
}

function PageList({ rows, programId, onSetUnits }: { rows: PageProgressRecord[]; programId: number; onSetUnits: SetUnits }) {
  return (
    <ul className="divide-y divide-line">
      {toPageNodes(rows).map((page) => (
        <TodayPageRow key={page.pageNumber} page={page} programId={programId} onSetUnits={onSetUnits} />
      ))}
    </ul>
  )
}

function overdueMoreLabel(count: number): string {
  return count === 1 ? 'ועוד דף אחד בפיגור' : `ועוד ${count} דפים בפיגור`
}

function ProgramCard({ entry, onOpen, onSetUnits }: { entry: TodayProgramPlan; onOpen: () => void; onSetUnits: SetUnits }) {
  const shownOverdue = entry.overduePages.slice(0, MAX_OVERDUE_SHOWN)
  const hiddenOverdue = entry.overduePages.length - shownOverdue.length
  const empty = entry.todayPages.length === 0 && entry.overduePages.length === 0

  return (
    <section className="card p-6">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink">{entry.programName}</h2>
          <p className="text-sm text-muted">מסכת {entry.tractateName}</p>
        </div>
        <button type="button" onClick={onOpen} className="btn-ghost">
          כניסה לתוכנית
        </button>
      </header>
      {empty && <p className="text-muted">אין לימוד היום</p>}
      {entry.todayPages.length > 0 && (
        <PageList rows={entry.todayPages} programId={entry.programId} onSetUnits={onSetUnits} />
      )}
      {entry.overduePages.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 font-semibold text-ink">בפיגור</h3>
          <PageList rows={shownOverdue} programId={entry.programId} onSetUnits={onSetUnits} />
          {hiddenOverdue > 0 && <p className="mt-1 text-sm text-muted">{overdueMoreLabel(hiddenOverdue)}</p>}
        </div>
      )}
    </section>
  )
}

function TodayScreen({ onCreate, onOpen }: Props) {
  const { calendarType } = useCalendar()
  const [plan, setPlan] = useState<TodayProgramPlan[] | null>(null)

  const reload = useCallback(async () => {
    setPlan(await window.talmudonBridge.getTodayPlan())
  }, [])

  useEffect(() => {
    let cancelled = false
    void window.talmudonBridge.getTodayPlan().then((loaded) => {
      if (!cancelled) setPlan(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function setUnits(programId: number, targets: UnitTarget[], done: boolean) {
    const touched = new Set(targets.map((target) => `${target.pageNumber}:${target.unit}`))
    const apply = (row: PageProgressRecord): PageProgressRecord => {
      const units = { ...row.units }
      for (const key of UNIT_KEYS) {
        if (touched.has(`${row.pageNumber}:${key}`)) units[key] = done
      }
      return { ...row, units, isPageCompleted: isPageComplete(units) }
    }
    // Optimistic update; a marked overdue page stays on screen (marked) until the next load, so it can be undone.
    setPlan((current) =>
      current?.map((entry) =>
        entry.programId === programId
          ? { ...entry, todayPages: entry.todayPages.map(apply), overduePages: entry.overduePages.map(apply) }
          : entry,
      ) ?? null,
    )
    try {
      await window.talmudonBridge.setUnitsCompleted(programId, targets, done)
    } catch (error) {
      console.error('Failed to save progress', error)
      await reload()
    }
  }

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-ink">מה לומדים היום</h1>
        <p className="mt-1 text-muted">{formatIsoDate(localTodayIso(), calendarType)}</p>
      </header>
      {plan !== null && plan.length === 0 && (
        <div className="card p-8 text-center">
          <p className="mb-4 text-lg text-muted">אין תוכניות פעילות</p>
          <button type="button" onClick={onCreate} className="btn-primary">
            צור תוכנית חדשה
          </button>
        </div>
      )}
      <div className="space-y-6">
        {plan?.map((entry) => (
          <ProgramCard
            key={entry.programId}
            entry={entry}
            onOpen={() => onOpen(entry.programId)}
            onSetUnits={(id, targets, done) => void setUnits(id, targets, done)}
          />
        ))}
      </div>
    </>
  )
}

export default TodayScreen
