import { describe, expect, it } from 'vitest'
import { computeEndDate, computePagesPerDay, countDafim, isStudyDay, planSchedule } from './schedule.js'

const NO_REST = { weekdays: [], dates: [] }

describe('countDafim', () => {
  it('counts dafim inclusively (Berakhot 2..64 is 63)', () => {
    expect(countDafim(2, 64)).toBe(63)
  })

  it('throws when start is after end', () => {
    expect(() => countDafim(10, 5)).toThrow()
  })
})

describe('isStudyDay', () => {
  it('is false on a rest weekday and a rest date, true otherwise', () => {
    const rest = { weekdays: [6], dates: ['2026-11-09'] }
    expect(isStudyDay('2026-11-14', rest)).toBe(false) // Saturday
    expect(isStudyDay('2026-11-09', rest)).toBe(false) // specific date (Monday)
    expect(isStudyDay('2026-11-10', rest)).toBe(true)
  })
})

describe('computeEndDate', () => {
  it('ends on the last study day with one daf per day and no rest days', () => {
    expect(
      computeEndDate({ startDate: '2026-11-08', totalDafim: 3, pagesPerDay: 1, rest: NO_REST }),
    ).toBe('2026-11-10')
  })

  it('skips rest weekdays (Fri+Sat)', () => {
    // 2026-11-08 is a Sunday. 6 dafim: Sun, Mon, Tue, Wed, Thu = 5 days, then Fri/Sat skipped, Sun 11-15 is day 6.
    expect(
      computeEndDate({
        startDate: '2026-11-08',
        totalDafim: 6,
        pagesPerDay: 1,
        rest: { weekdays: [5, 6], dates: [] },
      }),
    ).toBe('2026-11-15')
  })

  it('starts on the first study day when the start date itself is a rest day', () => {
    // Start on Saturday 2026-11-14 with Saturday rest: day 1 is Sunday 11-15.
    expect(
      computeEndDate({
        startDate: '2026-11-14',
        totalDafim: 1,
        pagesPerDay: 1,
        rest: { weekdays: [6], dates: [] },
      }),
    ).toBe('2026-11-15')
  })

  it('skips a specific rest date', () => {
    expect(
      computeEndDate({
        startDate: '2026-11-08',
        totalDafim: 3,
        pagesPerDay: 1,
        rest: { weekdays: [], dates: ['2026-11-09'] },
      }),
    ).toBe('2026-11-11')
  })

  it('handles a fractional pace (0.5 per day -> 4 dafim take 8 study days)', () => {
    expect(
      computeEndDate({ startDate: '2026-11-08', totalDafim: 4, pagesPerDay: 0.5, rest: NO_REST }),
    ).toBe('2026-11-15')
  })

  it('rounds the number of days up when there is a remainder', () => {
    // 5 dafim at 2 per day = 2.5 -> 3 days
    expect(
      computeEndDate({ startDate: '2026-11-08', totalDafim: 5, pagesPerDay: 2, rest: NO_REST }),
    ).toBe('2026-11-10')
  })

  it('crosses month and year boundaries', () => {
    expect(
      computeEndDate({ startDate: '2026-12-30', totalDafim: 4, pagesPerDay: 1, rest: NO_REST }),
    ).toBe('2027-01-02')
  })

  it('throws when every weekday is a rest day', () => {
    expect(() =>
      computeEndDate({
        startDate: '2026-11-08',
        totalDafim: 3,
        pagesPerDay: 1,
        rest: { weekdays: [0, 1, 2, 3, 4, 5, 6], dates: [] },
      }),
    ).toThrow()
  })

  it('throws when the pace is not positive', () => {
    expect(() =>
      computeEndDate({ startDate: '2026-11-08', totalDafim: 3, pagesPerDay: 0, rest: NO_REST }),
    ).toThrow()
    expect(() =>
      computeEndDate({ startDate: '2026-11-08', totalDafim: 3, pagesPerDay: -1, rest: NO_REST }),
    ).toThrow()
  })
})

