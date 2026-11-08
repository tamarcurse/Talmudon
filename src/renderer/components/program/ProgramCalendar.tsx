import { useMemo, useState } from 'react'
import type { PageProgressRecord, ProgramRecord } from '../../../main/database'
import { useCalendar } from '../../context/CalendarContext'
import {
  buildCalendarMonth,
  monthContaining,
  shiftMonth,
  type CalendarDay,
  type CalendarPageStatus,
} from '../../lib/calendarMonth'
import { formatIsoDate } from '../../lib/hebrewDate'

type Props = { program: ProgramRecord; rows: PageProgressRecord[]; today: string }

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

const STATUS_TEXT: Record<CalendarPageStatus, string> = {
  done: 'הושלם',
  overdue: 'באיחור',
  partial: 'בתהליך',
  today: 'להיום',
  future: 'מתוכנן',
}

const STATUS_CLASS: Record<CalendarPageStatus, string> = {
  done: 'bg-success-soft text-success',
  overdue: 'bg-danger-soft text-danger',
  partial: 'bg-warn-soft text-warn',
  today: 'bg-brand-soft text-brand',
  future: 'bg-canvas text-muted',
}

function cellLabel(day: CalendarDay, calendarType: 'gregorian' | 'hebrew'): string {
  const parts: string[] = []
  if (day.isRestDay) parts.push('מנוחה')
  parts.push(...day.holidays)
  parts.push(...day.pages.map((page) => `דף ${page.label} ${STATUS_TEXT[page.status]}`))
  const date = formatIsoDate(day.iso, calendarType)
  return parts.length > 0 ? `${date} – ${parts.join(', ')}` : date
}

function ProgramCalendar({ program, rows, today }: Props) {
  const { calendarType } = useCalendar()
  const [offset, setOffset] = useState(0)

  const anchor = useMemo(() => {
    const dates = rows.map((row) => row.scheduledDate).sort()
    const inRange = dates.length > 0 && today >= dates[0] && today <= dates[dates.length - 1]
    return inRange || dates.length === 0 ? today : dates[0]
  }, [rows, today])

  const monthRef = useMemo(() => {
    let ref = monthContaining(anchor, calendarType)
    const step = offset < 0 ? -1 : 1
    for (let i = 0; i < Math.abs(offset); i += 1) ref = shiftMonth(ref, step)
    return ref
  }, [anchor, calendarType, offset])

  const month = useMemo(
    () =>
      buildCalendarMonth({
        month: monthRef,
        rows,
        rest: { weekdays: program.restWeekdays, dates: program.restDates, holidays: program.restHolidays },
        today,
      }),
    [monthRef, rows, program, today],
  )

  return (
    <section className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" className="btn-secondary" onClick={() => setOffset((v) => v - 1)}>
          חודש קודם
        </button>
        <h2 className="text-xl font-bold text-ink">{month.title}</h2>
        <button type="button" className="btn-secondary" onClick={() => setOffset((v) => v + 1)}>
          חודש הבא
        </button>
      </div>
      <div role="grid" aria-label={month.title} className="grid grid-cols-7 gap-1">
        <div role="row" className="contents">
          {WEEKDAYS.map((name) => (
            <div key={name} role="columnheader" className="p-1 text-center text-sm font-semibold text-muted">
              {name}
            </div>
          ))}
        </div>
        {month.weeks.map((week, weekIndex) => (
          <div key={weekIndex} role="row" className="contents">
            {week.map((day, index) =>
              day === null ? (
                <div key={index} role="gridcell" aria-hidden="true" />
              ) : (
                <div
                  key={day.iso}
                  role="gridcell"
                  aria-label={cellLabel(day, calendarType)}
                  className={`min-h-20 rounded border p-1 text-sm ${
                    day.isToday ? 'border-brand' : 'border-line'
                  } ${day.isRestDay ? 'bg-canvas' : 'bg-surface'}`}
                >
                  <div className="font-semibold text-ink">{day.dayLabel}</div>
                  {day.holidays.map((name) => (
                    <div key={name} className="text-xs text-warn">
                      {name}
                    </div>
                  ))}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {day.pages.map((page) => (
                      <span
                        key={page.pageNumber}
                        className={`rounded px-1 text-xs ${STATUS_CLASS[page.status]}`}
                      >
                        {page.label}
                      </span>
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default ProgramCalendar
