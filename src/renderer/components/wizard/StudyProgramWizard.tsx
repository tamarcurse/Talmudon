import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PaceMode, ProgramInput } from '../../../main/database'
import { useCalendar } from '../../context/CalendarContext'
import { formatIsoDate } from '../../lib/hebrewDate'
import { computeEndDate, computePagesPerDay, countDafim } from '../../../main/schedule'
import { DAF_YOMI_CYCLE, dafYomiOn } from '../../../main/daf-yomi'
import { buildDafYomiInputs, hebrewMonthEndDate, type DafYomiMode } from '../../../main/templates'
import { HOLIDAY_GROUPS } from '../../../main/holidays'
import DateField from './DateField'
import HolidayPicker from './HolidayPicker'

type Tractate = { id: number; name_he: string; name_en: string; total_pages: number; first_page: number }
type ShasPage = { page_number: number; page_label_he: string }
type RangeMode = 'full' | 'custom'

type Template = 'daf_yomi' | 'tractate_month' | 'custom'
type StepKey = 'template' | 'tractate' | 'range' | 'rest' | 'pace' | 'summary'

const STEP_TITLES: Record<StepKey, string> = {
  template: 'תבנית',
  tractate: 'מסכת',
  range: 'טווח',
  rest: 'ימי מנוחה',
  pace: 'קצב',
  summary: 'סיכום',
}
const CREATE_STEPS: StepKey[] = ['template', 'tractate', 'range', 'rest', 'pace', 'summary']
const EDIT_STEPS: StepKey[] = ['tractate', 'range', 'rest', 'pace', 'summary']
const DAF_YOMI_MODES: Array<[DafYomiMode, string]> = [
  ['from_today', 'מהיום'],
  ['from_tractate_start', 'מתחילת המסכת'],
  ['whole_shas', 'כל הש"ס'],
]
const CYCLE_NAMES = new Set(DAF_YOMI_CYCLE.map((item) => item.nameEn))
const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

const inputClass = 'field'

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

function summarizeHolidays(selected: string[]): string {
  const parts: string[] = []
  for (const group of HOLIDAY_GROUPS) {
    const chosen = group.leaves.filter((leaf) => selected.includes(leaf.id))
    if (chosen.length === 0) continue
    parts.push(
      chosen.length === group.leaves.length
        ? group.name
        : `${group.name} (${chosen.map((leaf) => leaf.name).join(', ')})`,
    )
  }
  return parts.length === 0 ? 'אין' : parts.join(', ')
}

type Plan = { pagesPerDay: number; targetEndDate: string } | { error: string }

