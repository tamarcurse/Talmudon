import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
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
    this.seedTractates()
    this.seedShasPages()
    return this
  }

  close(): void {
    this.db?.close()
    this.db = null
  }

  private migrateUserSettings(): void {
    const db = this.ensureDatabase()
    const columns = db.prepare('PRAGMA table_info(user_settings)').all() as Array<{ name: string }>
    const existing = new Set(columns.map((column) => column.name))

    for (const migration of USER_SETTINGS_MIGRATIONS) {
      if (!existing.has(migration.column)) {
        db.exec(`ALTER TABLE user_settings ADD COLUMN ${migration.definition}`)
      }
    }
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
    const existing = db.prepare('SELECT COUNT(*) AS total FROM shas_pages').get() as { total: number }

    if (existing.total > 0) {
      return
    }

    const insert = db.prepare(
      `INSERT INTO shas_pages (page_number, page_label_he) VALUES (@page_number, @page_label_he)`,
    )

    const transaction = db.transaction(() => {
      for (const page of buildShasPagesSeed()) {
        insert.run(page)
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
