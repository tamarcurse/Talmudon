import { describe, expect, it } from 'vitest'
import type { PageProgressRecord } from './database.js'
import {
  buildPaceSeries,
  completedLocalDate,
  computeStudyStats,
  computeStudyStreak,
  countPagesInWindow,
} from './stats.js'

const noRest = () => false
const FULL = { side_a_rashi: true, side_a_tosafot: true, side_b_rashi: true, side_b_tosafot: true }

function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

describe('completedLocalDate', () => {
  it('returns null for null', () => {
    expect(completedLocalDate(null)).toBeNull()
  })

  it('converts a UTC timestamp to the local date', () => {
    const expected = localDate(new Date(Date.UTC(2026, 10, 8, 12, 0, 0)))
    expect(completedLocalDate('2026-11-08 12:00:00')).toBe(expected)
    expect(completedLocalDate('2026-11-08 12:00:00')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('computeStudyStreak', () => {
  const today = '2026-11-08'
  it('is 0 without completions', () => {
    expect(computeStudyStreak({ completionDates: [], today, isRestDay: noRest })).toBe(0)
  })
  it('is 1 for only today', () => {
    expect(computeStudyStreak({ completionDates: [today], today, isRestDay: noRest })).toBe(1)
  })
  it('counts consecutive days', () => {
    const completionDates = ['2026-11-06', '2026-11-07', today]
    expect(computeStudyStreak({ completionDates, today, isRestDay: noRest })).toBe(3)
  })
  it('gives a grace day when nothing is done today', () => {
    const completionDates = ['2026-11-06', '2026-11-07']
    expect(computeStudyStreak({ completionDates, today, isRestDay: noRest })).toBe(2)
  })
  it('breaks on a gap on a regular day', () => {
    const completionDates = ['2026-11-05', today]
    expect(computeStudyStreak({ completionDates, today, isRestDay: noRest })).toBe(1)
  })
  it('skips rest days in the middle', () => {
    const isRestDay = (date: string) => date === '2026-11-07'
    expect(computeStudyStreak({ completionDates: ['2026-11-06', today], today, isRestDay })).toBe(2)
  })
  it('counts several pages on one day once', () => {
    expect(computeStudyStreak({ completionDates: [today, today, today], today, isRestDay: noRest })).toBe(1)
  })
  it('terminates when every day is a rest day', () => {
    expect(computeStudyStreak({ completionDates: ['2026-11-01'], today, isRestDay: () => true })).toBe(1)
  })
})

describe('countPagesInWindow', () => {
  const today = '2026-11-08'
  it('includes today and 6 days back, excludes 7 days back', () => {
    const completionDates = ['2026-11-08', '2026-11-02', '2026-11-01']
    expect(countPagesInWindow({ completionDates, today, days: 7 })).toBe(2)
  })
  it('counts pages, not days', () => {
    expect(countPagesInWindow({ completionDates: [today, today], today, days: 7 })).toBe(2)
  })
  it('handles 30 days', () => {
    const completionDates = ['2026-10-10', '2026-10-09']
    expect(countPagesInWindow({ completionDates, today, days: 30 })).toBe(1)
  })
})

describe('computeStudyStats', () => {
  const today = '2026-11-08' // Sunday
  const saturdayRest = { weekdays: [6], dates: [], holidays: [] }
  const noRestRules = { weekdays: [], dates: [], holidays: [] }
  // Friday and Sunday around Shabbat.
  const dates = ['2026-11-06', today]

  it('treats a day as rest only if it is a rest day in every active program', () => {
    const resting = computeStudyStats({
      programs: [{ status: 'active', rest: saturdayRest, completionDates: dates }],
      today,
    })
    expect(resting.currentStreak).toBe(2)
    const mixed = computeStudyStats({
      programs: [
        { status: 'active', rest: saturdayRest, completionDates: dates },
        { status: 'active', rest: noRestRules, completionDates: [] },
      ],
      today,
    })
    expect(mixed.currentStreak).toBe(1)
  })

  it('ignores rest days of paused programs but counts their pages', () => {
    const stats = computeStudyStats({
      programs: [
        { status: 'paused', rest: saturdayRest, completionDates: dates },
        { status: 'active', rest: noRestRules, completionDates: [] },
      ],
      today,
    })
    expect(stats.currentStreak).toBe(1)
    expect(stats.pagesLast7Days).toBe(2)
  })

  it('has no rest days without active programs', () => {
    const stats = computeStudyStats({
      programs: [{ status: 'paused', rest: saturdayRest, completionDates: dates }],
      today,
    })
    expect(stats.currentStreak).toBe(1)
  })

  it('adds pages across programs', () => {
    const stats = computeStudyStats({
      programs: [
        { status: 'active', rest: noRestRules, completionDates: [today] },
        { status: 'active', rest: noRestRules, completionDates: [today] },
      ],
      today,
    })
    expect(stats).toEqual({ currentStreak: 1, pagesLast7Days: 2, pagesLast30Days: 2 })
  })
})

describe('buildPaceSeries', () => {
  const today = '2026-11-09'
  it('is empty without pages', () => {
    expect(buildPaceSeries({ pages: [], startDate: '2026-11-08', today })).toEqual([])
  })

  it('builds cumulative planned and actual, null after today', () => {
    const done = { ...progressRow(2, '2026-11-08', FULL), completedAt: '2026-11-08 10:00:00' }
    const pages = [done, progressRow(3, '2026-11-09'), progressRow(4, '2026-11-10')]
    const series = buildPaceSeries({ pages, startDate: '2026-11-08', today })
    expect(series.map((point) => point.planned)).toEqual([1, 2, 3])
    expect(series.map((point) => point.actual)).toEqual([1, 1, null])
  })

  it('extends the range to today after the schedule ends', () => {
    const series = buildPaceSeries({ pages: [progressRow(2, '2026-11-08')], startDate: '2026-11-08', today })
    expect(series.at(-1)).toEqual({ date: today, planned: 1, actual: 0 })
  })

  it('starts at an earlier completion', () => {
    const pages = [{ ...progressRow(2, '2026-11-08', FULL), completedAt: '2026-11-03 12:00:00' }]
    const series = buildPaceSeries({ pages, startDate: '2026-11-08', today })
    expect(series[0].date).toBe(completedLocalDate('2026-11-03 12:00:00'))
    expect(series[0].planned).toBe(0)
  })

  it('falls back to the scheduled date for legacy completions', () => {
    const pages = [progressRow(2, '2026-11-08', FULL), progressRow(3, '2026-11-09')]
    const series = buildPaceSeries({ pages, startDate: '2026-11-08', today })
    expect(series.map((point) => point.actual)).toEqual([1, 1])
  })
})

function progressRow(
  pageNumber: number,
  scheduledDate: string,
  units: Partial<PageProgressRecord['units']> = {},
): PageProgressRecord {
  const full = { side_a_rashi: false, side_a_tosafot: false, side_b_rashi: false, side_b_tosafot: false, ...units }
  return {
    id: pageNumber,
    pageNumber,
    scheduledDate,
    units: full,
    isPageCompleted: Object.values(full).every(Boolean),
    completedAt: null,
  }
}
