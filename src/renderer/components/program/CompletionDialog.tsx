import type { CSSProperties } from 'react'
import { useCalendar } from '../../context/CalendarContext'
import { hadranText, type CompletionSummary } from '../../lib/completionSummary'
import { formatIsoDate } from '../../lib/hebrewDate'

type Props = {
  programName: string
  tractateName: string
  summary: CompletionSummary
  onClose: () => void
}

const CONFETTI_COLORS = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#e11d48', '#8b5cf6']

// Deterministic pseudo-random layout so the render stays pure.
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  delay: `${((i * 7) % 10) * 0.12}s`,
  dur: `${2.4 + ((i * 3) % 7) * 0.25}s`,
  drift: `${((i * 53) % 120) - 60}px`,
  spin: `${360 + ((i * 41) % 360)}deg`,
  round: i % 3 === 0,
}))

function Stat({ label, value, delay }: { label: string; value: string; delay: string }) {
  return (
    <div
      className="anim-rise-in rounded-2xl border border-line bg-canvas px-3 py-3 text-center"
      style={{ animationDelay: delay }}
    >
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-1 text-base font-bold text-ink">{value}</dd>
    </div>
  )
}

function CompletionDialog({ programName, tractateName, summary, onClose }: Props) {
  const { calendarType } = useCalendar()
  const duration = summary.durationDays === 1 ? 'יום אחד' : `${summary.durationDays} ימים`
  return (
    <div className="anim-fade-in fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-title"
        className="anim-pop-in relative w-full max-w-lg overflow-hidden rounded-3xl bg-surface shadow-2xl"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          {CONFETTI.map((piece, i) => (
            <span
              key={i}
              className={`confetti-piece absolute top-0 block h-2.5 w-2 ${piece.round ? 'rounded-full' : 'rounded-sm'}`}
              style={
                {
                  left: piece.left,
                  backgroundColor: piece.color,
                  '--delay': piece.delay,
                  '--dur': piece.dur,
                  '--drift': piece.drift,
                  '--spin': piece.spin,
                } as CSSProperties
              }
            />
          ))}
        </div>

        <div className="bg-gradient-to-br from-brand via-brand-strong to-sky px-6 pb-8 pt-8 text-center text-white">
          <div className="anim-badge-glow mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 shadow-lg">
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-white" fill="currentColor" aria-hidden="true">
              <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" />
            </svg>
          </div>
          <h2 id="completion-title" className="text-3xl font-extrabold">
            סיום מסכת {tractateName}!
          </h2>
          <p className="mt-1 text-sm text-white/80">{programName}</p>
        </div>

        <div className="space-y-5 p-6">
          <dl className="grid grid-cols-3 gap-3">
            <Stat label="תאריך התחלה" value={formatIsoDate(summary.startDate, calendarType)} delay="0.35s" />
            <Stat label="תאריך סיום" value={formatIsoDate(summary.endDate, calendarType)} delay="0.45s" />
            <Stat label="משך הלימוד:" value={duration} delay="0.55s" />
          </dl>

          <section aria-label="הדרן" className="anim-rise-in rounded-2xl bg-brand-soft p-4" style={{ animationDelay: '0.7s' }}>
            <h3 className="mb-1 text-sm font-bold text-brand-strong">הדרן</h3>
            <blockquote className="border-r-4 border-brand/40 pr-3 leading-relaxed text-ink">
              {hadranText(tractateName)}
            </blockquote>
          </section>

          <div className="anim-rise-in flex justify-center" style={{ animationDelay: '0.85s' }}>
            <button type="button" onClick={onClose} className="btn-primary px-8">
              סגירה
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompletionDialog
