// Pure schedule math. All dates are ISO `YYYY-MM-DD` strings; calculations use UTC
// so the local time zone can never shift a date.

import { holidayLeavesOnDate } from './holidays.js'

export type RestRules = { weekdays: number[]; dates: string[]; holidays?: string[] }

const DAY_MS = 24 * 60 * 60 * 1000
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function parseIso(iso: string): number {
  const match = ISO_DATE.exec(iso)
  if (!match) {
    throw new Error(`Invalid ISO date: ${iso}`)
  }
  const [, y, m, d] = match
  const time = Date.UTC(Number(y), Number(m) - 1, Number(d))
  if (toIso(time) !== iso) {
    throw new Error(`Invalid ISO date: ${iso}`)
  }
  return time
}

function toIso(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

function allWeekdaysAreRest(rest: RestRules): boolean {
  return new Set(rest.weekdays).size >= 7
}

function isStudyTime(time: number, rest: RestRules): boolean {
  if (rest.weekdays.includes(new Date(time).getUTCDay())) {
    return false
  }
  const iso = toIso(time)
  if (rest.dates.includes(iso)) {
    return false
  }
  if (rest.holidays && rest.holidays.length > 0) {
    return !holidayLeavesOnDate(iso).some((leaf) => rest.holidays?.includes(leaf))
  }
  return true
}

export function isStudyDay(date: string, rest: RestRules): boolean {
  return isStudyTime(parseIso(date), rest)
}

export function countDafim(startPage: number, endPage: number): number {
  if (startPage > endPage) {
    throw new Error('Start page must not be after end page')
  }
  return endPage - startPage + 1
}

export function computeEndDate(params: {
  startDate: string
  totalDafim: number
  pagesPerDay: number
  rest: RestRules
}): string {
  const { startDate, totalDafim, pagesPerDay, rest } = params
  if (!(pagesPerDay > 0)) {
    throw new Error('Pages per day must be greater than zero')
  }
  if (!(totalDafim > 0)) {
    throw new Error('Total dafim must be greater than zero')
  }
  if (allWeekdaysAreRest(rest)) {
    throw new Error('There are no study days: every weekday is a rest day')
  }

  // Subtract a tiny epsilon so float noise (e.g. 3 / 0.1) doesn't add a phantom day.
  const studyDaysNeeded = Math.ceil(totalDafim / pagesPerDay - 1e-9)
  let time = parseIso(startDate)
  let counted = 0
  for (;;) {
    if (isStudyTime(time, rest)) {
      counted += 1
      if (counted >= studyDaysNeeded) {
        return toIso(time)
      }
    }
    time += DAY_MS
  }
}

export function computePagesPerDay(params: {
  startDate: string
  targetEndDate: string
  totalDafim: number
  rest: RestRules
}): number {
  const { startDate, targetEndDate, totalDafim, rest } = params
  const start = parseIso(startDate)
  const end = parseIso(targetEndDate)
  if (end < start) {
    throw new Error('Target end date is before the start date')
  }

  let studyDays = 0
  for (let time = start; time <= end; time += DAY_MS) {
    if (isStudyTime(time, rest)) {
      studyDays += 1
    }
  }
  if (studyDays === 0) {
    throw new Error('There are no study days between the start and target dates')
  }
  return totalDafim / studyDays
}

/**
 * Index (from 0) of the study day page i of `total` lands on. The first page is always on day 0
 * and the last on day ⌈total / pagesPerDay⌉ - 1, i.e. exactly on `computeEndDate`.
 * - pagesPerDay >= 1: page i lands on the day the pace reaches it (⌈(i+1) / pace⌉ - 1),
 *   so whole paces put exactly `pace` pages on each day.
 * - pagesPerDay < 1: each page gets its own day, spread evenly from the first to the last day.
 */
function studyDayOfPage(i: number, total: number, pagesPerDay: number): number {
  const lastDay = Math.ceil(total / pagesPerDay - 1e-9) - 1
  if (pagesPerDay >= 1) {
    return Math.ceil((i + 1) / pagesPerDay - 1e-9) - 1
  }
  return total === 1 ? lastDay : Math.round((i * lastDay) / (total - 1))
}

/** Spread `pages` over study days starting at `startDate`; the last page lands on `computeEndDate`. */
export function planSchedule(params: {
  pages: number[]
  startDate: string
  pagesPerDay: number
  rest: RestRules
}): Array<{ page: number; date: string }> {
  const { pages, startDate, pagesPerDay, rest } = params
  if (!(pagesPerDay > 0)) {
    throw new Error('Pages per day must be greater than zero')
  }
  if (allWeekdaysAreRest(rest)) {
    throw new Error('There are no study days: every weekday is a rest day')
  }
  if (pages.length === 0) {
    return []
  }

  const plan: Array<{ page: number; date: string }> = []
  let time = parseIso(startDate)
  let studyDayIndex = -1
  pages.forEach((page, i) => {
    const targetDay = studyDayOfPage(i, pages.length, pagesPerDay)
    while (studyDayIndex < targetDay) {
      if (studyDayIndex >= 0) {
        time += DAY_MS
      }
      while (!isStudyTime(time, rest)) {
        time += DAY_MS
      }
      studyDayIndex += 1
    }
    plan.push({ page, date: toIso(time) })
  })
  return plan
}
