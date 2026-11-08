import { HDate } from '@hebcal/core'
import { describe, expect, it } from 'vitest'
import { HOLIDAY_GROUPS, holidayLeavesOnDate, isHolidayId, nextOccurrence } from './holidays.js'

function iso(date: HDate): string {
  const g = date.greg()
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`
}

describe('holiday catalog', () => {
  it('lists unique leaf ids and validates them', () => {
    const ids = HOLIDAY_GROUPS.flatMap((group) => group.leaves.map((leaf) => leaf.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(isHolidayId('chanukah-3')).toBe(true)
    expect(isHolidayId('nope')).toBe(false)
    expect(isHolidayId(5)).toBe(false)
  })
})

describe('holidayLeavesOnDate (5787, 2026-27)', () => {
  it('finds the autumn 2026 holidays', () => {
    expect(holidayLeavesOnDate('2026-09-12')).toEqual(['rosh-hashana-1'])
    expect(holidayLeavesOnDate('2026-09-13')).toEqual(['rosh-hashana-2'])
    expect(holidayLeavesOnDate('2026-09-21')).toEqual(['yom-kippur'])
    expect(holidayLeavesOnDate('2026-09-26')).toEqual(['sukkot-1'])
    expect(holidayLeavesOnDate('2026-10-03')).toEqual(['shmini-atzeret'])
    expect(holidayLeavesOnDate('2026-09-14')).toEqual(['tzom-gedalia'])
  })

  it('covers Sukkot and Pesach Chol HaMoed', () => {
    for (let day = 27; day <= 30; day += 1) {
      expect(holidayLeavesOnDate(`2026-09-${day}`)).toEqual(['sukkot-chol-hamoed'])
    }
    expect(holidayLeavesOnDate('2026-10-01')).toEqual(['sukkot-chol-hamoed'])
    expect(holidayLeavesOnDate('2026-10-02')).toEqual(['sukkot-chol-hamoed'])
    expect(holidayLeavesOnDate('2027-04-22')).toEqual(['pesach-1'])
    expect(holidayLeavesOnDate('2027-04-23')).toEqual(['pesach-chol-hamoed'])
    expect(holidayLeavesOnDate('2027-04-27')).toEqual(['pesach-chol-hamoed'])
    expect(holidayLeavesOnDate('2027-04-28')).toEqual(['pesach-7'])
    expect(holidayLeavesOnDate('2027-04-29')).toEqual([])
  })

  it('places Chanukah across the end of Kislev', () => {
    expect(holidayLeavesOnDate('2026-12-04')).toEqual([])
    expect(holidayLeavesOnDate('2026-12-05')).toEqual(['chanukah-1'])
    expect(holidayLeavesOnDate('2026-12-12')).toEqual(['chanukah-8'])
    expect(holidayLeavesOnDate('2026-12-13')).toEqual([])
  })

  it('handles Chanukah when Kislev has 29 days', () => {
    const year = [5780, 5781, 5782, 5783, 5784, 5785, 5786, 5787, 5788, 5789, 5790].find(
      (y) => HDate.daysInMonth(9, y) === 29,
    ) as number
    expect(year).toBeDefined()
    expect(holidayLeavesOnDate(iso(new HDate(29, 9, year)))).toEqual(['chanukah-5'])
    expect(holidayLeavesOnDate(iso(new HDate(1, 10, year)))).toEqual(['chanukah-6'])
    expect(holidayLeavesOnDate(iso(new HDate(3, 10, year)))).toEqual(['chanukah-8'])
    expect(holidayLeavesOnDate(iso(new HDate(4, 10, year)))).toEqual([])
  })

  it('uses Adar II for Purim in a leap year', () => {
    expect(holidayLeavesOnDate('2027-03-22')).toEqual(['taanit-esther'])
    expect(holidayLeavesOnDate('2027-03-23')).toEqual(['purim'])
    expect(holidayLeavesOnDate('2027-03-24')).toEqual(['shushan-purim'])
  })

  it('uses Adar in a regular year', () => {
    // 5786 is not a leap year: Purim is 3 March 2026.
    expect(holidayLeavesOnDate('2026-03-03')).toEqual(['purim'])
  })

  const YEARS = Array.from({ length: 20 }, (_, i) => 5780 + i)
  const adarOf = (y: number) => (HDate.isLeapYear(y) ? 13 : 12)

  it('moves Taanit Esther to Thursday when the 13th is Shabbat', () => {
    const year = YEARS.find((y) => new HDate(13, adarOf(y), y).getDay() === 6) as number
    expect(year).toBeDefined()
    const shabbat = new HDate(13, adarOf(year), year)
    expect(holidayLeavesOnDate(iso(shabbat))).toEqual([])
    const thursday = new HDate(shabbat.abs() - 2)
    expect(thursday.getDay()).toBe(4)
    expect(holidayLeavesOnDate(iso(thursday))).toEqual(['taanit-esther'])
  })

  it.each([
    ['tzom-tammuz', 17, 4],
    ['tisha-bav', 9, 5],
    ['tzom-gedalia', 3, 7],
  ])('moves %s to Sunday when it falls on Shabbat', (leaf, day, month) => {
    const year = YEARS.find((y) => new HDate(day, month, y).getDay() === 6) as number
    expect(year).toBeDefined()
    const shabbat = new HDate(day, month, year)
    expect(holidayLeavesOnDate(iso(shabbat))).toEqual([])
    const sunday = new HDate(shabbat.abs() + 1)
    expect(holidayLeavesOnDate(iso(sunday))).toEqual([leaf])
  })
})

describe('nextOccurrence', () => {
  it('returns the upcoming date, rolling to next year when passed', () => {
    expect(nextOccurrence('chanukah-1', '2026-11-08')).toEqual(['2026-12-05'])
    expect(nextOccurrence('chanukah-1', '2026-12-06')[0]).toMatch(/^2027|^2028/)
    expect(nextOccurrence('pesach-chol-hamoed', '2027-01-01')).toHaveLength(5)
    expect(nextOccurrence('unknown', '2026-11-08')).toEqual([])
  })
})
