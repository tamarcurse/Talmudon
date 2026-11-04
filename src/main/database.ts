import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

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
    show_hebrew_dates BOOLEAN NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO user_settings (id, show_hebrew_dates) VALUES (1, 0);
`

const TRACTATES_SEED: Array<Omit<TractateRecord, 'id'>> = [
  { name_he: 'ברכות', name_en: 'Berakhot', total_pages: 64 },
  { name_he: 'שבת', name_en: 'Shabbat', total_pages: 156 },
  { name_he: 'עירובין', name_en: 'Eruvin', total_pages: 104 },
  { name_he: 'פסחים', name_en: 'Pesachim', total_pages: 120 },
  { name_he: 'שקלים', name_en: 'Shekalim', total_pages: 22 },
  { name_he: 'יומא', name_en: 'Yoma', total_pages: 88 },
  { name_he: 'סוכה', name_en: 'Sukkah', total_pages: 56 },
  { name_he: 'ביצה', name_en: 'Beitzah', total_pages: 40 },
  { name_he: 'ראש השנה', name_en: 'Rosh Hashanah', total_pages: 35 },
  { name_he: 'תענית', name_en: 'Taanit', total_pages: 28 },
  { name_he: 'מגילה', name_en: 'Megillah', total_pages: 32 },
  { name_he: 'מועד קטן', name_en: 'Moed Katan', total_pages: 29 },
  { name_he: 'חגיגה', name_en: 'Chagigah', total_pages: 27 },
  { name_he: 'יבמות', name_en: 'Yevamot', total_pages: 122 },
  { name_he: 'כתובות', name_en: 'Ketubot', total_pages: 112 },
  { name_he: 'נדרים', name_en: 'Nedarim', total_pages: 90 },
  { name_he: 'נזיר', name_en: 'Nazir', total_pages: 66 },
  { name_he: 'סוטה', name_en: 'Sotah', total_pages: 49 },
  { name_he: 'גיטין', name_en: 'Gittin', total_pages: 90 },
  { name_he: 'קידושין', name_en: 'Kiddushin', total_pages: 82 },
  { name_he: 'בבא קמא', name_en: 'Bava Kamma', total_pages: 119 },
  { name_he: 'בבא מציעא', name_en: 'Bava Metzia', total_pages: 119 },
  { name_he: 'בבא בתרא', name_en: 'Bava Batra', total_pages: 176 },
  { name_he: 'סנהדרין', name_en: 'Sanhedrin', total_pages: 113 },
  { name_he: 'מכות', name_en: 'Makkot', total_pages: 24 },
  { name_he: 'שבועות', name_en: 'Shevuot', total_pages: 49 },
  { name_he: 'עבודה זרה', name_en: 'Avodah Zarah', total_pages: 76 },
  { name_he: 'הוריות', name_en: 'Horayot', total_pages: 14 },
  { name_he: 'זבחים', name_en: 'Zevachim', total_pages: 120 },
  { name_he: 'מנחות', name_en: 'Menachot', total_pages: 110 },
  { name_he: 'חולין', name_en: 'Chullin', total_pages: 142 },
  { name_he: 'בכורות', name_en: 'Bechorot', total_pages: 61 },
  { name_he: 'ערכין', name_en: 'Arachin', total_pages: 34 },
  { name_he: 'תמורה', name_en: 'Temurah', total_pages: 34 },
  { name_he: 'כריתות', name_en: 'Keritot', total_pages: 28 },
  { name_he: 'מעילה', name_en: 'Meilah', total_pages: 22 },
  { name_he: 'נדה', name_en: 'Niddah', total_pages: 73 },
]

function buildShasPagesSeed(): ShasPageRecord[] {
  const labels = ['א', 'ב', 'ג', 'ד', 'ה', 'ש', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת']

  return Array.from({ length: 200 }, (_, index) => {
    const pageNumber = index + 1
    const labelIndex = (pageNumber - 1) % labels.length
    return {
      page_number: pageNumber,
      page_label_he: `${labels[labelIndex]}'`,
    }
  })
}

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
    this.seedTractates()
    this.seedShasPages()
    return this
  }

  close(): void {
    this.db?.close()
    this.db = null
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

  getRowCount(tableName: string): number {
    const db = this.ensureDatabase()
    const result = db.prepare(`SELECT COUNT(*) AS total FROM ${tableName}`).get() as { total: number }
    return result.total
  }

  getUserSetting<T = boolean>(settingName: string): T | null {
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
}

export function initializeDatabase(databasePath = path.join(process.cwd(), 'data', 'talmudon.sqlite')): DatabaseService {
  return new DatabaseService(databasePath).initialize()
}

export const defaultDatabaseService = new DatabaseService(
  path.join(process.cwd(), 'data', 'talmudon.sqlite'),
)
