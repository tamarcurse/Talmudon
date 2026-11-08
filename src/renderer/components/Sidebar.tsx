import { useCalendar } from '../context/CalendarContext'
import { formatDate, type CalendarType } from '../lib/hebrewDate'

const navItems = ['לוח ראשי', 'תוכניות', 'רשימות', 'מחקרים', 'הגדרות']

const calendarOptions: Array<{ value: CalendarType; label: string }> = [
  { value: 'gregorian', label: 'לועזי' },
  { value: 'hebrew', label: 'עברי' },
]

function Sidebar() {
  const { calendarType, setCalendarType } = useCalendar()
  const today = new Date()

  return (
    <aside className="w-72 border-l border-slate-800 bg-slate-900/80 p-6 backdrop-blur-sm">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-lg font-bold text-cyan-300">
          ת
        </div>
        <div>
          <p className="text-xs text-slate-400">Desktop Workspace</p>
          <h1 className="text-xl font-bold text-white">Talmudon</h1>
        </div>
      </div>

      <nav className="space-y-2 text-sm text-slate-300">
        {navItems.map((item, index) => (
          <button
            key={item}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-right transition ${
              index === 0 ? 'bg-slate-800 text-white shadow-inner shadow-slate-700/30' : 'hover:bg-slate-800/80'
            }`}
            type="button"
          >
            <span>{item}</span>
            <span className="text-xs text-slate-500">0{index + 1}</span>
          </button>
        ))}
      </nav>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-4" aria-labelledby="calendar-toggle-label">
        <p id="calendar-toggle-label" className="text-xs text-slate-400">
          לוח שנה
        </p>
        <div role="group" aria-labelledby="calendar-toggle-label" className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-900 p-1">
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
        <p data-testid="sample-date" className="mt-3 text-center text-sm text-slate-200">
          {formatDate(today, calendarType)}
        </p>
      </section>

      <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        <p className="font-semibold">מצב אופליין</p>
        <p className="mt-1 text-emerald-100/80">כל הנתונים נשמרים מקומית, ללא תלות ברשת.</p>
      </div>
    </aside>
  )
}

export default Sidebar
