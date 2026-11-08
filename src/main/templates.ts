// Ready-made study program templates: "Daf Yomi" aligned to the worldwide cycle, and
// "a tractate a month" ending before the same Hebrew date next month.

import { HDate } from '@hebcal/core'
import type { ProgramInput } from './database.js'
import { DAF_YOMI_CYCLE, dafYomiOn, dafYomiWindow, type DafYomiWindow } from './daf-yomi.js'
import { parseIso } from './schedule.js'

export type TemplateTractate = {
  id: number
  name_he: string
  name_en: string
  total_pages: number
  first_page: number
}

export type DafYomiMode = 'from_today' | 'from_tractate_start' | 'whole_shas'

function localIso(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function programFor(
  tractates: readonly TemplateTractate[],
  nameEn: string,
  window: DafYomiWindow,
  start: { page: number; date: string },
): ProgramInput {
  const tractate = tractates.find((item) => item.name_en === nameEn)
  if (!tractate) {
    throw new Error(`Tractate not found: ${nameEn}`)
  }
  return {
    tractateId: tractate.id,
    programName: `דף יומי – מסכת ${tractate.name_he}`,
    startPage: start.page,
    endPage: window.lastPage,
    startDate: start.date,
    paceMode: 'daily_pace',
    pagesPerDay: 1,
    targetEndDate: window.endDate,
    restWeekdays: [],
    restDates: [],
    restHolidays: [],
  }
}

/**
 * Programs that follow the worldwide Daf Yomi cycle (one daf a day, no rest days), so that
 * every daf is scheduled on the date the cycle reaches it.
 * - from_today: the tractate of the cycle (or `nameEn`) from today's daf; a tractate that has
 *   not started yet begins on the day the cycle reaches it.
 * - from_tractate_start: from the tractate's first daf on the date the cycle began it (possibly in the past).
 * - whole_shas: the current tractate from today's daf, then every tractate to the end of the cycle.
 */
export function buildDafYomiInputs(params: {
  mode: DafYomiMode
  today: string
  tractates: readonly TemplateTractate[]
  nameEn?: string
}): ProgramInput[] {
  const { mode, today, tractates } = params
  const current = dafYomiOn(today)

  const fullTractate = (name: string): ProgramInput => {
    const window = dafYomiWindow(name, today)
    return programFor(tractates, name, window, { page: window.firstPage, date: window.startDate })
  }

  const fromToday = (nameEn: string): ProgramInput => {
    const window = dafYomiWindow(nameEn, today)
    const isCurrent = nameEn === current.nameEn
    return programFor(
      tractates,
      nameEn,
      window,
      isCurrent ? { page: current.page, date: today } : { page: window.firstPage, date: window.startDate },
    )
  }

  if (mode === 'whole_shas') {
    const first = DAF_YOMI_CYCLE.findIndex((item) => item.nameEn === current.nameEn)
    const [now, ...rest] = DAF_YOMI_CYCLE.slice(first)
    return [fromToday(now.nameEn), ...rest.map((item) => fullTractate(item.nameEn))]
  }

  const nameEn = params.nameEn ?? current.nameEn
  if (mode === 'from_today') {
    return [fromToday(nameEn)]
  }
  return [fullTractate(nameEn)]
}

/**
 * Target date for a month-long program starting on `startIso`: the day before the same Hebrew
 * date in the next Hebrew month. If that month is too short for the date (the 30th in a
 * 29-day month), the last day of the month.
 */
export function hebrewMonthEndDate(startIso: string): string {
  parseIso(startIso)
  const [year, month, day] = startIso.split('-').map(Number)
  const start = new HDate(new Date(year, month - 1, day))
  const nextMonth = new HDate(1, start.getMonth(), start.getFullYear()).add(1, 'month')
  const length = HDate.daysInMonth(nextMonth.getMonth(), nextMonth.getFullYear())
  const target =
    start.getDate() <= length
      ? new HDate(new HDate(start.getDate(), nextMonth.getMonth(), nextMonth.getFullYear()).abs() - 1)
      : new HDate(length, nextMonth.getMonth(), nextMonth.getFullYear())
  return localIso(target.greg())
}

/** A whole-tractate draft with the target date set by `hebrewMonthEndDate`; rest days are left to the user. */
export function buildTractateMonthDraft(
  tractate: TemplateTractate,
  startDate: string,
): Pick<ProgramInput, 'startPage' | 'endPage' | 'paceMode' | 'targetEndDate'> {
  return {
    startPage: tractate.first_page,
    endPage: tractate.total_pages,
    paceMode: 'target_date',
    targetEndDate: hebrewMonthEndDate(startDate),
  }
}
