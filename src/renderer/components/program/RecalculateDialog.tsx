import { useState, type FormEvent } from 'react'
import type { PaceMode, ProgramInput, ProgramRecord } from '../../../main/database'
import { computeEndDate, computePagesPerDay } from '../../../main/schedule'
import { useCalendar } from '../../context/CalendarContext'
import { formatIsoDate } from '../../lib/hebrewDate'
import DateField from '../wizard/DateField'

type Props = {
  program: ProgramRecord
  /** Pages not yet fully done; these are the ones that get rescheduled. */
  remainingPages: number
  /** ISO date the new schedule starts from (today, or the start date if the program has not started). */
  fromDate: string
  onSubmit: (input: ProgramInput) => Promise<void>
  onCancel: () => void
}

const CHOICES: Array<[PaceMode, string]> = [
  ['target_date', 'שינוי תאריך יעד'],
  ['daily_pace', 'שינוי קצב'],
]

const inputClass = 'field'

function formatPace(pagesPerDay: number): string {
  return pagesPerDay === 1 ? 'דף אחד ביום' : `${Number(pagesPerDay.toFixed(2))} דפים ביום`
}

type Preview = { text: string } | { error: string } | null

function RecalculateDialog({ program, remainingPages, fromDate, onSubmit, onCancel }: Props) {
  const { calendarType } = useCalendar()
  const [mode, setMode] = useState<PaceMode>(program.paceMode)
  const [paceInput, setPaceInput] = useState(String(program.pagesPerDay))
  const [targetDate, setTargetDate] = useState(
    program.targetEndDate < fromDate ? fromDate : program.targetEndDate,
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const rest = { weekdays: program.restWeekdays, dates: program.restDates }
  const pagesPerDay = Number(paceInput)

  let preview: Preview = null
  if (mode === 'daily_pace' && !(pagesPerDay > 0)) {
    preview = { error: 'הקצב היומי חייב להיות גדול מאפס' }
  } else if (mode === 'target_date' && targetDate < fromDate) {
    preview = { error: 'תאריך היעד לא יכול להיות לפני היום' }
  } else if (remainingPages > 0) {
    try {
      preview =
        mode === 'daily_pace'
          ? {
              text: `תאריך סיום משוער: ${formatIsoDate(
                computeEndDate({ startDate: fromDate, totalDafim: remainingPages, pagesPerDay, rest }),
                calendarType,
              )}`,
            }
          : {
              text: `קצב נדרש: ${formatPace(
                computePagesPerDay({ startDate: fromDate, targetEndDate: targetDate, totalDafim: remainingPages, rest }),
              )}`,
            }
    } catch {
      preview = { error: 'אין ימי לימוד בטווח שנבחר' }
    }
  }
  const invalid = preview !== null && 'error' in preview

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (invalid) return
    setSaving(true)
    setSaveError(null)
    const input: ProgramInput = {
      tractateId: program.tractateId,
      programName: program.programName,
      startPage: program.startPage,
      endPage: program.endPage,
      startDate: program.startDate,
      paceMode: program.paceMode,
      pagesPerDay: program.pagesPerDay,
      targetEndDate: program.targetEndDate,
      restWeekdays: program.restWeekdays,
      restDates: program.restDates,
    }
    try {
      await onSubmit({
        ...input,
        paceMode: mode,
        ...(mode === 'daily_pace' ? { pagesPerDay } : { targetEndDate: targetDate }),
      })
    } catch (error) {
      console.error('Failed to recalculate program', error)
      setSaveError('חישוב המסלול מחדש נכשל')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-sm">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="recalculate-title"
        onSubmit={(event) => void submit(event)}
        className="card w-full max-w-md space-y-4 p-6 shadow-xl"
      >
        <h2 id="recalculate-title" className="text-xl font-bold text-ink">
          חישוב מסלול מחדש
        </h2>
        <p className="text-sm text-muted">
          {remainingPages} דפים שטרם הושלמו יתוזמנו מחדש החל מ-{formatIsoDate(fromDate, calendarType)}.
        </p>

        <fieldset className="flex gap-4">
          <legend className="sr-only">מה לשנות</legend>
          {CHOICES.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name="recalculate-mode" checked={mode === value} onChange={() => setMode(value)} />
              {label}
            </label>
          ))}
        </fieldset>

        {mode === 'daily_pace' ? (
          <label className="block space-y-1 text-sm text-muted">
            <span>דפים ביום</span>
            <input
              type="number"
              min="0"
              step="0.25"
              className={`${inputClass} w-32`}
              value={paceInput}
              onChange={(event) => setPaceInput(event.target.value)}
            />
          </label>
        ) : (
          <div className="space-y-1 text-sm text-muted">
            <span className="block">תאריך יעד חדש</span>
            <DateField label="תאריך יעד חדש" value={targetDate} anchor={fromDate} onChange={setTargetDate} />
          </div>
        )}

        {preview && 'text' in preview && (
          <p className="rounded-xl bg-brand-soft p-3 text-sm text-brand">{preview.text}</p>
        )}
        {preview && 'error' in preview && <p className="text-sm text-danger">{preview.error}</p>}
        {saveError && (
          <p role="alert" className="text-sm text-danger">
            {saveError}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="btn-ghost">
            ביטול
          </button>
          <button type="submit" disabled={invalid || saving} className="btn-primary">
            עדכון מסלול
          </button>
        </div>
      </form>
    </div>
  )
}

export default RecalculateDialog
