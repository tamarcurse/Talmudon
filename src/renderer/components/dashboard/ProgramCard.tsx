import type { ProgramSummary } from '../../../main/database'
import { useCalendar } from '../../context/CalendarContext'
import { formatIsoDate } from '../../lib/hebrewDate'
import ProgressPie from './ProgressPie'

type Props = {
  summary: ProgramSummary
  onOpen: (id: number) => void
  onEdit: (id: number) => void
  onToggleStatus: (summary: ProgramSummary) => void
}

function paceLabel(lag: number, lead: number): string {
  const net = lead - lag
  if (net > 0) return `מקדים ב-${net} דפים`
  if (net < 0) return `בפיגור של ${-net} דפים`
  return 'בקצב'
}

function ProgramCard({ summary, onOpen, onEdit, onToggleStatus }: Props) {
  const { calendarType } = useCalendar()
  const paused = summary.status === 'paused'
  const net = summary.lead - summary.lag

  return (
    <article
      data-paused={paused}
      className={`rounded-3xl border border-slate-800 bg-slate-900/70 p-5 transition ${paused ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold text-white">{summary.programName}</h3>
        {paused && (
          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
            תוכנית מושהית
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-5">
        <ProgressPie percent={summary.percentComplete} />
        <div className="space-y-2 text-sm">
          <p className={net < 0 ? 'text-rose-300' : 'text-emerald-300'}>{paceLabel(summary.lag, summary.lead)}</p>
          {summary.estimatedEndDate && (
            <p className="text-slate-300">
              סיום משוער:{' '}
              <span className="font-semibold text-white">{formatIsoDate(summary.estimatedEndDate, calendarType)}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => onOpen(summary.id)}
          className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 font-semibold text-cyan-200 hover:bg-cyan-500/20"
        >
          כניסה לתוכנית
        </button>
        <button
          type="button"
          onClick={() => onEdit(summary.id)}
          className="rounded-xl border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
        >
          עריכה
        </button>
        <button
          type="button"
          onClick={() => onToggleStatus(summary)}
          className="rounded-xl border border-slate-700 px-3 py-1.5 text-slate-200 hover:bg-slate-800"
        >
          {paused ? 'הפעל מחדש' : 'השהה'}
        </button>
      </div>
    </article>
  )
}

export default ProgramCard
