import type { PageProgressRecord } from '../../main/database'
import { toHebrewPageLabel } from '../../main/hebrew-page-label'
import { HOLIDAY_GROUPS, holidayLeavesOnDate } from '../../main/holidays'
import { UNIT_KEYS, isPageComplete } from '../../main/progress'
import { isStudyDay, type RestRules } from '../../main/schedule'
import {
  formatHebrewDay,
  formatHebrewYear,
  hebrewDaysInMonth,
  hebrewMonthsInYear,
  hebrewToIso,
  isoToHebrewParts,
  type CalendarType,
} from './hebrewDate'

/** gregorian: month 1-12; hebrew: hebcal numbering (1 = Nisan … 7 = Tishrei … 13 = Adar II). */
export type MonthRef = { calendarType: CalendarType; year: number; month: number }
export type CalendarPageStatus = 'done' | 'partial' | 'overdue' | 'today' | 'future'
export type CalendarDay = {
  iso: string
  dayLabel: string
  isToday: boolean
  isRestDay: boolean
  holidays: string[]
  pages: Array<{ pageNumber: number; label: string; status: CalendarPageStatus }>
}
export type CalendarMonth = { title: string; weeks: Array<Array<CalendarDay | null>> }

const gregorianTitle = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' })

const LEAF_TO_NAME = new Map(
  HOLIDAY_GROUPS.flatMap((group) =>
    group.leaves.map((leaf) => [leaf.id, group.leaves.length > 1 ? `${group.name} · ${leaf.name}` : group.name] as const),
  ),
)

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

function gregorianIso(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

function weekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function monthDays(ref: MonthRef): Array<{ iso: string; dayLabel: string }> {
  if (ref.calendarType === 'hebrew') {
    const count = hebrewDaysInMonth(ref.month, ref.year)
    return Array.from({ length: count }, (_, i) => ({
      iso: hebrewToIso({ day: i + 1, month: ref.month, year: ref.year }),
      dayLabel: formatHebrewDay(i + 1),
    }))
  }
  const count = new Date(Date.UTC(ref.year, ref.month, 0)).getUTCDate()
  return Array.from({ length: count }, (_, i) => ({
    iso: gregorianIso(ref.year, ref.month, i + 1),
    dayLabel: String(i + 1),
  }))
}

function monthTitle(ref: MonthRef): string {
  if (ref.calendarType === 'hebrew') {
    const name = hebrewMonthsInYear(ref.year).find((entry) => entry.month === ref.month)?.name ?? ''
    return `${name} ${formatHebrewYear(ref.year)}`
  }
  return gregorianTitle.format(new Date(Date.UTC(ref.year, ref.month - 1, 1)))
}

function pageStatus(row: PageProgressRecord, today: string): CalendarPageStatus {
  if (isPageComplete(row.units)) return 'done'
  if (row.scheduledDate < today) return 'overdue'
  if (UNIT_KEYS.some((key) => row.units[key])) return 'partial'
  return row.scheduledDate === today ? 'today' : 'future'
}

export function buildCalendarMonth(p: {
  month: MonthRef
  rows: PageProgressRecord[]
  rest: RestRules
  today: string
}): CalendarMonth {
  const { month, rows, rest, today } = p
  const days: CalendarDay[] = monthDays(month).map(({ iso, dayLabel }) => ({
    iso,
    dayLabel,
    isToday: iso === today,
    isRestDay: !isStudyDay(iso, rest),
    holidays: holidayLeavesOnDate(iso).map((leaf) => LEAF_TO_NAME.get(leaf) ?? leaf),
    pages: rows
      .filter((row) => row.scheduledDate === iso)
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((row) => ({
        pageNumber: row.pageNumber,
        label: toHebrewPageLabel(row.pageNumber),
        status: pageStatus(row, today),
      })),
  }))

  const cells: Array<CalendarDay | null> = [
    ...Array.from({ length: weekday(days[0].iso) }, () => null),
    ...days,
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: Array<Array<CalendarDay | null>> = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return { title: monthTitle(month), weeks }
}

export function monthContaining(iso: string, calendarType: CalendarType): MonthRef {
  if (calendarType === 'hebrew') {
    const { month, year } = isoToHebrewParts(iso)
    return { calendarType, year, month }
  }
  const [year, month] = iso.split('-').map(Number)
  return { calendarType, year, month }
}

export function shiftMonth(ref: MonthRef, delta: 1 | -1): MonthRef {
  const { calendarType, year, month } = ref
  if (calendarType === 'gregorian') {
    const index = year * 12 + (month - 1) + delta
    return { calendarType, year: Math.floor(index / 12), month: (index % 12) + 1 }
  }
  const order = hebrewMonthsInYear(year).map((entry) => entry.month)
  const position = order.indexOf(month) + delta
  if (position >= 0 && position < order.length) {
    // Tishrei opens a new Hebrew year, so the year number only changes at the Elul/Tishrei boundary.
    return { calendarType, year, month: order[position] }
  }
  return position < 0
    ? { calendarType, year: year - 1, month: 6 }
    : { calendarType, year: year + 1, month: 7 }
}
