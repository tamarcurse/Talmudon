import type { ProgramSummary } from '../../../main/database'
import { useCalendar } from '../../context/CalendarContext'
import { formatIsoDate } from '../../lib/hebrewDate'
import ProgressPie from './ProgressPie'

type Props = {
  summary: ProgramSummary
  onOpen: (id: number) => void
  onEdit: (id: number) => void
  onToggleStatus: (summary: ProgramSummary) => void
  onDelete: (summary: ProgramSummary) => void
}

function paceLabel(lag: number, lead: number): string {
  const net = lead - lag
  if (net > 0) return `מקדים ב-${net} דפים`
  if (net < 0) return `בפיגור של ${-net} דפים`
  return 'בקצב'
}

function ProgramCard({ summary, onOpen, onEdit, onToggleStatus, onDelete }: Props) {
  const { calendarType } = useCalendar()
  const paused = summary.status === 'paused'
  const completed = summary.status === 'completed'
  const net = summary.lead - summary.lag
  const paceBadge = net < 0 ? 'badge-danger' : net > 0 ? 'badge-success' : 'badge-neutral'

  return (
    <article
      data-paused={paused}
      className={`card p-5 transition hover:-translate-y-0.5 hover:shadow-md ${paused ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold text-ink">{summary.programName}</h3>
        {paused && <span className="badge-warn">תוכנית מושהית</span>}
      </div>

      <div className="mt-4 flex items-center gap-5">
        <ProgressPie percent={summary.percentComplete} />
        <div className="space-y-2 text-sm">
          {completed ? (
            summary.completedAt && (
              <p className="font-semibold text-ink">הושלמה ב-{formatIsoDate(summary.completedAt, calendarType)}</p>
            )
          ) : (
            <>
              <p>
                <span className={paceBadge}>{paceLabel(summary.lag, summary.lead)}</span>
              </p>
              {summary.estimatedEndDate && (
                <p className="text-muted">
                  סיום משוער:{' '}
                  <span className="font-semibold text-ink">{formatIsoDate(summary.estimatedEndDate, calendarType)}</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        <button type="button" onClick={() => onOpen(summary.id)} className="btn-primary">
          כניסה לתוכנית
        </button>
        {!completed && (
          <>
            <button type="button" onClick={() => onEdit(summary.id)} className="btn-secondary">
              עריכה
            </button>
            <button type="button" onClick={() => onToggleStatus(summary)} className="btn-secondary">
              {paused ? 'הפעל מחדש' : 'השהה'}
            </button>
          </>
        )}
        <button type="button" onClick={() => onDelete(summary)} className="btn-secondary">
          מחיקה
        </button>
      </div>
    </article>
  )
}

export default ProgramCard
