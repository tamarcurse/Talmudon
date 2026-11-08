import { describe, expect, it } from 'vitest'
import { CYCLE_LENGTH_DAYS, DAF_YOMI_CYCLE, dafYomiOn, dafYomiWindow } from './daf-yomi.js'

const addDays = (iso: string, count: number) =>
  new Date(Date.parse(iso) + count * 86400000).toISOString().slice(0, 10)

describe('Daf Yomi cycle table', () => {
  it('adds up to the 2711 days of a cycle', () => {
    const total = DAF_YOMI_CYCLE.reduce((sum, t) => sum + t.lastPage - t.firstPage + 1, 0)
    expect(total).toBe(CYCLE_LENGTH_DAYS)
  })
})

describe('dafYomiOn', () => {
  it('starts cycle 14 with Berakhot 2', () => {
    expect(dafYomiOn('2020-01-05')).toEqual({ nameEn: 'Berakhot', page: 2 })
    expect(dafYomiOn('2020-03-07')).toEqual({ nameEn: 'Berakhot', page: 64 })
    expect(dafYomiOn('2020-03-08')).toEqual({ nameEn: 'Shabbat', page: 2 })
  })

  it('ends cycle 14 with Niddah 73 and starts cycle 15 with Berakhot 2', () => {
    expect(dafYomiOn('2027-06-07')).toEqual({ nameEn: 'Niddah', page: 73 })
    expect(dafYomiOn('2027-06-08')).toEqual({ nameEn: 'Berakhot', page: 2 })
  })

  it('moves from Meilah through Kinnim, Tamid and Middot to Niddah', () => {
    const meilahLast = dafYomiWindow('Meilah', '2027-01-01').endDate
    expect(dafYomiOn(meilahLast)).toEqual({ nameEn: 'Meilah', page: 22 })
    expect(dafYomiOn(addDays(meilahLast, 1))).toEqual({ nameEn: 'Kinnim', page: 23 })
    expect(dafYomiOn(addDays(meilahLast, 3))).toEqual({ nameEn: 'Kinnim', page: 25 })
    expect(dafYomiOn(addDays(meilahLast, 4))).toEqual({ nameEn: 'Tamid', page: 26 })
    expect(dafYomiOn(addDays(meilahLast, 11))).toEqual({ nameEn: 'Tamid', page: 33 })
    expect(dafYomiOn(addDays(meilahLast, 12))).toEqual({ nameEn: 'Middot', page: 34 })
    expect(dafYomiOn(addDays(meilahLast, 15))).toEqual({ nameEn: 'Middot', page: 37 })
    expect(dafYomiOn(addDays(meilahLast, 16))).toEqual({ nameEn: 'Niddah', page: 2 })
  })

  it('repeats every 2711 days', () => {
    expect(dafYomiOn(addDays('2020-06-15', CYCLE_LENGTH_DAYS))).toEqual(dafYomiOn('2020-06-15'))
    expect(dafYomiOn(addDays('2020-06-15', 2 * CYCLE_LENGTH_DAYS))).toEqual(dafYomiOn('2020-06-15'))
  })

  it('works before the anchor date', () => {
    expect(dafYomiOn('2020-01-04')).toEqual({ nameEn: 'Niddah', page: 73 })
  })

  it('rejects an invalid date', () => {
    expect(() => dafYomiOn('2026-02-30')).toThrow()
    expect(() => dafYomiOn('nope')).toThrow()
  })
})

describe('dafYomiWindow', () => {
  it('returns the current window for the tractate being studied', () => {
    expect(dafYomiWindow('Berakhot', '2020-02-01')).toEqual({
      startDate: '2020-01-05',
      endDate: '2020-03-07',
      firstPage: 2,
      lastPage: 64,
    })
  })

  it('returns the upcoming window of a later tractate', () => {
    expect(dafYomiWindow('Shabbat', '2020-02-01')).toMatchObject({
      startDate: '2020-03-08',
      firstPage: 2,
      lastPage: 157,
    })
  })

  it('returns the next cycle for a tractate that already ended', () => {
    const next = dafYomiWindow('Berakhot', '2020-03-08')
    expect(next).toMatchObject({ startDate: '2027-06-08', firstPage: 2, lastPage: 64 })
    expect(dafYomiOn(next.startDate)).toEqual({ nameEn: 'Berakhot', page: 2 })
    expect(dafYomiOn(next.endDate)).toEqual({ nameEn: 'Berakhot', page: 64 })
  })

  it('keeps the window on its last day', () => {
    expect(dafYomiWindow('Berakhot', '2020-03-07').startDate).toBe('2020-01-05')
  })

  it('uses the cycle numbers for Tamid, not the full tractate', () => {
    expect(dafYomiWindow('Tamid', '2026-11-08')).toMatchObject({ firstPage: 26, lastPage: 33 })
  })

  it('rejects an unknown tractate and an invalid date', () => {
    expect(() => dafYomiWindow('Nope', '2026-11-08')).toThrow()
    expect(() => dafYomiWindow('Berakhot', '2026-13-01')).toThrow()
  })
})
