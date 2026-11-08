import { useEffect, useState } from 'react'
import type { StudyStats } from '../../../main/stats'

function streakLabel(days: number): string {
  return days === 1 ? 'יום אחד' : `${days} ימים`
}

function Tile({ title, value }: { title: string; value: string }) {
  return (
    <div className="card p-6">
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-2 text-3xl font-extrabold text-ink">{value}</p>
    </div>
  )
}

function StatsScreen() {
  const [stats, setStats] = useState<StudyStats | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.talmudonBridge.getStudyStats().then((loaded) => {
      if (!cancelled) setStats(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!stats) return null
  const empty = stats.currentStreak === 0 && stats.pagesLast7Days === 0 && stats.pagesLast30Days === 0

  return (
    <>
      <h1 className="mb-6 text-3xl font-bold text-ink">סטטיסטיקה</h1>
      {empty ? (
        <p className="card p-6 text-muted">עוד לא הושלמו דפים</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Tile title="רצף נוכחי" value={streakLabel(stats.currentStreak)} />
          <Tile title="דפים ב-7 הימים האחרונים" value={String(stats.pagesLast7Days)} />
          <Tile title="דפים ב-30 הימים האחרונים" value={String(stats.pagesLast30Days)} />
        </div>
      )}
    </>
  )
}

export default StatsScreen
