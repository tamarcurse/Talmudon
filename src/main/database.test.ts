import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { DatabaseService, type ProgramInput } from './database.js'

const testServices: DatabaseService[] = []
const testDirs: string[] = []

afterEach(() => {
  for (const service of testServices) {
    service.close()
  }
  testServices.length = 0

  for (const dir of testDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  testDirs.length = 0
})

function createTestPath(name: string) {
  const dir = mkdtempSync(join(tmpdir(), `talmudon-${name}-`))
  testDirs.push(dir)
  return join(dir, 'talmudon.sqlite')
}

describe('DatabaseService', () => {
  it('initializes the SQLite schema and seeds all tractates and page labels', () => {
    const dbPath = createTestPath('schema')
    const service = new DatabaseService(dbPath)
    testServices.push(service)

    service.initialize()

    const tractates = service.getTractates()
    expect(tractates).toHaveLength(37)
    expect(tractates[0]).toMatchObject({
      id: 1,
      name_he: 'ברכות',
      name_en: 'Berakhot',
      total_pages: 64,
    })
    expect(service.getPageCount()).toBe(200)
    expect(service.getUserSetting('show_hebrew_dates')).toBe(false)
    expect(service.getRowCount('study_programs')).toBe(0)
  })

  it('seeds Hebrew page labels using correct gematria for multi-digit pages', () => {
    const dbPath = createTestPath('page-labels')
    const service = new DatabaseService(dbPath)
    testServices.push(service)

    service.initialize()

    expect(service.getPageLabel(15)).toBe('ט"ו')
  })

  it('repairs stale page labels left by an older seed', () => {
    const dbPath = createTestPath('stale-labels')
    const first = new DatabaseService(dbPath)
    testServices.push(first)
    first.initialize()
    first.close()

    // Simulate the old seed, which cycled through single letters (page 21 -> ש').
    const raw = new Database(dbPath)
    raw.prepare("UPDATE shas_pages SET page_label_he = 'ש''' WHERE page_number = 21").run()
    raw.prepare("UPDATE shas_pages SET page_label_he = 'ל''' WHERE page_number = 100").run()
    raw.close()

    const service = new DatabaseService(dbPath)
    testServices.push(service)
    service.initialize()

    expect(service.getPageLabel(21)).toBe('כ"א')
    expect(service.getPageLabel(100)).toBe("ק'")
    expect(service.getPageCount()).toBe(200)
  })

  it('re-runs safely without duplicating seed data or breaking the schema', () => {
    const dbPath = createTestPath('migration-safe')
    const service = new DatabaseService(dbPath)
    testServices.push(service)

    service.initialize()
    service.initialize()

    expect(service.getTractates()).toHaveLength(37)
    expect(service.getPageCount()).toBe(200)
    expect(service.getRowCount('tractates')).toBe(37)
    expect(service.getRowCount('shas_pages')).toBe(200)
  })

  it('rejects table names that are not on the allow-list', () => {
    const dbPath = createTestPath('row-count-whitelist')
    const service = new DatabaseService(dbPath)
    testServices.push(service)

    service.initialize()

    expect(() => service.getRowCount('sqlite_master')).toThrow()
  })

  it('rejects setting names that are not on the allow-list', () => {
    const dbPath = createTestPath('user-setting-whitelist')
    const service = new DatabaseService(dbPath)
    testServices.push(service)

    service.initialize()

    expect(() => service.getUserSetting('(SELECT sql FROM sqlite_master)')).toThrow()
  })

  describe('calendar_type setting', () => {
    it('defaults to gregorian on a fresh database', () => {
      const service = new DatabaseService(createTestPath('calendar-default'))
      testServices.push(service)

      service.initialize()

      expect(service.getUserSetting('calendar_type')).toBe('gregorian')
    })

    it('persists a new value across a restart', () => {
      const dbPath = createTestPath('calendar-persist')
      const service = new DatabaseService(dbPath)
      testServices.push(service)

      service.initialize()
      service.setUserSetting('calendar_type', 'hebrew')
      expect(service.getUserSetting('calendar_type')).toBe('hebrew')
      service.close()

      const reopened = new DatabaseService(dbPath)
      testServices.push(reopened)
      reopened.initialize()

      expect(reopened.getUserSetting('calendar_type')).toBe('hebrew')
    })

    it('rejects invalid calendar values', () => {
      const service = new DatabaseService(createTestPath('calendar-invalid'))
      testServices.push(service)

      service.initialize()

      expect(() => service.setUserSetting('calendar_type', 'banana')).toThrow()
      expect(service.getUserSetting('calendar_type')).toBe('gregorian')
    })

    it('rejects setting names that are not on the allow-list', () => {
      const service = new DatabaseService(createTestPath('calendar-set-whitelist'))
      testServices.push(service)

      service.initialize()

      expect(() => service.setUserSetting('sqlite_master', 'x')).toThrow()
      expect(() => service.setUserSetting('(SELECT sql FROM sqlite_master)', 'x')).toThrow()
    })

    it('migrates a database created with the old user_settings schema', () => {
      const dbPath = createTestPath('calendar-migration')
      const legacy = new Database(dbPath)
      legacy.exec(`
        CREATE TABLE user_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          show_hebrew_dates BOOLEAN NOT NULL DEFAULT 0
        );
        INSERT INTO user_settings (id, show_hebrew_dates) VALUES (1, 1);
      `)
      legacy.close()

      const service = new DatabaseService(dbPath)
      testServices.push(service)
      service.initialize()
      service.initialize()

      expect(service.getUserSetting('calendar_type')).toBe('gregorian')
      expect(service.getUserSetting('show_hebrew_dates')).toBe(true)
      expect(service.getRowCount('user_settings')).toBe(1)
    })
  })
})

describe('programs API', () => {
  function makeService(name: string) {
    const service = new DatabaseService(createTestPath(name))
    testServices.push(service)
    return service.initialize()
  }

  const baseInput: ProgramInput = {
    tractateId: 1,
    programName: 'ברכות – סיום בשנה',
    startPage: 2,
    endPage: 64,
    startDate: '2026-11-08',
    paceMode: 'daily_pace',
    pagesPerDay: 1.5,
    targetEndDate: '2027-01-10',
    restWeekdays: [],
    restDates: [],
  }

  it('getShasPages returns all 200 pages with Hebrew labels', () => {
    const pages = makeService('programs-pages').getShasPages()
    expect(pages).toHaveLength(200)
    expect(pages.find((page) => page.page_number === 2)).toEqual({ page_number: 2, page_label_he: "ב'" })
  })

  it('round-trips every field through createProgram / getProgram', () => {
    const service = makeService('programs-roundtrip')
    const input: ProgramInput = { ...baseInput, paceMode: 'target_date', pagesPerDay: 2.25 }

    const id = service.createProgram(input)

    expect(service.getProgram(id)).toEqual({ id, ...input })
  })

  it('returns null for an unknown program', () => {
    expect(makeService('programs-missing').getProgram(999)).toBeNull()
  })

  it('saves and loads rest weekdays and rest dates exactly', () => {
    const service = makeService('programs-rest')
    const id = service.createProgram({
      ...baseInput,
      restWeekdays: [5, 6],
      restDates: ['2026-12-25', '2027-01-01'],
    })

    const loaded = service.getProgram(id)
    expect([...loaded!.restWeekdays].sort()).toEqual([5, 6])
    expect([...loaded!.restDates].sort()).toEqual(['2026-12-25', '2027-01-01'])
    expect(service.getRowCount('program_rest_days')).toBe(4)
  })

  it('updateProgram replaces fields and rest days without leaving old ones behind', () => {
    const service = makeService('programs-update')
    const id = service.createProgram({ ...baseInput, restWeekdays: [5, 6], restDates: ['2026-12-25'] })

    const updated: ProgramInput = {
      ...baseInput,
      programName: 'שם חדש',
      startPage: 3,
      endPage: 20,
      paceMode: 'target_date',
      pagesPerDay: 3,
      targetEndDate: '2026-12-01',
      restWeekdays: [0],
      restDates: [],
    }
    service.updateProgram(id, updated)

    expect(service.getProgram(id)).toEqual({ id, ...updated })
    expect(service.getRowCount('program_rest_days')).toBe(1)
    expect(service.getRowCount('study_programs')).toBe(1)
  })

  it('updateProgram throws for an unknown program', () => {
    expect(() => makeService('programs-update-missing').updateProgram(42, baseInput)).toThrow()
  })

  describe('validation', () => {
    const invalid: Array<[string, Partial<ProgramInput>]> = [
      ['end page beyond the tractate', { endPage: 65 }],
      ['start page after end page', { startPage: 20, endPage: 10 }],
      ['start page below 2', { startPage: 1 }],
      ['unknown tractate', { tractateId: 999 }],
      ['weekday above 6', { restWeekdays: [7] }],
      ['negative weekday', { restWeekdays: [-1] }],
      ['non-integer weekday', { restWeekdays: [1.5] }],
      ['malformed rest date', { restDates: ['2026-13-45'] }],
      ['malformed rest date text', { restDates: ["x'; DROP TABLE study_programs;--"] }],
      ['malformed start date', { startDate: '08/11/2026' }],
      ['malformed target date', { targetEndDate: 'tomorrow' }],
      ['unknown pace mode', { paceMode: 'banana' as ProgramInput['paceMode'] }],
      ['non-positive pace', { pagesPerDay: 0 }],
      ['empty program name', { programName: '   ' }],
    ]

    it.each(invalid)('createProgram rejects %s and saves nothing', (_label, override) => {
      const service = makeService('programs-validation')
      expect(() => service.createProgram({ ...baseInput, ...override })).toThrow()
      expect(service.getRowCount('study_programs')).toBe(0)
      expect(service.getRowCount('program_rest_days')).toBe(0)
    })

    it('updateProgram rejects bad input and leaves the stored program untouched', () => {
      const service = makeService('programs-update-validation')
      const id = service.createProgram({ ...baseInput, restWeekdays: [6] })

      expect(() => service.updateProgram(id, { ...baseInput, restWeekdays: [5, 9] })).toThrow()

      expect(service.getProgram(id)).toEqual({ id, ...baseInput, restWeekdays: [6] })
    })

    it('rejects an impossible calendar date such as 30 February', () => {
      const service = makeService('programs-feb30')
      expect(() => service.createProgram({ ...baseInput, restDates: ['2026-02-30'] })).toThrow()
      expect(service.getRowCount('study_programs')).toBe(0)
    })
  })

  it('migrates a legacy study_programs table without start_date / pace_mode', () => {
    const dbPath = createTestPath('programs-migration')
    const legacy = new Database(dbPath)
    legacy.exec(`
      CREATE TABLE shas_pages (page_number INTEGER PRIMARY KEY, page_label_he TEXT NOT NULL);
      CREATE TABLE tractates (id INTEGER PRIMARY KEY AUTOINCREMENT, name_he TEXT NOT NULL, name_en TEXT NOT NULL, total_pages INTEGER NOT NULL);
      CREATE TABLE study_programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tractate_id INTEGER NOT NULL,
        program_name TEXT NOT NULL,
        start_page_num INTEGER NOT NULL,
        end_page_num INTEGER NOT NULL,
        target_end_date DATE NOT NULL,
        pages_per_day REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
    legacy.close()

    const service = new DatabaseService(dbPath)
    testServices.push(service)
    service.initialize()
    service.initialize()

    const id = service.createProgram(baseInput)
    expect(service.getProgram(id)).toEqual({ id, ...baseInput })
  })
})
