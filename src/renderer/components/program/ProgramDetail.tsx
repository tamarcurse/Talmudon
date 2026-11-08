import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PageProgressRecord, ProgramInput, ProgramRecord } from '../../../main/database'
import { UNIT_KEYS, isPageComplete, unitPercent, type UnitTarget } from '../../../main/progress'
import { buildProgressTree } from '../../lib/progressTree'
import ProgressPie from '../dashboard/ProgressPie'
import AppHeader from '../layout/AppHeader'
import ProgressTree from './ProgressTree'
import RecalculateDialog from './RecalculateDialog'

type Props = {
  programId: number
  onBack: () => void
  onEdit: (id: number) => void
}

function localTodayIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function ProgramDetail({ programId, onBack, onEdit }: Props) {
  const [program, setProgram] = useState<ProgramRecord | null>(null)
  const [rows, setRows] = useState<PageProgressRecord[]>([])
  const [recalculating, setRecalculating] = useState(false)

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

  async function setUnits(targets: UnitTarget[], done: boolean) {
    const touched = new Set(targets.map((target) => `${target.pageNumber}:${target.unit}`))
    // Optimistic update; a failed save falls back to what the bridge actually holds.
    setRows((current) =>
      current.map((row) => {
        const units = { ...row.units }
        for (const key of UNIT_KEYS) {
          if (touched.has(`${row.pageNumber}:${key}`)) units[key] = done
        }
        return { ...row, units, isPageCompleted: isPageComplete(units) }
      }),
    )
    try {
      await window.talmudonBridge.setUnitsCompleted(programId, targets, done)
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

  const today = localTodayIso()

  return (
    <AppHeader>
      <header className="card mb-8 flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <ProgressPie percent={percent} />
          <h1 className="text-3xl font-bold text-ink">{program?.programName}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setRecalculating(true)} disabled={!program} className="btn-primary">
            חישוב מסלול מחדש
          </button>
          <button type="button" onClick={() => onEdit(programId)} className="btn-secondary">
            עריכת תוכנית
          </button>
          <button type="button" onClick={onBack} className="btn-ghost">
            חזרה לתוכניות
          </button>
        </div>
      </header>

      <ProgressTree days={days} onSetUnits={(targets, done) => void setUnits(targets, done)} />

      {recalculating && program && (
        <RecalculateDialog
          program={program}
          remainingPages={rows.filter((row) => !isPageComplete(row.units)).length}
          fromDate={today > program.startDate ? today : program.startDate}
          onSubmit={recalculate}
          onCancel={() => setRecalculating(false)}
        />
      )}
    </AppHeader>
  )
}

export default ProgramDetail
