// Pure study statistics: streak, rolling-window counts and the planned-vs-actual pace series.
// No DB access, so the renderer can import it the same way as progress.ts / metrics.ts.
// All dates are ISO `YYYY-MM-DD` strings; day arithmetic uses UTC so time zones never shift a date.

import type { PageProgressRecord } from './database.js'
import { isPageComplete } from './progress.js'
import { isStudyDay, type RestRules } from './schedule.js'

const DAY_MS = 24 * 60 * 60 * 1000
const SQLITE_UTC_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

export type StudyStats = { currentStreak: number; pagesLast7Days: number; pagesLast30Days: number }
export type PacePoint = { date: string; planned: number; actual: number | null }

function toTime(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`)
}

function toIso(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  return toIso(toTime(iso) + days * DAY_MS)
}

/** SQLite `CURRENT_TIMESTAMP` (UTC, `YYYY-MM-DD HH:MM:SS`) → the local calendar date `YYYY-MM-DD`. */
export function completedLocalDate(completedAt: string | null): string | null {
  if (completedAt === null) {
    return null
  }
  const match = SQLITE_UTC_TIMESTAMP.exec(completedAt)
  if (!match) {
    return null
  }
  const [y, mo, d, h, mi, s] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Consecutive study days ending today. If nothing is done yet today the count runs through
 * yesterday (grace day). Rest days without a completion neither break nor add to the streak.
 */
export function computeStudyStreak(params: {
  completionDates: string[]
  today: string
  isRestDay: (date: string) => boolean
}): number {
  const { completionDates, today, isRestDay } = params
  const done = new Set(completionDates.filter((date) => date <= today))
  if (done.size === 0) {
    return 0
  }
  // Stopping before the earliest completion also guards against an all-rest calendar.
  const earliest = [...done].sort()[0]
  let day = done.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (day >= earliest) {
    if (done.has(day)) {
      streak += 1
    } else if (!isRestDay(day)) {
      break
    }
    day = addDays(day, -1)
  }
  return streak
}

/** Pages completed in the last `days` days, today included. */
export function countPagesInWindow(params: { completionDates: string[]; today: string; days: number }): number {
  const { completionDates, today, days } = params
  const first = addDays(today, -(days - 1))
  return completionDates.filter((date) => date >= first && date <= today).length
}

export function computeStudyStats(params: {
  programs: Array<{ status: string; rest: RestRules; completionDates: string[] }>
  today: string
}): StudyStats {
  const { programs, today } = params
  const active = programs.filter((program) => program.status === 'active')
  // A rest day only when every active program rests; with none active nothing is a rest day.
  const isRestDay = (date: string) =>
    active.length > 0 && active.every((program) => !isStudyDay(date, program.rest))
  const completionDates = programs.flatMap((program) => program.completionDates)
  return {
    currentStreak: computeStudyStreak({ completionDates, today, isRestDay }),
    pagesLast7Days: countPagesInWindow({ completionDates, today, days: 7 }),
    pagesLast30Days: countPagesInWindow({ completionDates, today, days: 30 }),
  }
}

/**
 * Cumulative planned (by scheduledDate) vs actual (by local completion date) pages per day.
 * Legacy completions without `completedAt` fall back to their scheduled date.
 * `actual` is null after today.
 */
export function buildPaceSeries(params: {
  pages: PageProgressRecord[]
  startDate: string
  today: string
}): PacePoint[] {
  const { pages, startDate, today } = params
  if (pages.length === 0) {
    return []
  }
  const completions = pages
    .filter((page) => isPageComplete(page.units))
    .map((page) => completedLocalDate(page.completedAt) ?? page.scheduledDate)
  const lastScheduled = pages.reduce((max, page) => (page.scheduledDate > max ? page.scheduledDate : max), '')
  const first = completions.reduce((min, date) => (date < min ? date : min), startDate)
  const last = lastScheduled > today ? lastScheduled : today

  const plannedByDay = new Map<string, number>()
  for (const page of pages) {
    plannedByDay.set(page.scheduledDate, (plannedByDay.get(page.scheduledDate) ?? 0) + 1)
  }
  const actualByDay = new Map<string, number>()
  for (const date of completions) {
    actualByDay.set(date, (actualByDay.get(date) ?? 0) + 1)
  }

  let planned = 0
  let actual = 0
  // Anything before the first charted day still counts toward the cumulative totals.
  for (const [date, count] of plannedByDay) {
    if (date < first) planned += count
  }
  for (const [date, count] of actualByDay) {
    if (date < first) actual += count
  }
  const series: PacePoint[] = []
  for (let day = first; day <= last; day = addDays(day, 1)) {
    planned += plannedByDay.get(day) ?? 0
    actual += actualByDay.get(day) ?? 0
    series.push({ date: day, planned, actual: day > today ? null : actual })
  }
  return series
}
