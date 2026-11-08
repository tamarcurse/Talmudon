import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { computeEndDate, computePagesPerDay, planSchedule } from './schedule.js'
import { TRACTATES_SEED, buildShasPagesSeed } from './seed-data.js'

export type TractateRecord = {
  id: number
  name_he: string
  name_en: string
  total_pages: number
}

export type ShasPageRecord = {
  page_number: number
  page_label_he: string
}

export type StudyProgramRecord = {
  id: number
  tractate_id: number
  program_name: string
  start_page_num: number
  end_page_num: number
  target_end_date: string
  pages_per_day: number
  status: string
  created_at: string | null
}

export const PACE_MODES = ['target_date', 'daily_pace'] as const
export type PaceMode = (typeof PACE_MODES)[number]

export type ProgramInput = {
  tractateId: number
  programName: string
  startPage: number
  endPage: number
  startDate: string
  paceMode: PaceMode
  pagesPerDay: number
  targetEndDate: string
  restWeekdays: number[]
  restDates: string[]
}

export type ProgramRecord = ProgramInput & { id: number }

export type PageProgressRecord = {
  id: number
  pageNumber: number
  scheduledDate: string
  isPageCompleted: boolean
}

type SqliteDatabase = InstanceType<typeof Database>

const ALLOWED_TABLE_NAMES = new Set([
  'tractates',
  'shas_pages',
  'study_programs',
  'program_rest_days',
  'page_progress',
  'user_settings',
])

const ALLOWED_USER_SETTING_NAMES = new Set(['show_hebrew_dates', 'calendar_type'])

export const CALENDAR_TYPES = ['gregorian', 'hebrew'] as const
export type CalendarType = (typeof CALENDAR_TYPES)[number]

const USER_SETTING_VALIDATORS: Record<string, (value: unknown) => boolean> = {
  show_hebrew_dates: (value) => typeof value === 'boolean',
  calendar_type: (value) => (CALENDAR_TYPES as readonly unknown[]).includes(value),
}

const USER_SETTINGS_MIGRATIONS: Array<{ column: string; definition: string }> = [
  { column: 'calendar_type', definition: "calendar_type TEXT NOT NULL DEFAULT 'gregorian'" },
]

const STUDY_PROGRAMS_MIGRATIONS: Array<{ column: string; definition: string }> = [
  { column: 'start_date', definition: 'start_date TEXT' },
  { column: 'pace_mode', definition: "pace_mode TEXT NOT NULL DEFAULT 'daily_pace'" },
]

// A page (daf) is complete when all four parts are done; side/page completion is derived, not stored.
const PAGE_COMPLETE_SQL =
  '(side_a_rashi AND side_a_tosafot AND side_b_rashi AND side_b_tosafot)'

const MIN_PAGE_NUMBER = 2
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function pageRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) {
    return false
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toISOString().slice(0, 10) === value
}

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS shas_pages (
    page_number INTEGER PRIMARY KEY,
    page_label_he TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tractates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_he TEXT NOT NULL,
    name_en TEXT NOT NULL,
    total_pages INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS study_programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tractate_id INTEGER NOT NULL,
    program_name TEXT NOT NULL,
    start_page_num INTEGER NOT NULL,
    end_page_num INTEGER NOT NULL,
    target_end_date DATE NOT NULL,
    pages_per_day REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tractate_id) REFERENCES tractates(id),
    FOREIGN KEY (start_page_num) REFERENCES shas_pages(page_number),
    FOREIGN KEY (end_page_num) REFERENCES shas_pages(page_number)
);

CREATE TABLE IF NOT EXISTS program_rest_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    rest_type TEXT NOT NULL,
    day_of_week INTEGER,
    specific_date DATE,
    FOREIGN KEY (program_id) REFERENCES study_programs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS page_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    page_number INTEGER NOT NULL,
    scheduled_date TEXT NOT NULL,
    side_a_rashi BOOLEAN DEFAULT 0,
    side_a_tosafot BOOLEAN DEFAULT 0,
    side_b_rashi BOOLEAN DEFAULT 0,
    side_b_tosafot BOOLEAN DEFAULT 0,
    completed_at DATETIME,
    FOREIGN KEY (program_id) REFERENCES study_programs(id) ON DELETE CASCADE,
    FOREIGN KEY (page_number) REFERENCES shas_pages(page_number)
);

CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    show_hebrew_dates BOOLEAN NOT NULL DEFAULT 0,
    calendar_type TEXT NOT NULL DEFAULT 'gregorian'
);

INSERT OR IGNORE INTO user_settings (id, show_hebrew_dates) VALUES (1, 0);
`

export class DatabaseService {
  private db: SqliteDatabase | null = null
  private readonly dbPath: string

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  private ensureDatabase(): SqliteDatabase {
    if (!this.db) {
      const directory = path.dirname(this.dbPath)
      if (!existsSync(directory)) {
        mkdirSync(directory, { recursive: true })
      }
      this.db = new Database(this.dbPath)
      this.db.pragma('foreign_keys = ON')
    }

    return this.db
  }

  initialize(): DatabaseService {
    const db = this.ensureDatabase()
    db.exec(SCHEMA_SQL)
    this.migrateUserSettings()
    this.migrateStudyPrograms()
    this.migratePageProgress()
    this.seedTractates()
    this.seedShasPages()
    return this
  }

  close(): void {
    this.db?.close()
    this.db = null
  }

  private applyColumnMigrations(
    table: 'user_settings' | 'study_programs',
    migrations: Array<{ column: string; definition: string }>,
  ): void {
    const db = this.ensureDatabase()
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    const existing = new Set(columns.map((column) => column.name))

    for (const migration of migrations) {
      if (!existing.has(migration.column)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${migration.definition}`)
      }
    }
  }

  // Drops the redundant is_page_completed column from older databases, keeping completed pages completed.
  private migratePageProgress(): void {
    const db = this.ensureDatabase()
    const columns = db.prepare('PRAGMA table_info(page_progress)').all() as Array<{ name: string }>
    if (!columns.some((column) => column.name === 'is_page_completed')) {
      return
    }
    db.transaction(() => {
      db.exec(
        `UPDATE page_progress
            SET side_a_rashi = 1, side_a_tosafot = 1, side_b_rashi = 1, side_b_tosafot = 1
          WHERE is_page_completed = 1`,
      )
      db.exec('ALTER TABLE page_progress DROP COLUMN is_page_completed')
    })()
  }

  private migrateUserSettings(): void {
    this.applyColumnMigrations('user_settings', USER_SETTINGS_MIGRATIONS)
  }

  private migrateStudyPrograms(): void {
    this.applyColumnMigrations('study_programs', STUDY_PROGRAMS_MIGRATIONS)
  }

  private seedTractates(): void {
    const db = this.ensureDatabase()
    const existing = db.prepare('SELECT COUNT(*) AS total FROM tractates').get() as { total: number }

    if (existing.total > 0) {
      return
    }

    const insert = db.prepare(
      `INSERT INTO tractates (name_he, name_en, total_pages) VALUES (@name_he, @name_en, @total_pages)`,
    )

    const transaction = db.transaction(() => {
      for (const tractate of TRACTATES_SEED) {
        insert.run(tractate)
      }
    })

    transaction()
  }

  private seedShasPages(): void {
    const db = this.ensureDatabase()

    // Upsert rather than skip when rows exist: databases seeded by an older version carry
    // wrong labels (single letters cycling), and seeding must repair them.
    const upsert = db.prepare(
      `INSERT INTO shas_pages (page_number, page_label_he) VALUES (@page_number, @page_label_he)
       ON CONFLICT(page_number) DO UPDATE SET page_label_he = excluded.page_label_he
       WHERE page_label_he <> excluded.page_label_he`,
    )

    const transaction = db.transaction(() => {
      for (const page of buildShasPagesSeed()) {
        upsert.run(page)
      }
    })

    transaction()
  }

  getTractates(): TractateRecord[] {
    const db = this.ensureDatabase()
    return db
      .prepare(`SELECT id, name_he, name_en, total_pages FROM tractates ORDER BY id ASC`)
      .all() as TractateRecord[]
  }

  getShasPages(): ShasPageRecord[] {
    const db = this.ensureDatabase()
    return db
      .prepare('SELECT page_number, page_label_he FROM shas_pages ORDER BY page_number ASC')
      .all() as ShasPageRecord[]
  }

  private validateProgramInput(input: ProgramInput): void {
    const db = this.ensureDatabase()

    if (typeof input.programName !== 'string' || input.programName.trim() === '') {
      throw new Error('Program name is required')
    }

    const tractate = db
      .prepare('SELECT total_pages FROM tractates WHERE id = ?')
      .get(input.tractateId) as { total_pages: number } | undefined
    if (!tractate) {
      throw new Error(`Unknown tractate: ${String(input.tractateId)}`)
    }

    if (!Number.isInteger(input.startPage) || !Number.isInteger(input.endPage)) {
      throw new Error('Start and end pages must be integers')
    }
    if (input.startPage < MIN_PAGE_NUMBER || input.startPage > input.endPage || input.endPage > tractate.total_pages) {
      throw new Error(
        `Invalid page range ${input.startPage}-${input.endPage}; must satisfy ${MIN_PAGE_NUMBER} <= start <= end <= ${tractate.total_pages}`,
      )
    }

    if (!(PACE_MODES as readonly unknown[]).includes(input.paceMode)) {
      throw new Error(`Invalid pace mode: ${String(input.paceMode)}`)
    }
    if (typeof input.pagesPerDay !== 'number' || !Number.isFinite(input.pagesPerDay) || input.pagesPerDay <= 0) {
      throw new Error('Pages per day must be a positive number')
    }

    if (!isValidIsoDate(input.startDate)) {
      throw new Error(`Invalid start date: ${String(input.startDate)}`)
    }
    if (!isValidIsoDate(input.targetEndDate)) {
      throw new Error(`Invalid target end date: ${String(input.targetEndDate)}`)
    }

    for (const weekday of input.restWeekdays) {
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        throw new Error(`Invalid rest weekday: ${String(weekday)}`)
      }
    }
    for (const date of input.restDates) {
      if (!isValidIsoDate(date)) {
        throw new Error(`Invalid rest date: ${String(date)}`)
      }
    }
  }

  private replaceRestDays(programId: number, input: ProgramInput): void {
    const db = this.ensureDatabase()
    db.prepare('DELETE FROM program_rest_days WHERE program_id = ?').run(programId)

    const insertWeekday = db.prepare(
      "INSERT INTO program_rest_days (program_id, rest_type, day_of_week) VALUES (?, 'weekday', ?)",
    )
    const insertDate = db.prepare(
      "INSERT INTO program_rest_days (program_id, rest_type, specific_date) VALUES (?, 'date', ?)",
    )
    for (const weekday of new Set(input.restWeekdays)) {
      insertWeekday.run(programId, weekday)
    }
    for (const date of new Set(input.restDates)) {
      insertDate.run(programId, date)
    }
  }

  createProgram(input: ProgramInput): number {
    this.validateProgramInput(input)
    const db = this.ensureDatabase()

    const save = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO study_programs
             (tractate_id, program_name, start_page_num, end_page_num, target_end_date,
              pages_per_day, start_date, pace_mode)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.tractateId,
          input.programName.trim(),
          input.startPage,
          input.endPage,
          input.targetEndDate,
          input.pagesPerDay,
          input.startDate,
          input.paceMode,
        )
      const programId = Number(result.lastInsertRowid)
      this.replaceRestDays(programId, input)
      this.insertInitialPageProgress(programId, input)
      return programId
    })

    return save()
  }

  updateProgram(id: number, input: ProgramInput, today: string = localToday()): void {
    this.validateProgramInput(input)
    const db = this.ensureDatabase()

    const save = db.transaction(() => {
      const result = db
        .prepare(
          `UPDATE study_programs
              SET tractate_id = ?, program_name = ?, start_page_num = ?, end_page_num = ?,
                  target_end_date = ?, pages_per_day = ?, start_date = ?, pace_mode = ?
            WHERE id = ?`,
        )
        .run(
          input.tractateId,
          input.programName.trim(),
          input.startPage,
          input.endPage,
          input.targetEndDate,
          input.pagesPerDay,
          input.startDate,
          input.paceMode,
          id,
        )
      if (result.changes === 0) {
        throw new Error(`Unknown program: ${id}`)
      }
      this.replaceRestDays(id, input)
      this.recalculateInTransaction(id, today)
    })

    save()
  }

  recalculateProgram(id: number, today: string = localToday()): void {
    const db = this.ensureDatabase()
    db.transaction(() => this.recalculateInTransaction(id, today))()
  }

  private insertInitialPageProgress(programId: number, input: ProgramInput): void {
    const db = this.ensureDatabase()
    const plan = planSchedule({
      pages: pageRange(input.startPage, input.endPage),
      startDate: input.startDate,
      pagesPerDay: input.pagesPerDay,
      rest: { weekdays: input.restWeekdays, dates: input.restDates },
    })
    const insert = db.prepare(
      'INSERT INTO page_progress (program_id, page_number, scheduled_date) VALUES (?, ?, ?)',
    )
    for (const { page, date } of plan) {
      insert.run(programId, page, date)
    }
  }

  private recalculateInTransaction(id: number, today: string): void {
    const db = this.ensureDatabase()
    const program = this.getProgram(id)
    if (!program) {
      throw new Error(`Unknown program: ${id}`)
    }
    if (!isValidIsoDate(today)) {
      throw new Error(`Invalid date: ${String(today)}`)
    }

    const rows = db
      .prepare(
        `SELECT id, page_number, ${PAGE_COMPLETE_SQL} AS is_page_completed
           FROM page_progress WHERE program_id = ?`,
      )
      .all(id) as Array<{ id: number; page_number: number; is_page_completed: number }>
    const completed = new Set(rows.filter((r) => r.is_page_completed).map((r) => r.page_number))
    const pendingIds = new Map(rows.filter((r) => !r.is_page_completed).map((r) => [r.page_number, r.id]))

    const remaining = pageRange(program.startPage, program.endPage).filter((page) => !completed.has(page))

    // Pending rows that fell out of the range are dropped; completed rows are never touched.
    const inRange = new Set(remaining)
    const deleteRow = db.prepare('DELETE FROM page_progress WHERE id = ?')
    for (const [page, rowId] of pendingIds) {
      if (!inRange.has(page)) {
        deleteRow.run(rowId)
      }
    }
    if (remaining.length === 0) {
      return
    }

    const startDate = today > program.startDate ? today : program.startDate
    const rest = { weekdays: program.restWeekdays, dates: program.restDates }
    let pagesPerDay = program.pagesPerDay
    let targetEndDate = program.targetEndDate
    if (program.paceMode === 'target_date') {
      pagesPerDay = computePagesPerDay({
        startDate,
        targetEndDate: program.targetEndDate,
        totalDafim: remaining.length,
        rest,
      })
    } else {
      targetEndDate = computeEndDate({ startDate, totalDafim: remaining.length, pagesPerDay, rest })
    }

    const plan = planSchedule({ pages: remaining, startDate, pagesPerDay, rest })
    const update = db.prepare('UPDATE page_progress SET scheduled_date = ? WHERE id = ?')
    const insert = db.prepare(
      'INSERT INTO page_progress (program_id, page_number, scheduled_date) VALUES (?, ?, ?)',
    )
    for (const { page, date } of plan) {
      const rowId = pendingIds.get(page)
      if (rowId === undefined) {
        insert.run(id, page, date)
      } else {
        update.run(date, rowId)
      }
    }

    db.prepare('UPDATE study_programs SET pages_per_day = ?, target_end_date = ? WHERE id = ?').run(
      pagesPerDay,
      targetEndDate,
      id,
    )
  }

  getPageProgress(programId: number): PageProgressRecord[] {
    const db = this.ensureDatabase()
    const rows = db
      .prepare(
        `SELECT id, page_number, scheduled_date, ${PAGE_COMPLETE_SQL} AS is_page_completed
           FROM page_progress
          WHERE program_id = ? ORDER BY page_number ASC`,
      )
      .all(programId) as Array<{
      id: number
      page_number: number
      scheduled_date: string
      is_page_completed: number
    }>
    return rows.map((row) => ({
      id: row.id,
      pageNumber: row.page_number,
      scheduledDate: row.scheduled_date,
      isPageCompleted: Boolean(row.is_page_completed),
    }))
  }

  setPageCompleted(programId: number, pageNumber: number, completed: boolean): void {
    const db = this.ensureDatabase()
    const result = db
      .prepare(
        `UPDATE page_progress
            SET side_a_rashi = ?1, side_a_tosafot = ?1, side_b_rashi = ?1, side_b_tosafot = ?1,
                completed_at = CASE WHEN ?1 THEN CURRENT_TIMESTAMP ELSE NULL END
          WHERE program_id = ?2 AND page_number = ?3`,
      )
      .run(completed ? 1 : 0, programId, pageNumber)
    if (result.changes === 0) {
      throw new Error(`Unknown page ${pageNumber} in program ${programId}`)
    }
  }

  getProgram(id: number): ProgramRecord | null {
    const db = this.ensureDatabase()
    const row = db
      .prepare(
        `SELECT id, tractate_id, program_name, start_page_num, end_page_num, target_end_date,
                pages_per_day, pace_mode,
                COALESCE(start_date, substr(created_at, 1, 10)) AS start_date
           FROM study_programs WHERE id = ?`,
      )
      .get(id) as
      | {
          id: number
          tractate_id: number
          program_name: string
          start_page_num: number
          end_page_num: number
          target_end_date: string
          pages_per_day: number
          pace_mode: PaceMode
          start_date: string
        }
      | undefined
    if (!row) {
      return null
    }

    const restRows = db
      .prepare(
        `SELECT rest_type, day_of_week, specific_date FROM program_rest_days
          WHERE program_id = ? ORDER BY id ASC`,
      )
      .all(id) as Array<{ rest_type: string; day_of_week: number | null; specific_date: string | null }>

    return {
      id: row.id,
      tractateId: row.tractate_id,
      programName: row.program_name,
      startPage: row.start_page_num,
      endPage: row.end_page_num,
      startDate: row.start_date,
      paceMode: row.pace_mode,
      pagesPerDay: row.pages_per_day,
      targetEndDate: row.target_end_date,
      restWeekdays: restRows
        .filter((rest) => rest.rest_type === 'weekday' && rest.day_of_week !== null)
        .map((rest) => rest.day_of_week as number),
      restDates: restRows
        .filter((rest) => rest.rest_type === 'date' && rest.specific_date !== null)
        .map((rest) => rest.specific_date as string),
    }
  }

  getPageCount(): number {
    const db = this.ensureDatabase()
    const result = db.prepare('SELECT COUNT(*) AS total FROM shas_pages').get() as { total: number }
    return result.total
  }

  getPageLabel(pageNumber: number): string | null {
    const db = this.ensureDatabase()
    const result = db
      .prepare('SELECT page_label_he FROM shas_pages WHERE page_number = ?')
      .get(pageNumber) as { page_label_he: string } | undefined
    return result?.page_label_he ?? null
  }

  getRowCount(tableName: string): number {
    if (!ALLOWED_TABLE_NAMES.has(tableName)) {
      throw new Error(`Unknown table name: ${tableName}`)
    }

    const db = this.ensureDatabase()
    const result = db.prepare(`SELECT COUNT(*) AS total FROM ${tableName}`).get() as { total: number }
    return result.total
  }

  getUserSetting<T = boolean>(settingName: string): T | null {
    if (!ALLOWED_USER_SETTING_NAMES.has(settingName)) {
      throw new Error(`Unknown setting name: ${settingName}`)
    }

    const db = this.ensureDatabase()
    const result = db
      .prepare(`SELECT ${settingName} AS value FROM user_settings WHERE id = 1`)
      .get() as { value: number | string | null } | undefined

    if (!result) {
      return null
    }

    const value = result.value

    if (settingName === 'show_hebrew_dates') {
      return Boolean(value) as T
    }

    if (typeof value === 'number') {
      return value as T
    }

    return value as T
  }

  setUserSetting(settingName: string, value: unknown): void {
    if (!ALLOWED_USER_SETTING_NAMES.has(settingName)) {
      throw new Error(`Unknown setting name: ${settingName}`)
    }

    if (!USER_SETTING_VALIDATORS[settingName](value)) {
      throw new Error(`Invalid value for setting ${settingName}: ${String(value)}`)
    }

    const storedValue = typeof value === 'boolean' ? Number(value) : value
    const db = this.ensureDatabase()
    db.prepare(`UPDATE user_settings SET ${settingName} = ? WHERE id = 1`).run(storedValue)
  }
}

export function initializeDatabase(databasePath = path.join(process.cwd(), 'data', 'talmudon.sqlite')): DatabaseService {
  return new DatabaseService(databasePath).initialize()
}

export const defaultDatabaseService = new DatabaseService(
  path.join(process.cwd(), 'data', 'talmudon.sqlite'),
)
