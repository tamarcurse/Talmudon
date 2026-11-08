import type { PageProgressRecord } from '../../main/database'
import { isPageComplete } from '../../main/progress'

export type CompletionSummary = { startDate: string; endDate: string; durationDays: number }

const MS_PER_DAY = 86_400_000

/** Converts a SQLite UTC timestamp (YYYY-MM-DD HH:MM:SS) to a local ISO date. */
function utcTimestampToLocalIso(timestamp: string): string {
  const date = new Date(`${timestamp.replace(' ', 'T')}Z`)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isoToUtcDay(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY
}

export function completionSummary(rows: PageProgressRecord[], today: string): CompletionSummary | null {
  if (rows.length === 0 || !rows.every((row) => isPageComplete(row.units))) return null
  const dates = rows
    .map((row) => (row.completedAt ? utcTimestampToLocalIso(row.completedAt) : today))
    .sort()
  const startDate = dates[0]
  const endDate = dates[dates.length - 1]
  return { startDate, endDate, durationDays: Math.round(isoToUtcDay(endDate) - isoToUtcDay(startDate)) + 1 }
}

export function hadranText(tractateName: string): string {
  const t = `מסכת ${tractateName}`
  return `הדרן עלך ${t} והדרך עלן, דעתן עלך ${t} ודעתך עלן, לא נתנשי מינך ${t} ולא תתנשי מינן, לא בעלמא הדין ולא בעלמא דאתי.`
}
