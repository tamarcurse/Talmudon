const RADIUS = 40
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function ProgressPie({ percent }: { percent: number }) {
  const rounded = Math.round(percent)
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * CIRCUMFERENCE

  return (
    <svg role="img" aria-label={`הושלמו ${rounded}%`} viewBox="0 0 100 100" className="h-24 w-24 shrink-0">
      <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="12" className="stroke-slate-800" />
      <circle
        cx="50"
        cy="50"
        r={RADIUS}
        fill="none"
        strokeWidth="12"
        strokeLinecap="butt"
        strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
        transform="rotate(-90 50 50)"
        className="stroke-cyan-400"
      />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-white text-[20px] font-bold">
        {rounded}%
      </text>
    </svg>
  )
}

export default ProgressPie
