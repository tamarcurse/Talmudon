import { describe, expect, it } from 'vitest'
import { DAF_YOMI_CYCLE, dafYomiOn } from './daf-yomi.js'
import { planSchedule } from './schedule.js'
import { TRACTATES_SEED } from './seed-data.js'
import {
  buildDafYomiInputs,
  buildTractateMonthDraft,
  hebrewMonthEndDate,
  type TemplateTractate,
} from './templates.js'

const TRACTATES: TemplateTractate[] = TRACTATES_SEED.map((tractate, index) => ({ id: index + 1, ...tractate }))
const idOf = (nameEn: string) => TRACTATES.find((t) => t.name_en === nameEn)!.id

const TODAY = '2026-11-08'
const current = dafYomiOn(TODAY)

describe('buildDafYomiInputs', () => {
  it('from_today: starts at today\'s daf and runs to the end of the tractate', () => {
    const [input, ...others] = buildDafYomiInputs({ mode: 'from_today', today: TODAY, tractates: TRACTATES })
    const tractate = TRACTATES.find((t) => t.name_en === current.nameEn)!
    expect(others).toEqual([])
    expect(input).toMatchObject({
      tractateId: tractate.id,
      programName: `דף יומי – מסכת ${tractate.name_he}`,
      startPage: current.page,
      startDate: TODAY,
      paceMode: 'daily_pace',
      pagesPerDay: 1,
      restWeekdays: [],
      restDates: [],
      restHolidays: [],
    })
    expect(dafYomiOn(input.targetEndDate).nameEn).toBe(current.nameEn)
  })

  it('from_tractate_start: starts at the first daf on the date the cycle began it', () => {
    const [input] = buildDafYomiInputs({ mode: 'from_tractate_start', today: TODAY, tractates: TRACTATES })
    expect(input.startDate <= TODAY).toBe(true)
    expect(dafYomiOn(input.startDate)).toEqual({ nameEn: current.nameEn, page: input.startPage })
  })

  it('a future tractate starts on the day the cycle reaches it', () => {
    const [input] = buildDafYomiInputs({ mode: 'from_today', today: '2020-02-01', tractates: TRACTATES, nameEn: 'Shabbat' })
    expect(input).toMatchObject({ tractateId: idOf('Shabbat'), startPage: 2, startDate: '2020-03-08', endPage: 157 })
    const [fromStart] = buildDafYomiInputs({
      mode: 'from_tractate_start',
      today: '2020-02-01',
      tractates: TRACTATES,
      nameEn: 'Shabbat',
    })
    expect(fromStart).toEqual(input)
  })

  it('a tractate already finished this cycle is scheduled in the next one', () => {
    const [input] = buildDafYomiInputs({ mode: 'from_today', today: '2020-04-01', tractates: TRACTATES, nameEn: 'Berakhot' })
    expect(input).toMatchObject({ startPage: 2, startDate: '2027-06-08', endPage: 64 })
  })

  it('uses the cycle range for Tamid, not the full tractate', () => {
    const [input] = buildDafYomiInputs({ mode: 'from_today', today: TODAY, tractates: TRACTATES, nameEn: 'Tamid' })
    expect(input.tractateId).toBe(idOf('Tamid'))
    expect(input.startPage).toBe(26)
    expect(input.endPage).toBe(33)
  })

  it('whole_shas: the current tractate from today, then every tractate to the end of the cycle', () => {
    const inputs = buildDafYomiInputs({ mode: 'whole_shas', today: TODAY, tractates: TRACTATES })
    const names = DAF_YOMI_CYCLE.map((t) => t.nameEn)
    const expected = names.slice(names.indexOf(current.nameEn))
    expect(inputs.map((input) => TRACTATES.find((t) => t.id === input.tractateId)!.name_en)).toEqual(expected)
    expect(inputs[0]).toMatchObject({ startPage: current.page, startDate: TODAY })
    expect(inputs.at(-1)?.tractateId).toBe(idOf('Niddah'))
    for (let i = 1; i < inputs.length; i += 1) {
      expect(inputs[i].startDate > inputs[i - 1].startDate).toBe(true)
      expect(inputs[i].startPage).toBe(DAF_YOMI_CYCLE.find((t) => t.nameEn === expected[i])!.firstPage)
    }
  })

  it('schedules every daf on the date the worldwide cycle reaches it', () => {
    for (const mode of ['from_today', 'from_tractate_start', 'whole_shas'] as const) {
      for (const input of buildDafYomiInputs({ mode, today: TODAY, tractates: TRACTATES })) {
        const pages = Array.from({ length: input.endPage - input.startPage + 1 }, (_, i) => input.startPage + i)
        const plan = planSchedule({
          pages,
          startDate: input.startDate,
          pagesPerDay: input.pagesPerDay,
          rest: { weekdays: input.restWeekdays, dates: input.restDates, holidays: input.restHolidays },
        })
        const tractateName = TRACTATES.find((t) => t.id === input.tractateId)!.name_en
        for (const { page, date } of plan) {
          expect(dafYomiOn(date)).toEqual({ nameEn: tractateName, page })
        }
        expect(plan.at(-1)?.date).toBe(input.targetEndDate)
      }
    }
  })

  it('fails clearly when a tractate is missing from the list', () => {
    const without = TRACTATES.filter((t) => t.name_en !== 'Middot')
    expect(() => buildDafYomiInputs({ mode: 'whole_shas', today: TODAY, tractates: without })).toThrow(/Middot/)
  })

  it('rejects an invalid date', () => {
    expect(() => buildDafYomiInputs({ mode: 'from_today', today: '2026-02-30', tractates: TRACTATES })).toThrow()
  })
})

