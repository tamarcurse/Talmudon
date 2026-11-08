import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PageProgressRecord, ProgramInput, ProgramRecord } from '../../../main/database'
import { UNIT_KEYS, isPageComplete, unitPercent, type UnitTarget } from '../../../main/progress'
import { buildPaceSeries } from '../../../main/stats'
import { useCalendar } from '../../context/CalendarContext'
import { formatIsoDate } from '../../lib/hebrewDate'
import { buildProgressTree } from '../../lib/progressTree'
import ProgressPie from '../dashboard/ProgressPie'
import ConfirmDialog from '../layout/ConfirmDialog'
import PaceChart from './PaceChart'
import ProgramCalendar from './ProgramCalendar'
import ProgressTree from './ProgressTree'
import RecalculateDialog from './RecalculateDialog'

type Props = {
  programId: number
  onBack: () => void
  onEdit: (id: number) => void
  onDeleted: () => void
}

function localTodayIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Same format as SQLite CURRENT_TIMESTAMP (UTC), matching what the service stores. */
function utcTimestampNow(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function ProgramDetail({ programId, onBack, onEdit, onDeleted }: Props) {
  const { calendarType } = useCalendar()
  const [program, setProgram] = useState<ProgramRecord | null>(null)
  const [rows, setRows] = useState<PageProgressRecord[]>([])
  const [recalculating, setRecalculating] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [view, setView] = useState<'tree' | 'calendar'>('tree')

  const reloadRows = useCallback(async () => {
    setRows(await window.talmudonBridge.getPageProgress(programId))
  }, [programId])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      window.talmudonBridge.getProgram(programId),
      window.talmudonBridge.getPageProgress(programId),
    ]).then(([loadedProgram, loadedRows]) => {
      if (cancelled) return
      setProgram(loadedProgram)
      setRows(loadedRows)
    })
    return () => {
      cancelled = true
    }
  }, [programId])

  const days = useMemo(() => buildProgressTree(rows), [rows])
  // The percent is derived on every render from the atomic units; it is never stored separately.
  const percent = unitPercent(rows)
  const isCompleted = program?.status === 'completed'

  async function setUnits(targets: UnitTarget[], done: boolean) {
    if (isCompleted) return
    const touched = new Set(targets.map((target) => `${target.pageNumber}:${target.unit}`))
    const next = rows.map((row) => {
      const units = { ...row.units }
      for (const key of UNIT_KEYS) {
        if (touched.has(`${row.pageNumber}:${key}`)) units[key] = done
      }
      const isPageCompleted = isPageComplete(units)
      const completedAt = isPageCompleted ? (row.completedAt ?? utcTimestampNow()) : null
      return { ...row, units, isPageCompleted, completedAt }
    })
    // Optimistic update; a failed save falls back to what the bridge actually holds.
    setRows(next)
    try {
      await window.talmudonBridge.setUnitsCompleted(programId, targets, done)
      // Marking the last unit completes the program on the backend; reload to show it locked.
      if (unitPercent(next) === 100) setProgram(await window.talmudonBridge.getProgram(programId))
    } catch (error) {
      console.error('Failed to save progress', error)
      await reloadRows()
    }
  }

  // Saving through updateProgram validates the new target/pace and reschedules pending pages from today.
  async function recalculate(input: ProgramInput) {
    await window.talmudonBridge.updateProgram(programId, input)
    const [loadedProgram, loadedRows] = await Promise.all([
      window.talmudonBridge.getProgram(programId),
      window.talmudonBridge.getPageProgress(programId),
    ])
    setProgram(loadedProgram)
    setRows(loadedRows)
    setRecalculating(false)
  }

  async function confirmDelete() {
    await window.talmudonBridge.deleteProgram(programId)
    setConfirmingDelete(false)
    onDeleted()
  }

  const today = localTodayIso()
  const paceSeries = useMemo(
    () => (program ? buildPaceSeries({ pages: rows, startDate: program.startDate, today }) : []),
    [program, rows, today],
  )

  return (
    <>
      <header className="card mb-8 flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <ProgressPie percent={percent} />
          <h1 className="text-3xl font-bold text-ink">{program?.programName}</h1>
          {isCompleted && program?.completedAt && (
            <span className="badge-success">הושלמה ב-{formatIsoDate(program.completedAt, calendarType)}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!isCompleted && (
            <>
              <button type="button" onClick={() => setRecalculating(true)} disabled={!program} className="btn-primary">
                חישוב מסלול מחדש
              </button>
              <button type="button" onClick={() => onEdit(programId)} className="btn-secondary">
                עריכת תוכנית
              </button>
            </>
          )}
          <button type="button" onClick={() => setConfirmingDelete(true)} className="btn-secondary">
            מחיקה
          </button>
          <button type="button" onClick={onBack} className="btn-ghost">
            חזרה לתוכניות
          </button>
        </div>
      </header>

      <PaceChart series={paceSeries} today={today} />

      <div role="group" aria-label="תצוגה" className="mb-4 flex gap-2">
        {(['tree', 'calendar'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => setView(value)}
            className={view === value ? 'btn-primary' : 'btn-secondary'}
          >
            {value === 'tree' ? 'עץ' : 'לוח שנה'}
          </button>
        ))}
      </div>

      {view === 'tree' ? (
        <ProgressTree days={days} onSetUnits={(targets, done) => void setUnits(targets, done)} readOnly={isCompleted} />
      ) : (
        program && <ProgramCalendar program={program} rows={rows} today={today} />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="למחוק את התוכנית?"
          message="כל ההתקדמות תימחק לצמיתות."
          confirmLabel="מחיקה"
          cancelLabel="ביטול"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {recalculating && program && (
        <RecalculateDialog
          program={program}
          remainingPages={rows.filter((row) => !isPageComplete(row.units)).length}
          fromDate={today > program.startDate ? today : program.startDate}
          onSubmit={recalculate}
          onCancel={() => setRecalculating(false)}
        />
      )}
    </>
  )
}

export default ProgramDetail
