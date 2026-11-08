import { describe, expect, it } from 'vitest'
import { formatDate, formatGregorianDate, formatHebrewDate } from './hebrewDate'

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
