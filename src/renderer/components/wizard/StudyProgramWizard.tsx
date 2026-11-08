import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PaceMode, ProgramInput } from '../../../main/database'
import { useCalendar } from '../../context/CalendarContext'
import { formatIsoDate } from '../../lib/hebrewDate'
import { computeEndDate, computePagesPerDay, countDafim } from '../../../main/schedule'
import DateField from './DateField'

type Tractate = { id: number; name_he: string; name_en: string; total_pages: number }
type ShasPage = { page_number: number; page_label_he: string }
type RangeMode = 'full' | 'custom'

const FIRST_DAF = 2
const STEP_TITLES = ['מסכת', 'טווח', 'קצב', 'ימי מנוחה', 'סיכום']
const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

const inputClass =
  'rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none'
const primaryButton =
  'rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40'
const secondaryButton =
  'rounded-xl border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40'

export type StudyProgramWizardProps = {
  mode: 'create' | 'edit'
  programId?: number
  /** ISO date used as the default start date; defaults to the local current date. */
  today?: string
  onSaved: (programId: number) => void
  onCancel: () => void
}

function localTodayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function formatPace(pagesPerDay: number): string {
  return pagesPerDay === 1 ? 'דף אחד ביום' : `${Number(pagesPerDay.toFixed(2))} דפים ביום`
}

function formatDafCount(count: number): string {
  return count === 1 ? 'דף אחד' : `${count} דפים`
}

type Plan = { pagesPerDay: number; targetEndDate: string } | { error: string }

