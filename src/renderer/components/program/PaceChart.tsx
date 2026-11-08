import type { PacePoint } from '../../../main/stats'

type Props = { series: PacePoint[]; today: string }

const WIDTH = 640
const HEIGHT = 220
const PAD = { top: 12, right: 16, bottom: 28, left: 40 }

function linePath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
}

/** Cumulative planned (dashed) vs actual (solid) pages. Inline SVG, no chart dependency. */
function PaceChart({ series, today }: Props) {
  if (series.length === 0) return null

  const todayPoint = series.find((point) => point.date === today) ?? series[series.length - 1]
  const studied = todayPoint.actual ?? 0
  const planned = todayPoint.planned
  const summary = `נלמדו ${studied} מתוך ${planned} דפים מתוכננים עד היום`

  const maxY = Math.max(1, ...series.map((point) => Math.max(point.planned, point.actual ?? 0)))
  const innerW = WIDTH - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const x = (index: number) => PAD.left + (series.length === 1 ? innerW / 2 : (index / (series.length - 1)) * innerW)
  const y = (value: number) => PAD.top + innerH - (value / maxY) * innerH

  const plannedPoints = series.map((point, index) => ({ x: x(index), y: y(point.planned) }))
  const actualPoints = series.flatMap((point, index) =>
    point.actual === null ? [] : [{ x: x(index), y: y(point.actual) }],
  )
  const todayIndex = series.findIndex((point) => point.date === today)

  return (
    <section className="card mb-6 p-6" aria-labelledby="pace-chart-title">
      <h2 id="pace-chart-title" className="text-lg font-bold text-ink">
        קצב לימוד: בפועל מול מתוכנן
      </h2>
      <p className="mt-1 text-sm text-muted">{summary}</p>
      {studied > planned && (
        <p className="text-sm text-success">אתם מקדימים את התוכנית ב-{studied - planned} דפים</p>
      )}
      <svg
        role="img"
        aria-label={`גרף קצב לימוד. ${summary}`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-3 w-full"
        style={{ direction: 'ltr' }}
      >
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(maxY * fraction)}
              y2={y(maxY * fraction)}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
            <text x={PAD.left - 6} y={y(maxY * fraction) + 4} textAnchor="end" fontSize="11" fill="var(--color-muted)">
              {Math.round(maxY * fraction)}
            </text>
          </g>
        ))}
        {todayIndex >= 0 && (
          <line x1={x(todayIndex)} x2={x(todayIndex)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--color-line)" />
        )}
        <path d={linePath(plannedPoints)} fill="none" stroke="var(--color-muted)" strokeWidth="2" strokeDasharray="6 4" />
        <path d={linePath(actualPoints)} fill="none" stroke="var(--color-brand)" strokeWidth="2" />
        {actualPoints.length > 0 && (
          <circle
            cx={actualPoints[actualPoints.length - 1].x}
            cy={actualPoints[actualPoints.length - 1].y}
            r="4"
            fill="var(--color-brand)"
            stroke="var(--color-surface)"
            strokeWidth="2"
          />
        )}
        <text x={PAD.left} y={HEIGHT - 8} fontSize="11" fill="var(--color-muted)">
          {series[0].date}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 8} fontSize="11" fill="var(--color-muted)" textAnchor="end">
          {series[series.length - 1].date}
        </text>
      </svg>
      <ul className="mt-2 flex gap-5 text-sm text-ink">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-0 w-6 border-t-2 border-brand" /> בפועל
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-0 w-6 border-t-2 border-dashed border-muted" /> מתוכנן
        </li>
      </ul>
    </section>
  )
}

export default PaceChart
