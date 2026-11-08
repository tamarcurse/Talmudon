import { useCalendar } from '../../context/CalendarContext'
import type { CalendarType } from '../../lib/hebrewDate'

const calendarOptions: Array<{ value: CalendarType; label: string }> = [
  { value: 'gregorian', label: 'לועזי' },
  { value: 'hebrew', label: 'עברי' },
]

function CalendarToggle() {
  const { calendarType, setCalendarType } = useCalendar()

  return (
    <div role="group" aria-label="לוח שנה" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-900 p-1">
      {calendarOptions.map((option) => {
        const isActive = option.value === calendarType
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              if (!isActive) setCalendarType(option.value)
            }}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
              isActive
                ? 'border border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                : 'border border-transparent text-slate-400 hover:bg-slate-800/80'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default CalendarToggle