describe('hebrewMonthEndDate', () => {
  it('ends the day before the same Hebrew date next month', () => {
    // 15 Cheshvan 5787 = 2026-10-26; 14 Kislev 5787 = 2026-11-24
    expect(hebrewMonthEndDate('2026-10-26')).toBe('2026-11-24')
  })

  it('keeps the same date when the next month is just as long', () => {
    // 30 Cheshvan 5787 (2026-11-10) -> Kislev has 30 days -> 29 Kislev
    expect(hebrewMonthEndDate('2026-11-10')).toBe('2026-12-09')
  })

  it('clamps to the last day when the next month is shorter', () => {
    // 30 Kislev 5786 (2025-12-20) -> Tevet has only 29 days -> 29 Tevet
    expect(hebrewMonthEndDate('2025-12-20')).toBe('2026-01-18')
  })

  it('handles Adar I and Adar II in a leap year', () => {
    // 5787 is a leap year. 10 Adar I = 2027-02-17 -> 9 Adar II = 2027-03-18
    expect(hebrewMonthEndDate('2027-02-17')).toBe('2027-03-18')
    // 10 Adar II = 2027-03-19 -> 9 Nisan = 2027-04-16
    expect(hebrewMonthEndDate('2027-03-19')).toBe('2027-04-16')
  })

  it('carries across the new Hebrew year', () => {
    // 10 Elul 5786 = 2026-08-23 -> 9 Tishrei 5787 = 2026-09-20
    expect(hebrewMonthEndDate('2026-08-23')).toBe('2026-09-20')
  })

  it('rejects an invalid date', () => {
    expect(() => hebrewMonthEndDate('2026-02-30')).toThrow()
  })
})

describe('buildTractateMonthDraft', () => {
  it('returns the full range and a Hebrew month target date', () => {
    const tamid = TRACTATES.find((t) => t.name_en === 'Tamid')!
    expect(buildTractateMonthDraft(tamid, '2026-10-26')).toEqual({
      startPage: 25,
      endPage: 33,
      paceMode: 'target_date',
      targetEndDate: '2026-11-24',
    })
  })
})
