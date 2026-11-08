import { HDate, gematriya } from '@hebcal/core'

export type CalendarType = 'gregorian' | 'hebrew'

const gregorianFormatter = new Intl.DateTimeFormat('he-IL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatHebrewDate(date: Date): string {
  return new HDate(date).renderGematriya(true)
}

export function formatGregorianDate(date: Date): string {
  return gregorianFormatter.format(date)
}

export function formatDate(date: Date, calendarType: CalendarType): string {
  return calendarType === 'hebrew' ? formatHebrewDate(date) : formatGregorianDate(date)
}

export type HebrewParts = { day: number; month: number; year: number }

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

function dateToIso(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `month` uses hebcal numbering: 1 = Nisan … 7 = Tishrei … 12 = Adar (I), 13 = Adar II. */
export function hebrewToIso({ day, month, year }: HebrewParts): string {
  if (month < 1 || month > HDate.monthsInYear(year) || day < 1 || day > HDate.daysInMonth(month, year)) {
    throw new Error(`Invalid Hebrew date: ${day}/${month}/${year}`)
  }
  return dateToIso(new HDate(day, month, year).greg())
}

export function isoToHebrewParts(iso: string): HebrewParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) {
    throw new Error(`Invalid ISO date: ${iso}`)
  }
  const hdate = new HDate(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return { day: hdate.getDate(), month: hdate.getMonth(), year: hdate.getFullYear() }
}

/** Months of a Hebrew year in calendar order (Tishrei first), with Hebrew names. */
export function hebrewMonthsInYear(year: number): Array<{ month: number; name: string }> {
  const total = HDate.monthsInYear(year)
  const months: Array<{ month: number; name: string }> = []
  // Tishrei (7) .. last month of the year, then Nisan (1) .. Elul-1 … i.e. 7..total, 1..6
  const order = [...Array.from({ length: total - 6 }, (_, i) => 7 + i), 1, 2, 3, 4, 5, 6]
  for (const month of order) {
    months.push({ month, name: new HDate(1, month, year).render('he-x-NoNikud', false).replace(/^\d+ /, '') })
  }
  return months
}

export function hebrewDaysInMonth(month: number, year: number): number {
  return HDate.daysInMonth(month, year)
}

export function formatIsoDate(iso: string, calendarType: CalendarType): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) {
    return iso
  }
  return formatDate(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])), calendarType)
}

/** Day of the Hebrew month in letters, e.g. 24 -> כ״ד. */
export function formatHebrewDay(day: number): string {
  return gematriya(day)
}

/** Hebrew year in letters without the thousands, e.g. 5787 -> תשפ״ז. */
export function formatHebrewYear(year: number): string {
  return gematriya(year)
}
