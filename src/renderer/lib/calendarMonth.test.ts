import { describe, expect, it } from 'vitest'
import { progressRow } from '../../test/mockBridge'
import { buildCalendarMonth, type MonthRef } from './calendarMonth'

const NOV_2026: MonthRef = { calendarType: 'gregorian', year: 2026, month: 11 }
const CHESHVAN_5787: MonthRef = { calendarType: 'hebrew', year: 5787, month: 8 }
const ADAR_II_5787: MonthRef = { calendarType: 'hebrew', year: 5787, month: 13 }
const NO_REST = { weekdays: [], dates: [], holidays: [] }
const ALL = { rows: [], rest: NO_REST, today: '2026-11-08' }

const days = (m: ReturnType<typeof buildCalendarMonth>) => m.weeks.flat().filter((d) => d !== null)

describe('month grid', () => {
  it('builds Gregorian November 2026 with no leading padding', () => {
    const month = buildCalendarMonth({ month: NOV_2026, ...ALL })
    expect(month.title).toBe('נובמבר 2026')
    expect(month.weeks).toHaveLength(5)
    expect(month.weeks[0][0]).toMatchObject({ iso: '2026-11-01', dayLabel: '1' })
  })

  it('builds Hebrew Cheshvan 5787 starting on Monday', () => {
    const month = buildCalendarMonth({ month: CHESHVAN_5787, ...ALL })
    expect(month.title).toBe('חשון תשפ״ז')
    expect(month.weeks[0].filter((d) => d === null)).toHaveLength(1)
    const all = days(month)
    expect(all[0]).toMatchObject({ iso: '2026-10-12', dayLabel: 'א׳' })
    expect(all[all.length - 1]?.iso).toBe('2026-11-10')
  })

  it('Adar II 5787 has 29 days and starts on Wednesday', () => {
    const month = buildCalendarMonth({ month: ADAR_II_5787, ...ALL })
    expect(days(month)).toHaveLength(29)
    expect(month.weeks[0].filter((d) => d === null)).toHaveLength(3)
    expect(days(month)[0]?.iso).toBe('2027-03-10')
  })
})

describe('pages and status', () => {
  const at = (iso: string, rows = [progressRow(3, '2026-11-08')], today = '2026-11-08') =>
    days(buildCalendarMonth({ month: NOV_2026, rows, rest: NO_REST, today })).find((d) => d.iso === iso)!

  it('places pages on their day sorted with Hebrew labels', () => {
    const cell = at('2026-11-08', [progressRow(4, '2026-11-08'), progressRow(3, '2026-11-08')])
    expect(cell.pages.map((p) => [p.pageNumber, p.label])).toEqual([
      [3, "ג'"],
      [4, "ד'"],
    ])
  })

  const full = { side_a_rashi: true, side_a_tosafot: true, side_b_rashi: true, side_b_tosafot: true }
  it('done', () => {
    expect(at('2026-11-08', [progressRow(3, '2026-11-08', full)]).pages[0].status).toBe('done')
  })
  it('overdue', () => {
    expect(at('2026-11-03', [progressRow(3, '2026-11-03')]).pages[0].status).toBe('overdue')
  })
  it('partial today or later', () => {
    expect(at('2026-11-09', [progressRow(3, '2026-11-09', { side_a_rashi: true })]).pages[0].status).toBe('partial')
  })
  it('today', () => {
    expect(at('2026-11-08').pages[0].status).toBe('today')
  })
  it('future', () => {
    expect(at('2026-11-20', [progressRow(3, '2026-11-20')]).pages[0].status).toBe('future')
  })
  it('a partial page in the past is overdue', () => {
    expect(at('2026-11-03', [progressRow(3, '2026-11-03', { side_a_rashi: true })]).pages[0].status).toBe('overdue')
  })
  it('isToday only for today', () => {
    const all = days(buildCalendarMonth({ month: NOV_2026, ...ALL }))
    expect(all.filter((d) => d.isToday).map((d) => d.iso)).toEqual(['2026-11-08'])
  })
})

describe('rest and holidays', () => {
  const build = (rest: { weekdays: number[]; dates: string[]; holidays: string[] }, month: MonthRef) =>
    days(buildCalendarMonth({ month, rows: [], rest, today: '2026-11-08' }))

  it('marks rest weekdays and rest dates', () => {
    const all = build({ weekdays: [6], dates: ['2026-11-10'], holidays: [] }, NOV_2026)
    expect(all.find((d) => d.iso === '2026-11-07')?.isRestDay).toBe(true)
    expect(all.find((d) => d.iso === '2026-11-10')?.isRestDay).toBe(true)
    expect(all.find((d) => d.iso === '2026-11-09')?.isRestDay).toBe(false)
  })

  it('marks a holiday chosen as rest', () => {
    const sep: MonthRef = { calendarType: 'gregorian', year: 2026, month: 9 }
    const cell = build({ weekdays: [], dates: [], holidays: ['yom-kippur'] }, sep).find((d) => d.iso === '2026-09-21')
    expect(cell).toMatchObject({ isRestDay: true, holidays: ['יום כיפור'] })
  })

  it('shows a non-rest holiday by name only', () => {
    const dec: MonthRef = { calendarType: 'gregorian', year: 2026, month: 12 }
    const cell = build(NO_REST, dec).find((d) => d.iso === '2026-12-05')
    expect(cell?.isRestDay).toBe(false)
    expect(cell?.holidays[0]).toMatch(/^חנוכה/)
  })
})
