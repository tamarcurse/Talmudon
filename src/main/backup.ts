import type { ProgramStatus } from './database.js'
import { CALENDAR_TYPES, PACE_MODES, SETTABLE_PROGRAM_STATUSES, type CalendarType, type PaceMode } from './domain.js'
import { isValidIsoDate } from './dates.js'
import { UNIT_KEYS, type UnitFlags } from './progress.js'

export const BACKUP_FORMAT = 'talmudon-backup'
export const BACKUP_VERSION = 1

export type BackupPage = {
  pageNumber: number
  scheduledDate: string
  units: UnitFlags
  completedAt: string | null
}

export type BackupProgram = {
  uid: string
  tractateId: number
  tractateNameEn: string
  programName: string
  startPage: number
  endPage: number
  startDate: string
  paceMode: PaceMode
  pagesPerDay: number
  targetEndDate: string
  status: ProgramStatus
  pausedAt: string | null
  completedAt: string | null
  createdAt: string | null
  restWeekdays: number[]
  restDates: string[]
  restHolidays: string[]
  pages: BackupPage[]
}

export type BackupFile = {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  settings: { calendarType: CalendarType; showHebrewDates: boolean }
  programs: BackupProgram[]
}

export type BackupPreview = { total: number; newPrograms: number; existingPrograms: number }
export type MergeResult = { added: number; skipped: number }

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupFormatError'
  }
}

const PROGRAM_STATUSES: readonly unknown[] = [...SETTABLE_PROGRAM_STATUSES, 'completed']

function fail(message: string): never {
  throw new BackupFormatError(message)
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${what} must be an object`)
  }
  return value as Record<string, unknown>
}

function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(`${what} must be an array`)
  }
  return value
}

function asString(value: unknown, what: string): string {
  if (typeof value !== 'string') {
    fail(`${what} must be a string`)
  }
  return value
}

function asInteger(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(`${what} must be an integer`)
  }
  return value
}

function asIsoDate(value: unknown, what: string): string {
  if (!isValidIsoDate(value)) {
    fail(`${what} must be a valid ISO date`)
  }
  return value
}

function asNullableString(value: unknown, what: string): string | null {
  return value === null ? null : asString(value, what)
}

function parsePage(raw: unknown, start: number, end: number): BackupPage {
  const page = asRecord(raw, 'page')
  const pageNumber = asInteger(page.pageNumber, 'pageNumber')
  if (pageNumber < start || pageNumber > end) {
    fail(`page ${pageNumber} is outside the program range ${start}-${end}`)
  }
  const rawUnits = asRecord(page.units, 'units')
  const units = {} as UnitFlags
  for (const key of UNIT_KEYS) {
    if (typeof rawUnits[key] !== 'boolean') {
      fail(`unit ${key} must be a boolean`)
    }
    units[key] = rawUnits[key]
  }
  return {
    pageNumber,
    scheduledDate: asIsoDate(page.scheduledDate, 'scheduledDate'),
    units,
    completedAt: asNullableString(page.completedAt, 'completedAt'),
  }
}

function parseProgram(raw: unknown): BackupProgram {
  const p = asRecord(raw, 'program')
  const uid = asString(p.uid, 'uid')
  if (uid === '') {
    fail('uid must not be empty')
  }
  const startPage = asInteger(p.startPage, 'startPage')
  const endPage = asInteger(p.endPage, 'endPage')
  if (startPage > endPage) {
    fail('startPage must not exceed endPage')
  }
  if (!(PACE_MODES as readonly unknown[]).includes(p.paceMode)) {
    fail(`unknown pace mode: ${String(p.paceMode)}`)
  }
  if (!PROGRAM_STATUSES.includes(p.status)) {
    fail(`unknown status: ${String(p.status)}`)
  }
  if (typeof p.pagesPerDay !== 'number' || !Number.isFinite(p.pagesPerDay)) {
    fail('pagesPerDay must be a number')
  }

  const seenPages = new Set<number>()
  const pages = asArray(p.pages, 'pages').map((rawPage) => {
    const page = parsePage(rawPage, startPage, endPage)
    if (seenPages.has(page.pageNumber)) {
      fail(`duplicate page ${page.pageNumber}`)
    }
    seenPages.add(page.pageNumber)
    return page
  })

  return {
    uid,
    tractateId: asInteger(p.tractateId, 'tractateId'),
    tractateNameEn: asString(p.tractateNameEn, 'tractateNameEn'),
    programName: asString(p.programName, 'programName'),
    startPage,
    endPage,
    startDate: asIsoDate(p.startDate, 'startDate'),
    paceMode: p.paceMode as PaceMode,
    pagesPerDay: p.pagesPerDay,
    targetEndDate: asIsoDate(p.targetEndDate, 'targetEndDate'),
    status: p.status as ProgramStatus,
    pausedAt: asNullableString(p.pausedAt, 'pausedAt'),
    completedAt: asNullableString(p.completedAt, 'completedAt'),
    createdAt: asNullableString(p.createdAt, 'createdAt'),
    restWeekdays: asArray(p.restWeekdays, 'restWeekdays').map((day) => {
      const weekday = asInteger(day, 'rest weekday')
      if (weekday < 0 || weekday > 6) {
        fail(`invalid rest weekday: ${weekday}`)
      }
      return weekday
    }),
    restDates: asArray(p.restDates, 'restDates').map((date) => asIsoDate(date, 'rest date')),
    restHolidays: asArray(p.restHolidays, 'restHolidays').map((id) => asString(id, 'rest holiday')),
    pages,
  }
}

/** Validates an untrusted value (parsed file or renderer payload) and returns a clean BackupFile. */
export function parseBackup(input: unknown): BackupFile {
  const root = asRecord(input, 'backup')
  if (root.format !== BACKUP_FORMAT) {
    fail('not a Talmudon backup file')
  }
  if (typeof root.version !== 'number' || !Number.isInteger(root.version) || root.version < 1) {
    fail('missing backup version')
  }
  if (root.version > BACKUP_VERSION) {
    fail(`unsupported backup version ${root.version}`)
  }
  const exportedAt = asString(root.exportedAt, 'exportedAt')
  if (Number.isNaN(Date.parse(exportedAt))) {
    fail('exportedAt must be a timestamp')
  }
  const settings = asRecord(root.settings, 'settings')
  if (!(CALENDAR_TYPES as readonly unknown[]).includes(settings.calendarType)) {
    fail('invalid calendarType')
  }
  if (typeof settings.showHebrewDates !== 'boolean') {
    fail('showHebrewDates must be a boolean')
  }

  const uids = new Set<string>()
  const programs = asArray(root.programs, 'programs').map((raw) => {
    const program = parseProgram(raw)
    if (uids.has(program.uid)) {
      fail(`duplicate program uid ${program.uid}`)
    }
    uids.add(program.uid)
    return program
  })

  return {
    format: BACKUP_FORMAT,
    version: root.version,
    exportedAt,
    settings: { calendarType: settings.calendarType as CalendarType, showHebrewDates: settings.showHebrewDates },
    programs,
  }
}

export function parseBackupText(text: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    fail('file is not valid JSON')
  }
  return parseBackup(parsed)
}
