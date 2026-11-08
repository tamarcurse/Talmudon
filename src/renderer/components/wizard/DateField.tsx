import { useCalendar } from '../../context/CalendarContext'
import {
  formatHebrewDay,
  formatHebrewYear,
  hebrewDaysInMonth,
  hebrewMonthsInYear,
  hebrewToIso,
  isoToHebrewParts,
} from '../../lib/hebrewDate'

const YEARS_BEFORE = 1
const YEARS_AFTER = 20

const selectClass =
  'rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none'

type DateFieldProps = {
  /** Accessible name of the whole field (the native input's aria-label, prefix of the Hebrew selects'). */
  label: string
  /** ISO `YYYY-MM-DD`. */
  value: string
  /** ISO date used to anchor the Hebrew year choices. */
  anchor: string
  onChange: (iso: string) => void
  testId?: string
}

/**
 * Date picker whose UI follows the global calendar setting, but whose value is always a
 * Gregorian ISO string. In Hebrew mode the day/month/year selects are converted on change.
 */
function DateField({ label, value, anchor, onChange, testId }: DateFieldProps) {
  const { calendarType } = useCalendar()

  if (calendarType === 'gregorian') {
    return (
      <input
        type="date"
        aria-label={label}
        value={value}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value)
        }}
        className={selectClass}
        data-testid={testId}
      />
    )
  }

  const parts = isoToHebrewParts(value)
  const anchorYear = isoToHebrewParts(anchor).year
  const firstYear = anchorYear - YEARS_BEFORE
  const years = Array.from({ length: YEARS_BEFORE + YEARS_AFTER + 1 }, (_, index) => firstYear + index)
  if (!years.includes(parts.year)) {
    years.push(parts.year)
    years.sort((a, b) => a - b)
  }
  const months = hebrewMonthsInYear(parts.year)
  const days = Array.from({ length: hebrewDaysInMonth(parts.month, parts.year) }, (_, index) => index + 1)

  function emit(next: { day: number; month: number; year: number }) {
    const { year } = next
    // Adar II only exists in leap years; fall back to the last month of the target year.
    const month = Math.min(next.month, hebrewMonthsInYear(year).length)
    const day = Math.min(next.day, hebrewDaysInMonth(month, year))
    onChange(hebrewToIso({ day, month, year }))
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-testid={testId}>
      <select
        aria-label={`${label} – יום`}
        value={parts.day}
        onChange={(event) => emit({ ...parts, day: Number(event.target.value) })}
        className={selectClass}
      >
        {days.map((day) => (
          <option key={day} value={day}>
            {formatHebrewDay(day)}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} – חודש`}
        value={parts.month}
        onChange={(event) => emit({ ...parts, month: Number(event.target.value) })}
        className={selectClass}
      >
        {months.map((month) => (
          <option key={month.month} value={month.month}>
            {month.name}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} – שנה`}
        value={parts.year}
        onChange={(event) => emit({ ...parts, year: Number(event.target.value) })}
        className={selectClass}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {formatHebrewYear(year)}
          </option>
        ))}
      </select>
    </span>
  )
}

export default DateField