function StudyProgramWizard({ mode, programId, today, onSaved, onCancel }: StudyProgramWizardProps) {
  const { calendarType } = useCalendar()
  const todayIso = today ?? localTodayIso()

  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tractates, setTractates] = useState<Tractate[]>([])
  const [pages, setPages] = useState<ShasPage[]>([])

  const [step, setStep] = useState(0)
  const [search, setSearch] = useState('')
  const [tractateId, setTractateId] = useState<number | null>(null)
  const [programName, setProgramName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [rangeMode, setRangeMode] = useState<RangeMode>('full')
  const [customStart, setCustomStart] = useState(FIRST_DAF)
  const [customEnd, setCustomEnd] = useState(FIRST_DAF)
  const [startDate, setStartDate] = useState(todayIso)
  const [paceMode, setPaceMode] = useState<PaceMode>('daily_pace')
  const [paceInput, setPaceInput] = useState('1')
  const [targetDate, setTargetDate] = useState('')
  const [restWeekdays, setRestWeekdays] = useState<number[]>([])
  const [restDates, setRestDates] = useState<string[]>([])
  const [pendingRestDate, setPendingRestDate] = useState(todayIso)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    const bridge = window.talmudonBridge
    let cancelled = false

    Promise.all([
      bridge.getTractates(),
      bridge.getShasPages(),
      mode === 'edit' && programId !== undefined ? bridge.getProgram(programId) : Promise.resolve(null),
    ])
      .then(([loadedTractates, loadedPages, program]) => {
        if (cancelled) return
        setTractates(loadedTractates)
        setPages(loadedPages)

        if (mode === 'edit') {
          if (!program) {
            setLoadError('התוכנית לא נמצאה')
            return
          }
          const tractate = loadedTractates.find((item) => item.id === program.tractateId)
          const isFull = program.startPage === FIRST_DAF && program.endPage === tractate?.total_pages
          setTractateId(program.tractateId)
          setProgramName(program.programName)
          setNameTouched(true)
          setRangeMode(isFull ? 'full' : 'custom')
          setCustomStart(program.startPage)
          setCustomEnd(program.endPage)
          setStartDate(program.startDate)
          setPaceMode(program.paceMode)
          setPaceInput(String(program.pagesPerDay))
          setTargetDate(program.targetEndDate)
          setRestWeekdays(program.restWeekdays)
          setRestDates(program.restDates)
        }
        setLoaded(true)
      })
      .catch((error: unknown) => {
        console.error('Failed to load wizard data', error)
        if (!cancelled) setLoadError('טעינת הנתונים נכשלה')
      })

    return () => {
      cancelled = true
    }
  }, [mode, programId])

  const tractate = tractates.find((item) => item.id === tractateId) ?? null
  const labelOf = useMemo(() => {
    const labels = new Map(pages.map((page) => [page.page_number, page.page_label_he]))
    return (pageNumber: number) => labels.get(pageNumber) ?? String(pageNumber)
  }, [pages])

  const startPage = rangeMode === 'full' ? FIRST_DAF : customStart
  const endPage = rangeMode === 'full' ? (tractate?.total_pages ?? FIRST_DAF) : customEnd
  const rangeValid =
    tractate !== null && startPage >= FIRST_DAF && startPage <= endPage && endPage <= tractate.total_pages
  const totalDafim = rangeValid ? countDafim(startPage, endPage) : 0
  const rest = useMemo(() => ({ weekdays: restWeekdays, dates: restDates }), [restWeekdays, restDates])

  const plan: Plan = useMemo(() => {
    if (!rangeValid) return { error: 'טווח הלימוד אינו תקין' }
    try {
      if (paceMode === 'daily_pace') {
        const pagesPerDay = Number(paceInput)
        if (!(pagesPerDay > 0)) return { error: 'הקצב היומי חייב להיות גדול מאפס' }
        return {
          pagesPerDay,
          targetEndDate: computeEndDate({ startDate, totalDafim, pagesPerDay, rest }),
        }
      }
      if (!targetDate) return { error: 'יש לבחור תאריך יעד' }
      return {
        pagesPerDay: computePagesPerDay({ startDate, targetEndDate: targetDate, totalDafim, rest }),
        targetEndDate: targetDate,
      }
    } catch (error) {
      return { error: error instanceof Error ? 'לא ניתן לחשב לוח לימוד: בדקו את התאריכים וימי המנוחה' : 'שגיאה' }
    }
  }, [rangeValid, paceMode, paceInput, startDate, targetDate, totalDafim, rest])

  const stepErrors: Array<string | null> = [
    tractateId === null ? 'יש לבחור מסכת' : programName.trim() === '' ? 'יש להזין שם לתוכנית' : null,
    rangeValid ? null : 'טווח הלימוד אינו תקין',
    'error' in plan ? plan.error : null,
    restWeekdays.length >= 7 ? 'לא ניתן לסמן את כל ימי השבוע כימי מנוחה' : 'error' in plan ? plan.error : null,
    null,
  ]
  const currentError = stepErrors[step]
  const isLastStep = step === STEP_TITLES.length - 1

  function chooseTractate(item: Tractate) {
    setTractateId(item.id)
    if (!nameTouched) setProgramName(`מסכת ${item.name_he}`)
    setRangeMode('full')
    setCustomStart(FIRST_DAF)
    setCustomEnd(item.total_pages)
  }

  function choosePaceMode(next: PaceMode) {
    setPaceMode(next)
    if (next === 'target_date' && !targetDate && rangeValid) {
      try {
        setTargetDate(computeEndDate({ startDate, totalDafim, pagesPerDay: 1, rest }))
      } catch {
        setTargetDate(startDate)
      }
    }
  }

  function chooseRangeMode(next: RangeMode) {
    setRangeMode(next)
    if (next === 'custom' && tractate) {
      setCustomStart(FIRST_DAF)
      setCustomEnd(tractate.total_pages)
    }
  }

  function toggleWeekday(day: number) {
    setRestWeekdays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    )
  }

  function addRestDate() {
    setRestDates((current) => (current.includes(pendingRestDate) ? current : [...current, pendingRestDate].sort()))
  }

  async function save() {
    if (!tractate || 'error' in plan) return
    const input: ProgramInput = {
      tractateId: tractate.id,
      programName: programName.trim(),
      startPage,
      endPage,
      startDate,
      paceMode,
      pagesPerDay: plan.pagesPerDay,
      targetEndDate: plan.targetEndDate,
      restWeekdays: [...restWeekdays].sort((a, b) => a - b),
      restDates,
    }

    setSaving(true)
    setSaveError(null)
    try {
      let savedId: number
      if (mode === 'edit' && programId !== undefined) {
        await window.talmudonBridge.updateProgram(programId, input)
        savedId = programId
      } else {
        savedId = await window.talmudonBridge.createProgram(input)
      }
      onSaved(savedId)
    } catch (error) {
      console.error('Failed to save program', error)
      setSaveError('השמירה נכשלה, נסו שוב')
      setSaving(false)
    }
  }

  const query = search.trim().toLowerCase()
  const visibleTractates = tractates.filter(
    (item) => query === '' || item.name_he.includes(query) || item.name_en.toLowerCase().includes(query),
  )
  const selectablePages = pages.filter(
    (page) => page.page_number >= FIRST_DAF && tractate && page.page_number <= tractate.total_pages,
  )

  function renderStep(): ReactNode {
    switch (step) {
      case 0:
        return (
          <div className="space-y-5">
            <label className="block space-y-2 text-sm text-slate-300">
              <span>חיפוש מסכת</span>
              <input
                className={`${inputClass} w-full`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="שם המסכת בעברית או באנגלית"
              />
            </label>
            <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto md:grid-cols-4">
              {visibleTractates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.id === tractateId}
                  onClick={() => chooseTractate(item)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    item.id === tractateId
                      ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-100'
                      : 'border-slate-800 bg-slate-950/60 text-slate-200 hover:bg-slate-800/80'
                  }`}
                >
                  {item.name_he}
                </button>
              ))}
            </div>
            <label className="block space-y-2 text-sm text-slate-300">
              <span>שם התוכנית</span>
              <input
                className={`${inputClass} w-full`}
                value={programName}
                onChange={(event) => {
                  setNameTouched(true)
                  setProgramName(event.target.value)
                }}
              />
            </label>
          </div>
        )
      case 1:
        return (
          <div className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm text-slate-300">טווח לימוד</legend>
              {(
                [
                  ['full', 'מסכת שלמה'],
                  ['custom', 'טווח מותאם'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="radio"
                    name="range-mode"
                    checked={rangeMode === value}
                    onChange={() => chooseRangeMode(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            {rangeMode === 'custom' && (
              <div className="flex flex-wrap gap-4">
                <label className="space-y-1 text-sm text-slate-300">
                  <span className="block">מדף</span>
                  <select
                    className={inputClass}
                    value={customStart}
                    onChange={(event) => setCustomStart(Number(event.target.value))}
                  >
                    {selectablePages.map((page) => (
                      <option key={page.page_number} value={page.page_number}>
                        {page.page_label_he}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-300">
                  <span className="block">עד דף</span>
                  <select
                    className={inputClass}
                    value={customEnd}
                    onChange={(event) => setCustomEnd(Number(event.target.value))}
                  >
                    {selectablePages.map((page) => (
                      <option key={page.page_number} value={page.page_number}>
                        {page.page_label_he}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {rangeValid && (
              <p data-testid="range-summary" className="text-sm text-cyan-200">
                {labelOf(startPage)} – {labelOf(endPage)} · {formatDafCount(totalDafim)}
              </p>
            )}
          </div>
        )
      case 2:
        return (
          <div className="space-y-5">
            <div className="space-y-2 text-sm text-slate-300">
              <span className="block">תאריך התחלה</span>
              <DateField label="תאריך התחלה" value={startDate} anchor={todayIso} onChange={setStartDate} />
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm text-slate-300">איך לקבוע את הקצב?</legend>
              {(
                [
                  ['daily_pace', 'לפי קצב יומי'],
                  ['target_date', 'לפי תאריך יעד'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="radio"
                    name="pace-mode"
                    checked={paceMode === value}
                    onChange={() => choosePaceMode(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            {paceMode === 'daily_pace' ? (
              <label className="block space-y-1 text-sm text-slate-300">
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
              <div className="space-y-2 text-sm text-slate-300">
                <span className="block">תאריך יעד</span>
                <DateField label="תאריך יעד" value={targetDate || startDate} anchor={todayIso} onChange={setTargetDate} />
                <p data-testid="target-date-display" className="text-cyan-200">
                  {formatIsoDate(targetDate || startDate, calendarType)}
                </p>
              </div>
            )}
            {!('error' in plan) && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
                <p>קצב: {formatPace(plan.pagesPerDay)}</p>
                <p data-testid="end-date-summary">
                  תאריך סיום: {formatIsoDate(plan.targetEndDate, calendarType)}
                </p>
              </div>
            )}
          </div>
        )
      case 3:
        return (
          <div className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm text-slate-300">ימי מנוחה קבועים</legend>
              <div className="flex flex-wrap gap-4">
                {WEEKDAY_NAMES.map((name, day) => (
                  <label key={name} className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={restWeekdays.includes(day)}
                      onChange={() => toggleWeekday(day)}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2 text-sm text-slate-300">
              <span className="block">תאריכי מנוחה מיוחדים (חגים, אירועים)</span>
              <div className="flex flex-wrap items-center gap-3">
                <DateField label="תאריך מנוחה" value={pendingRestDate} anchor={todayIso} onChange={setPendingRestDate} />
                <button type="button" className={secondaryButton} onClick={addRestDate}>
                  הוסף תאריך
                </button>
              </div>
              <ul className="space-y-1">
                {restDates.map((date) => {
                  const text = formatIsoDate(date, calendarType)
                  return (
                    <li key={date} className="flex items-center gap-3 text-slate-200">
                      <span>{text}</span>
                      <button
                        type="button"
                        aria-label={`הסר ${text}`}
                        className="text-xs text-rose-300 hover:underline"
                        onClick={() => setRestDates((current) => current.filter((item) => item !== date))}
                      >
                        הסר
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )
      default:
        return (
          <dl data-testid="program-summary" className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-slate-400">שם התוכנית</dt>
            <dd className="text-slate-100">{programName}</dd>
            <dt className="text-slate-400">מסכת</dt>
            <dd className="text-slate-100">{tractate?.name_he}</dd>
            <dt className="text-slate-400">טווח</dt>
            <dd className="text-slate-100">
              {labelOf(startPage)} – {labelOf(endPage)} · {formatDafCount(totalDafim)}
            </dd>
            <dt className="text-slate-400">תאריך התחלה</dt>
            <dd className="text-slate-100">{formatIsoDate(startDate, calendarType)}</dd>
            {!('error' in plan) && (
              <>
                <dt className="text-slate-400">קצב</dt>
                <dd className="text-slate-100">{formatPace(plan.pagesPerDay)}</dd>
                <dt className="text-slate-400">תאריך סיום</dt>
                <dd className="text-slate-100">{formatIsoDate(plan.targetEndDate, calendarType)}</dd>
              </>
            )}
            <dt className="text-slate-400">ימי מנוחה</dt>
            <dd className="text-slate-100">
              {restWeekdays.length === 0 && restDates.length === 0
                ? 'אין'
                : [
                    ...[...restWeekdays].sort((a, b) => a - b).map((day) => WEEKDAY_NAMES[day]),
                    ...restDates.map((date) => formatIsoDate(date, calendarType)),
                  ].join(', ')}
            </dd>
          </dl>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 text-slate-100" dir="rtl" lang="he">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 p-6 lg:p-10">
        <header className="space-y-4">
          <h2 className="text-2xl font-bold text-white">
            {mode === 'edit' ? 'עריכת תוכנית לימוד' : 'יצירת תוכנית לימוד חדשה'}
          </h2>
          <ol className="flex flex-wrap gap-2 text-xs">
            {STEP_TITLES.map((title, index) => (
              <li
                key={title}
                aria-current={index === step ? 'step' : undefined}
                className={`rounded-full border px-3 py-1 ${
                  index === step
                    ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200'
                    : 'border-slate-800 text-slate-400'
                }`}
              >
                {index + 1}. {title}
              </li>
            ))}
          </ol>
        </header>

        <section className="flex-1 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          {loadError ? (
            <p role="alert" className="text-rose-300">
              {loadError}
            </p>
          ) : !loaded ? (
            <p className="text-slate-400">טוען…</p>
          ) : (
            renderStep()
          )}
        </section>

        {saveError && (
          <p role="alert" className="text-sm text-rose-300">
            {saveError}
          </p>
        )}
        {loaded && currentError && step !== STEP_TITLES.length - 1 && (
          <p className="text-sm text-amber-300">{currentError}</p>
        )}

        <footer className="flex items-center justify-between">
          <button type="button" className={secondaryButton} onClick={onCancel}>
            ביטול
          </button>
          <div className="flex gap-3">
            <button type="button" className={secondaryButton} disabled={step === 0} onClick={() => setStep(step - 1)}>
              הקודם
            </button>
            {isLastStep ? (
              <button
                type="button"
                className={primaryButton}
                disabled={!loaded || saving || 'error' in plan}
                onClick={() => void save()}
              >
                {mode === 'edit' ? 'עדכן תוכנית' : 'צור תוכנית'}
              </button>
            ) : (
              <button
                type="button"
                className={primaryButton}
                disabled={!loaded || currentError !== null}
                onClick={() => setStep(step + 1)}
              >
                הבא
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

export default StudyProgramWizard
