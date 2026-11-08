import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatGregorianDate,
  formatHebrewDate,
  formatHebrewDay,
  formatHebrewYear,
  hebrewMonthsInYear,
  hebrewToIso,
  isoToHebrewParts,
} from './hebrewDate'

// 14 Dec 2025 is the day before the first day of Chanukah 5786 (25 Kislev = 15 Dec 2025).
const EREV_CHANUKAH_5786 = new Date(2025, 11, 14)

describe('formatHebrewDate', () => {
  it('renders a Gregorian date as a Hebrew calendar date in gematria', () => {
    expect(formatHebrewDate(EREV_CHANUKAH_5786)).toBe('כ״ד כסלו תשפ״ו')
  })
})

describe('formatGregorianDate', () => {
  it('renders a Gregorian date in he-IL long form', () => {
    expect(formatGregorianDate(EREV_CHANUKAH_5786)).toBe('14 בדצמבר 2025')
  })
})

describe('formatDate', () => {
  it('dispatches on the calendar type', () => {
    expect(formatDate(EREV_CHANUKAH_5786, 'hebrew')).toBe(formatHebrewDate(EREV_CHANUKAH_5786))
    expect(formatDate(EREV_CHANUKAH_5786, 'gregorian')).toBe(formatGregorianDate(EREV_CHANUKAH_5786))
  })
})

describe('hebrewToIso / isoToHebrewParts', () => {
  it('converts 24 Kislev 5786 to 2025-12-14', () => {
    expect(hebrewToIso({ day: 24, month: 9, year: 5786 })).toBe('2025-12-14')
  })

  it('round-trips an ISO date through Hebrew parts', () => {
    const parts = isoToHebrewParts('2025-12-14')
    expect(parts).toEqual({ day: 24, month: 9, year: 5786 })
    expect(hebrewToIso(parts)).toBe('2025-12-14')
  })

  it('handles Adar II in a leap year (5784 is a leap year)', () => {
    // 14 Adar II 5784 = Purim = 24 March 2024
    expect(hebrewToIso({ day: 14, month: 13, year: 5784 })).toBe('2024-03-24')
    expect(isoToHebrewParts('2024-03-24')).toEqual({ day: 14, month: 13, year: 5784 })
  })

  it('lists 13 months in a leap year and 12 otherwise', () => {
    expect(hebrewMonthsInYear(5784)).toHaveLength(13)
    expect(hebrewMonthsInYear(5786)).toHaveLength(12)
    expect(hebrewMonthsInYear(5784).map((m) => m.month)).toContain(13)
    expect(hebrewMonthsInYear(5786)[0]).toEqual({ month: 7, name: 'תשרי' })
    expect(hebrewMonthsInYear(5784).find((m) => m.month === 13)?.name).toBe('אדר ב׳')
  })

  it('throws on an invalid Hebrew date', () => {
    expect(() => hebrewToIso({ day: 31, month: 9, year: 5786 })).toThrow()
  })
})

describe('formatHebrewDay / formatHebrewYear', () => {
  it('writes days as Hebrew letters', () => {
    expect(formatHebrewDay(1)).toBe("א׳")
    expect(formatHebrewDay(15)).toBe('ט״ו')
    expect(formatHebrewDay(24)).toBe('כ״ד')
    expect(formatHebrewDay(30)).toBe("ל׳")
  })

  it('writes years as Hebrew letters without the thousands', () => {
    expect(formatHebrewYear(5786)).toBe('תשפ״ו')
    expect(formatHebrewYear(5787)).toBe('תשפ״ז')
  })
})