describe('computePagesPerDay', () => {
  it('divides dafim by the study days in the inclusive range', () => {
    expect(
      computePagesPerDay({
        startDate: '2026-11-08',
        targetEndDate: '2026-11-11',
        totalDafim: 8,
        rest: NO_REST,
      }),
    ).toBe(2)
  })

  it('counts only study days', () => {
    // 11-08 (Sun) .. 11-15 (Sun) with Fri/Sat rest = 6 study days
    expect(
      computePagesPerDay({
        startDate: '2026-11-08',
        targetEndDate: '2026-11-15',
        totalDafim: 12,
        rest: { weekdays: [5, 6], dates: [] },
      }),
    ).toBe(2)
  })

  it('throws when the target is before the start', () => {
    expect(() =>
      computePagesPerDay({
        startDate: '2026-11-08',
        targetEndDate: '2026-11-07',
        totalDafim: 8,
        rest: NO_REST,
      }),
    ).toThrow()
  })

  it('throws when there are no study days in the range', () => {
    expect(() =>
      computePagesPerDay({
        startDate: '2026-11-08',
        targetEndDate: '2026-11-09',
        totalDafim: 8,
        rest: { weekdays: [0, 1, 2, 3, 4, 5, 6], dates: [] },
      }),
    ).toThrow()
  })
})

describe('planSchedule', () => {
  const dates = (plan: Array<{ date: string }>) => plan.map((p) => p.date)

  it('puts one page per day with no rest days', () => {
    const plan = planSchedule({ pages: [2, 3, 4], startDate: '2026-01-01', pagesPerDay: 1, rest: NO_REST })
    expect(plan).toEqual([
      { page: 2, date: '2026-01-01' },
      { page: 3, date: '2026-01-02' },
      { page: 4, date: '2026-01-03' },
    ])
  })

  it('skips Friday and Saturday', () => {
    const plan = planSchedule({ pages: [2, 3, 4], startDate: '2026-01-01', pagesPerDay: 1, rest: { weekdays: [5, 6], dates: [] } })
    expect(dates(plan)).toEqual(['2026-01-01', '2026-01-04', '2026-01-05'])
  })

  it('skips an excluded date', () => {
    const plan = planSchedule({ pages: [2, 3, 4], startDate: '2026-01-01', pagesPerDay: 1, rest: { weekdays: [], dates: ['2026-01-02'] } })
    expect(dates(plan)).toEqual(['2026-01-01', '2026-01-03', '2026-01-04'])
  })

  it('handles 0.5 pages per day, counting only study days', () => {
    expect(dates(planSchedule({ pages: [2, 3, 4], startDate: '2026-01-01', pagesPerDay: 0.5, rest: NO_REST }))).toEqual([
      '2026-01-01', '2026-01-03', '2026-01-05',
    ])
    // Saturday (01-03) is rest: study days are 01-01, 01-02, 01-04, 01-05, 01-06; pages land on days 0, 2, 4
    expect(
      dates(planSchedule({ pages: [2, 3, 4], startDate: '2026-01-01', pagesPerDay: 0.5, rest: { weekdays: [6], dates: [] } })),
    ).toEqual(['2026-01-01', '2026-01-04', '2026-01-06'])
  })

  it('handles 2 pages per day', () => {
    expect(dates(planSchedule({ pages: [2, 3, 4, 5], startDate: '2026-01-01', pagesPerDay: 2, rest: NO_REST }))).toEqual([
      '2026-01-01', '2026-01-01', '2026-01-02', '2026-01-02',
    ])
  })

  it('alternates 2,1,2,1 for 1.5 and ends on computeEndDate', () => {
    const pages = [2, 3, 4, 5, 6, 7]
    const plan = planSchedule({ pages, startDate: '2026-01-01', pagesPerDay: 1.5, rest: NO_REST })
    expect(dates(plan)).toEqual(['2026-01-01', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-03', '2026-01-04'])
    expect(plan[5].date).toBe(computeEndDate({ startDate: '2026-01-01', totalDafim: 6, pagesPerDay: 1.5, rest: NO_REST }))
  })

  it('returns [] for no pages and throws on bad input', () => {
    expect(planSchedule({ pages: [], startDate: '2026-01-01', pagesPerDay: 1, rest: NO_REST })).toEqual([])
    expect(() => planSchedule({ pages: [2], startDate: '2026-01-01', pagesPerDay: 1, rest: { weekdays: [0, 1, 2, 3, 4, 5, 6], dates: [] } })).toThrow()
    expect(() => planSchedule({ pages: [2], startDate: '2026-01-01', pagesPerDay: 0, rest: NO_REST })).toThrow()
  })
})