function StudyProgramWizard({ mode, programId, today, onSaved, onCancel }: StudyProgramWizardProps) {
  const { calendarType } = useCalendar()
  const todayIso = today ?? localTodayIso()

  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tractates, setTractates] = useState<Tractate[]>([])
  const [pages, setPages] = useState<ShasPage[]>([])

  const steps = mode === 'edit' ? EDIT_STEPS : CREATE_STEPS
  const [step, setStep] = useState(0)
  const [template, setTemplate] = useState<Template | null>(null)
  const [dafYomiMode, setDafYomiMode] = useState<DafYomiMode>('from_today')
  const [dafYomiTractate, setDafYomiTractate] = useState('')
  const [batch, setBatch] = useState<ProgramInput[] | null>(null)
  const [targetTouched, setTargetTouched] = useState(false)
  const [search, setSearch] = useState('')
  const [tractateId, setTractateId] = useState<number | null>(null)
  const [programName, setProgramName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [rangeMode, setRangeMode] = useState<RangeMode>('full')
  const [customStart, setCustomStart] = useState(2)
  const [customEnd, setCustomEnd] = useState(2)
  const [startDate, setStartDate] = useState(todayIso)
  const [paceMode, setPaceMode] = useState<PaceMode>('daily_pace')
  const [paceInput, setPaceInput] = useState('1')
  const [targetDate, setTargetDate] = useState('')
  const [restWeekdays, setRestWeekdays] = useState<number[]>([])
  const [restDates, setRestDates] = useState<string[]>([])
  const [restHolidays, setRestHolidays] = useState<string[]>([])
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
          const isFull = program.startPage === tractate?.first_page && program.endPage === tractate?.total_pages
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
          setRestHolidays(program.restHolidays)
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

  const firstDaf = tractate?.first_page ?? 2
  const startPage = rangeMode === 'full' ? firstDaf : customStart
  const endPage = rangeMode === 'full' ? (tractate?.total_pages ?? firstDaf) : customEnd
  const rangeValid =
    tractate !== null && startPage >= firstDaf && startPage <= endPage && endPage <= tractate.total_pages
  const totalDafim = rangeValid ? countDafim(startPage, endPage) : 0
  const rest = useMemo(
    () => ({ weekdays: restWeekdays, dates: restDates, holidays: restHolidays }),
    [restWeekdays, restDates, restHolidays],
  )

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

  const dafYomiToday = useMemo(() => {
    try {
      return dafYomiOn(todayIso)
    } catch {
      return null
    }
  }, [todayIso])
  const dafYomiTractateName = dafYomiTractate || dafYomiToday?.nameEn || ''
  const dafYomiResult = useMemo(() => {
    if (template !== 'daf_yomi') return { inputs: [] as ProgramInput[], error: null as string | null }
    try {
      return {
        inputs: buildDafYomiInputs({
          mode: dafYomiMode,
          today: todayIso,
          tractates,
          nameEn: dafYomiMode === 'whole_shas' ? undefined : dafYomiTractateName,
        }),
        error: null,
      }
    } catch {
      return { inputs: [] as ProgramInput[], error: 'לא ניתן לבנות תוכנית דף יומי: חסרות מסכתות ברשימה' }
    }
  }, [template, dafYomiMode, todayIso, tractates, dafYomiTractateName])

  const stepErrors: Record<StepKey, string | null> = {
    template: template === null ? 'יש לבחור תבנית' : template === 'daf_yomi' ? dafYomiResult.error : null,
    tractate: tractateId === null ? 'יש לבחור מסכת' : programName.trim() === '' ? 'יש להזין שם לתוכנית' : null,
    range: rangeValid ? null : 'טווח הלימוד אינו תקין',
    rest: restWeekdays.length >= 7 ? 'לא ניתן לסמן את כל ימי השבוע כימי מנוחה' : null,
    pace: 'error' in plan ? plan.error : null,
    summary: null,
  }
  const stepKey = steps[step]
  const currentError = stepErrors[stepKey]
  const isLastStep = stepKey === 'summary'

  function fillFromInput(input: ProgramInput) {
    const target = tractates.find((item) => item.id === input.tractateId)
    setTractateId(input.tractateId)
    setProgramName(input.programName)
    setNameTouched(true)
    setRangeMode(
      target && input.startPage === target.first_page && input.endPage === target.total_pages ? 'full' : 'custom',
    )
    setCustomStart(input.startPage)
    setCustomEnd(input.endPage)
    setStartDate(input.startDate)
    setPaceMode(input.paceMode)
    setPaceInput(String(input.pagesPerDay))
    setTargetDate(input.targetEndDate)
    setTargetTouched(false)
    setRestWeekdays(input.restWeekdays)
    setRestDates(input.restDates)
    setRestHolidays(input.restHolidays)
  }

  function goNext() {
    if (stepKey === 'template' && template === 'daf_yomi') {
      if (dafYomiMode === 'whole_shas') {
        setBatch(dafYomiResult.inputs)
      } else {
        setBatch(null)
        fillFromInput(dafYomiResult.inputs[0])
      }
      setStep(steps.indexOf('summary'))
      return
    }
    setStep(step + 1)
  }

  function goBack() {
    if (isLastStep && batch) {
      setBatch(null)
      setStep(steps.indexOf('template'))
      return
    }
    setStep(step - 1)
  }

  function chooseTemplate(next: Template) {
    setTemplate(next)
    if (next === 'tractate_month') {
      setPaceMode('target_date')
      setTargetDate(hebrewMonthEndDate(startDate))
      setTargetTouched(false)
    }
  }

  function changeStartDate(next: string) {
    setStartDate(next)
    if (template === 'tractate_month' && !targetTouched) {
      setTargetDate(hebrewMonthEndDate(next))
    }
  }

  function changeTargetDate(next: string) {
    setTargetTouched(true)
    setTargetDate(next)
  }

  function chooseTractate(item: Tractate) {
    setTractateId(item.id)
    if (!nameTouched) setProgramName(`מסכת ${item.name_he}`)
    setRangeMode('full')
    setCustomStart(item.first_page)
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
      setCustomStart(tractate.first_page)
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
    if (batch) {
      setSaving(true)
      setSaveError(null)
      try {
        const ids = await window.talmudonBridge.createPrograms(batch)
        onSaved(ids[0])
      } catch (error) {
        console.error('Failed to save programs', error)
        setSaveError('השמירה נכשלה, נסו שוב')
        setSaving(false)
      }
      return
    }
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
      restHolidays,
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
    (page) => page.page_number >= firstDaf && tractate && page.page_number <= tractate.total_pages,
  )

  function renderTemplateStep(): ReactNode {
    const todayTractate = tractates.find((item) => item.name_en === dafYomiToday?.nameEn)
    const cycleTractates = tractates.filter((item) => CYCLE_NAMES.has(item.name_en))
    const cards: Array<[Template, string, string]> = [
      ['daf_yomi', 'דף יומי', 'לומדים כל יום את הדף של הסבב העולמי'],
      ['tractate_month', 'מסכת בחודש', 'מסכת שלמה, עד אותו תאריך עברי בחודש הבא'],
      ['custom', 'תוכנית מותאמת אישית', 'בוחרים בעצמכם מסכת, טווח וקצב'],
    ]
    return (
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          {cards.map(([value, title, description]) => (
            <button
              key={value}
              type="button"
              aria-pressed={template === value}
              onClick={() => chooseTemplate(value)}
              className={`rounded-xl border px-4 py-4 text-start ${
                template === value ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
              }`}
            >
              <span className="block font-semibold text-ink">{title}</span>
              <span className="block text-sm text-muted">{description}</span>
            </button>
          ))}
        </div>
        {template === 'daf_yomi' && (
          <div className="space-y-4">
            {dafYomiToday && (
              <p data-testid="daf-yomi-today" className="text-sm text-brand">
                הדף היום: {todayTractate?.name_he ?? dafYomiToday.nameEn} {labelOf(dafYomiToday.page)}
              </p>
            )}
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm text-muted">מאיפה מתחילים?</legend>
              {DAF_YOMI_MODES.map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                >
                  <input
                    type="radio"
                    name="daf-yomi-mode"
                    checked={dafYomiMode === value}
                    onChange={() => setDafYomiMode(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            {dafYomiMode !== 'whole_shas' && (
              <label className="block space-y-1 text-sm text-muted">
                <span>מסכת</span>
                <select
                  className={inputClass}
                  value={dafYomiTractateName}
                  onChange={(event) => setDafYomiTractate(event.target.value)}
                >
                  {cycleTractates.map((item) => (
                    <option key={item.id} value={item.name_en}>
                      {item.name_he}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </div>
    )
  }

  function renderBatchSummary(): ReactNode {
    const first = batch?.[0]
    const last = batch?.at(-1)
    return (
      <dl data-testid="program-summary" className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-muted">תבנית</dt>
        <dd className="text-ink">דף יומי – כל הש"ס</dd>
        <dt className="text-muted">מספר תוכניות</dt>
        <dd className="text-ink">{batch?.length}</dd>
        {first && last && (
          <>
            <dt className="text-muted">תאריך התחלה</dt>
            <dd className="text-ink">{formatIsoDate(first.startDate, calendarType)}</dd>
            <dt className="text-muted">תאריך סיום</dt>
            <dd className="text-ink">{formatIsoDate(last.targetEndDate, calendarType)}</dd>
          </>
        )}
        <dt className="text-muted">קצב</dt>
        <dd className="text-ink">{formatPace(1)}</dd>
      </dl>
    )
  }

  function renderStep(): ReactNode {
    switch (stepKey) {
      case 'template':
        return renderTemplateStep()
      case 'tractate':
        return (
          <div className="space-y-5">
            <label className="block space-y-2 text-sm text-muted">
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
                  className={item.id === tractateId ? 'chip-active' : 'chip'}
                >
                  {item.name_he}
                </button>
              ))}
            </div>
            <label className="block space-y-2 text-sm text-muted">
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
      case 'range':
        return (
          <div className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm text-muted">טווח לימוד</legend>
              {(
                [
                  ['full', 'מסכת שלמה'],
                  ['custom', 'טווח מותאם'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
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
                <label className="space-y-1 text-sm text-muted">
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
                <label className="space-y-1 text-sm text-muted">
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
              <p data-testid="range-summary" className="text-sm text-brand">
                {labelOf(startPage)} – {labelOf(endPage)} · {formatDafCount(totalDafim)}
              </p>
            )}
          </div>
        )
      case 'rest':
        return (
          <div className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm text-muted">ימי מנוחה קבועים</legend>
              <div className="flex flex-wrap gap-4">
                {WEEKDAY_NAMES.map((name, day) => (
                  <label key={name} className="flex items-center gap-2 text-sm text-ink">
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
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm text-muted">חגים ומועדים</legend>
              <HolidayPicker selected={restHolidays} onChange={setRestHolidays} fromIso={startDate} />
            </fieldset>
            <div className="space-y-2 text-sm text-muted">
              <span className="block">תאריכי מנוחה מיוחדים (חגים, אירועים)</span>
              <div className="flex flex-wrap items-center gap-3">
                <DateField label="תאריך מנוחה" value={pendingRestDate} anchor={todayIso} onChange={setPendingRestDate} />
                <button type="button" className="btn-secondary" onClick={addRestDate}>
                  הוסף תאריך
                </button>
              </div>
              <ul className="space-y-1">
                {restDates.map((date) => {
                  const text = formatIsoDate(date, calendarType)
                  return (
                    <li key={date} className="flex items-center gap-3 text-ink">
                      <span>{text}</span>
                      <button
                        type="button"
                        aria-label={`הסר ${text}`}
                        className="text-xs text-danger hover:underline"
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
      case 'pace':
        return (
          <div className="space-y-5">
            <div className="space-y-2 text-sm text-muted">
              <span className="block">תאריך התחלה</span>
              <DateField label="תאריך התחלה" value={startDate} anchor={todayIso} onChange={changeStartDate} />
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm text-muted">איך לקבוע את הקצב?</legend>
              {(
                [
                  ['daily_pace', 'לפי קצב יומי'],
                  ['target_date', 'לפי תאריך יעד'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
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
              <div className="space-y-2 text-sm text-muted">
                <span className="block">תאריך יעד</span>
                <DateField label="תאריך יעד" value={targetDate || startDate} anchor={todayIso} onChange={changeTargetDate} />
                <p data-testid="target-date-display" className="text-brand">
                  {formatIsoDate(targetDate || startDate, calendarType)}
                </p>
              </div>
            )}
            {!('error' in plan) && (
              <div className="rounded-xl border border-brand/20 bg-brand-soft p-3 text-sm text-ink">
                <p>קצב: {formatPace(plan.pagesPerDay)}</p>
                <p data-testid="end-date-summary">
                  תאריך סיום: {formatIsoDate(plan.targetEndDate, calendarType)}
                </p>
              </div>
            )}
          </div>
        )
      default:
        return batch ? renderBatchSummary() : (
          <dl data-testid="program-summary" className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted">שם התוכנית</dt>
            <dd className="text-ink">{programName}</dd>
            <dt className="text-muted">מסכת</dt>
            <dd className="text-ink">{tractate?.name_he}</dd>
            <dt className="text-muted">טווח</dt>
            <dd className="text-ink">
              {labelOf(startPage)} – {labelOf(endPage)} · {formatDafCount(totalDafim)}
            </dd>
            <dt className="text-muted">תאריך התחלה</dt>
            <dd className="text-ink">{formatIsoDate(startDate, calendarType)}</dd>
            {!('error' in plan) && (
              <>
                <dt className="text-muted">קצב</dt>
                <dd className="text-ink">{formatPace(plan.pagesPerDay)}</dd>
                <dt className="text-muted">תאריך סיום</dt>
                <dd className="text-ink">{formatIsoDate(plan.targetEndDate, calendarType)}</dd>
              </>
            )}
            <dt className="text-muted">ימי מנוחה</dt>
            <dd className="text-ink">
              {restWeekdays.length === 0 && restDates.length === 0
                ? 'אין'
                : [
                    ...[...restWeekdays].sort((a, b) => a - b).map((day) => WEEKDAY_NAMES[day]),
                    ...restDates.map((date) => formatIsoDate(date, calendarType)),
                  ].join(', ')}
            </dd>
            <dt className="text-muted">חגים</dt>
            <dd className="text-ink">{summarizeHolidays(restHolidays)}</dd>
          </dl>
        )
    }
  }

  return (
    <div className="text-ink">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="space-y-4">
          <h2 className="text-2xl font-bold text-ink">
            {mode === 'edit' ? 'עריכת תוכנית לימוד' : 'יצירת תוכנית לימוד חדשה'}
          </h2>
          <ol className="flex flex-wrap items-center gap-3 text-sm">
            {steps.map((key, index) => (
              <li
                key={key}
                aria-current={index === step ? 'step' : undefined}
                className={`flex items-center gap-2 ${index === step ? 'font-semibold text-brand' : 'text-muted'}`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
                    index < step
                      ? 'border-brand bg-brand text-white'
                      : index === step
                        ? 'border-brand bg-surface text-brand'
                        : 'border-line bg-surface text-muted'
                  }`}
                >
                  {index + 1}
                </span>
                <span>{STEP_TITLES[key]}</span>
                {index < steps.length - 1 && <span aria-hidden="true" className="h-px w-6 bg-line" />}
              </li>
            ))}
          </ol>
        </header>

        <section className="flex-1 card p-8">
          {loadError ? (
            <p role="alert" className="text-danger">
              {loadError}
            </p>
          ) : !loaded ? (
            <p className="text-muted">טוען…</p>
          ) : (
            renderStep()
          )}
        </section>

        {saveError && (
          <p role="alert" className="text-sm text-danger">
            {saveError}
          </p>
        )}
        {loaded && currentError && !isLastStep && (
          <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{currentError}</p>
        )}

        <footer className="flex items-center justify-between">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            ביטול
          </button>
          <div className="flex gap-3">
            <button type="button" className="btn-secondary" disabled={step === 0} onClick={goBack}>
              הקודם
            </button>
            {isLastStep ? (
              <button
                type="button"
                className="btn-primary"
                disabled={!loaded || saving || (!batch && 'error' in plan)}
                onClick={() => void save()}
              >
                {mode === 'edit' ? 'עדכן תוכנית' : 'צור תוכנית'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                disabled={!loaded || currentError !== null}
                onClick={goNext}
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
