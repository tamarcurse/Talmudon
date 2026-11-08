import { HDate } from '@hebcal/core'

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
