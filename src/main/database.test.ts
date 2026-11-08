import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { DatabaseService, type ProgramInput } from './database.js'
import { UNIT_KEYS } from './progress.js'

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

function completePage(service: DatabaseService, programId: number, pageNumber: number, today?: string) {
  service.setUnitsCompleted(
    programId,
    UNIT_KEYS.map((unit) => ({ pageNumber, unit })),
    true,
    today,
  )
}

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
    expect(tractates).toHaveLength(40)
    expect(tractates[0]).toMatchObject({
      id: 1,
      name_he: 'ברכות',
      name_en: 'Berakhot',
      total_pages: 64,
      first_page: 2,
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

    expect(service.getTractates()).toHaveLength(40)
    expect(service.getPageCount()).toBe(200)
    expect(service.getRowCount('tractates')).toBe(40)
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
    restHolidays: [],
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

    expect(service.getProgram(id)).toEqual({ id, status: 'active', completedAt: null, ...input })
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
      restHolidays: [],
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
      restHolidays: [],
    }
    service.updateProgram(id, updated, baseInput.startDate)

    // pagesPerDay is derived from the target date in target_date mode, so only check it is set.
    expect(service.getProgram(id)).toEqual({ id, status: 'active', completedAt: null, ...updated, pagesPerDay: expect.any(Number) })
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

      expect(service.getProgram(id)).toEqual({ id, status: 'active', completedAt: null, ...baseInput, restWeekdays: [6] })
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
    expect(service.getProgram(id)).toEqual({ id, status: 'active', completedAt: null, ...baseInput })
  })

  it('round-trips rest holidays and replaces them on update', () => {
    const service = makeService('programs-holidays')
    const id = service.createProgram({ ...baseInput, restHolidays: ['chanukah-1', 'pesach-chol-hamoed', 'chanukah-1'] })
    expect([...service.getProgram(id)!.restHolidays].sort()).toEqual(['chanukah-1', 'pesach-chol-hamoed'])

    service.updateProgram(id, { ...baseInput, restHolidays: ['purim'] }, baseInput.startDate)
    expect(service.getProgram(id)!.restHolidays).toEqual(['purim'])
  })

  it('rejects unknown holiday ids', () => {
    const service = makeService('programs-holidays-invalid')
    expect(() => service.createProgram({ ...baseInput, restHolidays: ['not-a-holiday'] })).toThrow(/holiday/)
  })

  it('schedules around selected holidays', () => {
    const service = makeService('programs-holidays-schedule')
    const chanukah = Array.from({ length: 8 }, (_, i) => `chanukah-${i + 1}`)
    const id = service.createProgram({
      ...baseInput,
      startDate: '2026-12-03',
      pagesPerDay: 1,
      targetEndDate: '2027-02-01',
      restHolidays: chanukah,
    })
    const dates = service.getPageProgress(id).map((page) => page.scheduledDate)
    expect(dates.slice(0, 3)).toEqual(['2026-12-03', '2026-12-04', '2026-12-13'])
  })

  it('adds holiday_id to an existing program_rest_days table', () => {
    const dbPath = createTestPath('rest-days-migration')
    const first = new DatabaseService(dbPath)
    first.initialize()
    first.close()
    const raw = new Database(dbPath)
    raw.exec('ALTER TABLE program_rest_days DROP COLUMN holiday_id')
    raw.close()

    const service = new DatabaseService(dbPath)
    testServices.push(service)
    service.initialize()
    const id = service.createProgram({ ...baseInput, restHolidays: ['yom-kippur'] })
    expect(service.getProgram(id)!.restHolidays).toEqual(['yom-kippur'])
  })
})

describe('page_progress schedule', () => {
  const baseInput: ProgramInput = {
    tractateId: 1,
    programName: 'ברכות',
    startPage: 2,
    endPage: 5,
    startDate: '2026-01-01', // Thursday
    paceMode: 'daily_pace',
    pagesPerDay: 1,
    targetEndDate: '2026-01-04',
    restWeekdays: [],
    restDates: [],
    restHolidays: [],
  }

  function setup() {
    const service = new DatabaseService(createTestPath('progress'))
    testServices.push(service)
    service.initialize()
    return service
  }

  const dates = (service: DatabaseService, id: number) =>
    service.getPageProgress(id).map((p) => p.scheduledDate)

  it('createProgram creates a not-completed ISO-dated record for every page', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    const progress = service.getPageProgress(id)
    expect(progress.map((p) => p.pageNumber)).toEqual([2, 3, 4, 5])
    expect(dates(service, id)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'])
    expect(progress.every((p) => !p.isPageCompleted)).toBe(true)
  })

  it('createProgram skips rest weekdays', () => {
    const service = setup()
    const id = service.createProgram({ ...baseInput, restWeekdays: [5, 6] })
    expect(dates(service, id)).toEqual(['2026-01-01', '2026-01-04', '2026-01-05', '2026-01-06'])
  })

  const page = (service: DatabaseService, id: number, pageNumber: number) =>
    service.getPageProgress(id).find((p) => p.pageNumber === pageNumber)!

  it('getPageProgress returns all four units as false for a new program', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    for (const p of service.getPageProgress(id)) {
      expect(p.units).toEqual({
        side_a_rashi: false,
        side_a_tosafot: false,
        side_b_rashi: false,
        side_b_tosafot: false,
      })
    }
  })

  it('setUnitsCompleted turns on one unit and leaves the other three off', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    service.setUnitsCompleted(id, [{ pageNumber: 3, unit: 'side_a_rashi' }], true)
    expect(page(service, id, 3).units).toEqual({
      side_a_rashi: true,
      side_a_tosafot: false,
      side_b_rashi: false,
      side_b_tosafot: false,
    })
    expect(page(service, id, 3).isPageCompleted).toBe(false)
    expect(Object.values(page(service, id, 2).units).some(Boolean)).toBe(false)
  })

  it('setUnitsCompleted with done=false turns a unit back off', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    service.setUnitsCompleted(id, [{ pageNumber: 3, unit: 'side_b_tosafot' }], true)
    service.setUnitsCompleted(id, [{ pageNumber: 3, unit: 'side_b_tosafot' }], false)
    expect(page(service, id, 3).units.side_b_tosafot).toBe(false)
  })

  it('setUnitsCompleted updates several pages in one call', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    service.setUnitsCompleted(
      id,
      [2, 3].flatMap((pageNumber) => UNIT_KEYS.map((unit) => ({ pageNumber, unit }))),
      true,
    )
    expect(page(service, id, 2).isPageCompleted).toBe(true)
    expect(page(service, id, 3).isPageCompleted).toBe(true)
    expect(page(service, id, 4).isPageCompleted).toBe(false)
  })

  it('setUnitsCompleted rolls back everything when one target is unknown', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    expect(() =>
      service.setUnitsCompleted(
        id,
        [
          { pageNumber: 2, unit: 'side_a_rashi' },
          { pageNumber: 999, unit: 'side_a_rashi' },
        ],
        true,
      ),
    ).toThrow()
    expect(page(service, id, 2).units.side_a_rashi).toBe(false)

    expect(() =>
      service.setUnitsCompleted(
        id,
        [
          { pageNumber: 2, unit: 'side_a_rashi' },
          { pageNumber: 3, unit: 'bogus; DROP TABLE page_progress' as never },
        ],
        true,
      ),
    ).toThrow()
    expect(page(service, id, 2).units.side_a_rashi).toBe(false)
  })

  it('completedAt is set only when all four units are on and cleared when one is turned off', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    service.setUnitsCompleted(id, [{ pageNumber: 2, unit: 'side_a_rashi' }], true)
    expect(page(service, id, 2).completedAt).toBeNull()

    completePage(service, id, 2)
    expect(page(service, id, 2).completedAt).not.toBeNull()

    service.setUnitsCompleted(id, [{ pageNumber: 2, unit: 'side_b_rashi' }], false)
    expect(page(service, id, 2).completedAt).toBeNull()
  })

  it('recalc treats a page with only some units done as pending', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    service.setUnitsCompleted(id, [{ pageNumber: 2, unit: 'side_a_rashi' }], true)
    service.recalculateProgram(id, '2026-01-05')
    expect(dates(service, id)).toEqual(['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'])
    expect(page(service, id, 2).units.side_a_rashi).toBe(true)
  })

  it('recalc keeps completed dates and moves the rest to today', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    completePage(service, id, 2)
    completePage(service, id, 3)
    service.recalculateProgram(id, '2026-01-05')
    expect(dates(service, id)).toEqual(['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06'])
  })

  it('recalc of a target-date program whose deadline passed catches up from today instead of failing', () => {
    const service = setup()
    const id = service.createProgram({ ...baseInput, paceMode: 'target_date', targetEndDate: '2026-01-04' })
    service.recalculateProgram(id, '2026-01-10')
    expect(dates(service, id)).toEqual(['2026-01-10', '2026-01-11', '2026-01-12', '2026-01-13'])
    expect(service.getProgram(id)?.targetEndDate).toBe('2026-01-04')
  })

  it('recalc moves an overdue page to today', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    service.recalculateProgram(id, '2026-01-03')
    expect(dates(service, id)).toEqual(['2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06'])
  })

  it('updateProgram with a new daily pace reschedules and updates the end date', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    service.updateProgram(id, { ...baseInput, pagesPerDay: 2 }, '2026-01-01')
    expect(dates(service, id)).toEqual(['2026-01-01', '2026-01-01', '2026-01-02', '2026-01-02'])
    expect(service.getProgram(id)?.targetEndDate).toBe('2026-01-02')
  })

  it('updateProgram with a new target date updates pages per day', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    service.updateProgram(
      id,
      { ...baseInput, paceMode: 'target_date', targetEndDate: '2026-01-02' },
      '2026-01-01',
    )
    expect(service.getProgram(id)?.pagesPerDay).toBe(2)
    expect(dates(service, id)).toEqual(['2026-01-01', '2026-01-01', '2026-01-02', '2026-01-02'])
  })

  it('updateProgram rejects a target date before today and rolls back', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    expect(() =>
      service.updateProgram(id, { ...baseInput, paceMode: 'target_date', targetEndDate: '2026-01-02' }, '2026-01-10'),
    ).toThrow()
    expect(service.getProgram(id)?.paceMode).toBe('daily_pace')
    expect(dates(service, id)[0]).toBe('2026-01-01')
  })

  it('updateProgram with new rest days skips them', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    service.updateProgram(id, { ...baseInput, restWeekdays: [4] }, '2026-01-01')
    expect(dates(service, id)).toEqual(['2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'])
  })

  it('expanding the range adds pages; shrinking drops only pending ones', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    service.updateProgram(id, { ...baseInput, endPage: 6 }, '2026-01-01')
    expect(service.getPageProgress(id).map((p) => p.pageNumber)).toEqual([2, 3, 4, 5, 6])

    completePage(service, id, 6)
    service.updateProgram(id, { ...baseInput, endPage: 4 }, '2026-01-01')
    expect(service.getPageProgress(id).map((p) => p.pageNumber)).toEqual([2, 3, 4, 6])
    expect(service.getPageProgress(id).find((p) => p.pageNumber === 6)?.isPageCompleted).toBe(true)
  })

  it('keeps record ids across recalc', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    const before = service.getPageProgress(id).map((p) => p.id)
    service.recalculateProgram(id, '2026-01-03')
    expect(service.getPageProgress(id).map((p) => p.id)).toEqual(before)
  })

  it('does not pull a not-yet-started program back to today', () => {
    const service = setup()
    const id = service.createProgram({ ...baseInput, startDate: '2026-03-02' })
    service.recalculateProgram(id, '2026-01-01')
    expect(dates(service, id)[0]).toBe('2026-03-02')
  })
})

describe('program summaries and pause/resume', () => {
  function setup() {
    const service = new DatabaseService(createTestPath('summaries'))
    testServices.push(service)
    return service.initialize()
  }

  const input: ProgramInput = {
    tractateId: 1,
    programName: 'תוכנית א',
    startPage: 2,
    endPage: 5,
    startDate: '2026-01-01',
    paceMode: 'daily_pace',
    pagesPerDay: 1,
    targetEndDate: '2026-01-04',
    restWeekdays: [],
    restDates: [],
    restHolidays: [],
  }

  it('opens an older database without paused_at and reports programs as active', () => {
    const dbPath = createTestPath('summaries-migration')
    const first = new DatabaseService(dbPath)
    first.initialize()
    first.createProgram(input)
    first.close()

    const raw = new Database(dbPath)
    raw.exec('ALTER TABLE study_programs DROP COLUMN paused_at')
    raw.close()

    const service = new DatabaseService(dbPath)
    testServices.push(service)
    service.initialize()
    expect(service.listProgramSummaries('2026-01-02')[0]).toMatchObject({ status: 'active' })
  })

  it('lists a summary with metrics for each program, ordered by id', () => {
    const service = setup()
    const a = service.createProgram(input)
    const b = service.createProgram({ ...input, programName: 'תוכנית ב' })
    completePage(service, a, 2)
    completePage(service, a, 3)

    const summaries = service.listProgramSummaries('2026-01-03')
    expect(summaries.map((s) => s.id)).toEqual([a, b])
    expect(summaries[0]).toMatchObject({
      programName: 'תוכנית א',
      status: 'active',
      percentComplete: 50,
      lag: 0,
      lead: 0,
      estimatedEndDate: '2026-01-04',
    })
    expect(summaries[1]).toMatchObject({ programName: 'תוכנית ב', percentComplete: 0, lag: 2 })
  })

  it('reports percent by units', () => {
    const service = setup()
    const id = service.createProgram(input)
    service.setUnitsCompleted(id, [{ pageNumber: 2, unit: 'side_a_rashi' }], true)
    expect(service.listProgramSummaries('2026-01-01')[0].percentComplete).toBe(6.25)

    completePage(service, id, 2)
    expect(service.listProgramSummaries('2026-01-01')[0].percentComplete).toBe(25)
  })

  it('pausing freezes lag as time moves forward', () => {
    const service = setup()
    const id = service.createProgram(input)
    service.setProgramStatus(id, 'paused', '2026-01-03')

    expect(service.listProgramSummaries('2026-01-03')[0]).toMatchObject({ status: 'paused', lag: 2 })
    expect(service.listProgramSummaries('2026-02-20')[0]).toMatchObject({ status: 'paused', lag: 2 })
  })

  it('resuming clears the pause and reschedules pending pages from the new today', () => {
    const service = setup()
    const id = service.createProgram(input)
    service.setProgramStatus(id, 'paused', '2026-01-03')
    service.setProgramStatus(id, 'active', '2026-02-01')

    expect(service.listProgramSummaries('2026-02-01')[0]).toMatchObject({ status: 'active', lag: 0 })
    expect(service.getPageProgress(id).map((p) => p.scheduledDate)).toEqual([
      '2026-02-01',
      '2026-02-02',
      '2026-02-03',
      '2026-02-04',
    ])
  })

  it('rejects an invalid status or unknown program', () => {
    const service = setup()
    const id = service.createProgram(input)
    expect(() => service.setProgramStatus(id, 'bogus', '2026-01-03')).toThrow(/status/i)
    expect(() => service.setProgramStatus(9999, 'paused', '2026-01-03')).toThrow(/unknown program/i)
  })
})

describe('getTodayPlan', () => {
  const baseInput: ProgramInput = {
    tractateId: 1,
    programName: 'ברכות',
    startPage: 2,
    endPage: 10,
    startDate: '2026-11-01',
    paceMode: 'daily_pace',
    pagesPerDay: 1,
    targetEndDate: '2026-11-09',
    restWeekdays: [],
    restDates: [],
    restHolidays: [],
  }

  function setup() {
    const service = new DatabaseService(createTestPath('today'))
    testServices.push(service)
    service.initialize()
    return service
  }

  it("returns today's scheduled page with the program and tractate names", () => {
    const service = setup()
    const id = service.createProgram(baseInput)

    const plan = service.getTodayPlan('2026-11-03')

    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({ programId: id, programName: 'ברכות', tractateName: 'ברכות' })
    expect(plan[0].todayPages.map((p) => p.pageNumber)).toEqual([4])
  })

  it('lists earlier unfinished pages as overdue, in order, without completed ones', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    completePage(service, id, 3)

    const [program] = service.getTodayPlan('2026-11-04')

    expect(program.overduePages.map((p) => p.pageNumber)).toEqual([2, 4])
    expect(program.todayPages.map((p) => p.pageNumber)).toEqual([5])
  })

  it("keeps a completed page of today in todayPages so it can be undone", () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    completePage(service, id, 4)

    const [program] = service.getTodayPlan('2026-11-03')

    expect(program.todayPages).toHaveLength(1)
    expect(program.todayPages[0]).toMatchObject({ pageNumber: 4, isPageCompleted: true })
  })

  it('omits paused programs', () => {
    const service = setup()
    const id = service.createProgram(baseInput)
    service.setProgramStatus(id, 'paused', '2026-11-03')

    expect(service.getTodayPlan('2026-11-03')).toEqual([])
  })

  it('includes a program with nothing to study today, with empty lists', () => {
    const service = setup()
    service.createProgram({ ...baseInput, startDate: '2026-12-01', targetEndDate: '2026-12-09' })

    const [program] = service.getTodayPlan('2026-11-03')

    expect(program.todayPages).toEqual([])
    expect(program.overduePages).toEqual([])
  })

  it('rejects an invalid date', () => {
    const service = setup()
    expect(() => service.getTodayPlan('2026-13-45')).toThrow(/date/i)
  })
})

describe('deleting programs', () => {
  const input: ProgramInput = {
    tractateId: 1,
    programName: 'תוכנית א',
    startPage: 2,
    endPage: 3,
    startDate: '2026-11-01',
    paceMode: 'daily_pace',
    pagesPerDay: 1,
    targetEndDate: '2026-11-02',
    restWeekdays: [6],
    restDates: [],
    restHolidays: [],
  }

  function setup() {
    const service = new DatabaseService(createTestPath('delete'))
    testServices.push(service)
    return service.initialize()
  }

  it('removes the program with its progress and rest days, leaving others untouched', () => {
    const service = setup()
    const a = service.createProgram(input)
    const b = service.createProgram({ ...input, programName: 'תוכנית ב' })
    const pagesOfB = service.getPageProgress(b).length

    service.deleteProgram(a)

    expect(service.getProgram(a)).toBeNull()
    expect(service.getProgram(b)).not.toBeNull()
    expect(service.getRowCount('study_programs')).toBe(1)
    expect(service.getRowCount('page_progress')).toBe(pagesOfB)
    expect(service.getRowCount('program_rest_days')).toBe(1)
  })

  it('rejects an unknown program', () => {
    expect(() => setup().deleteProgram(9999)).toThrow(/unknown program/i)
  })
})

describe('completing programs', () => {
  const input: ProgramInput = {
    tractateId: 1,
    programName: 'תוכנית א',
    startPage: 2,
    endPage: 3,
    startDate: '2026-11-01',
    paceMode: 'daily_pace',
    pagesPerDay: 1,
    targetEndDate: '2026-11-02',
    restWeekdays: [],
    restDates: [],
    restHolidays: [],
  }

  function setup() {
    const service = new DatabaseService(createTestPath('completing'))
    testServices.push(service)
    return service.initialize()
  }

  function finish(service: DatabaseService, id: number, today = '2026-11-05') {
    completePage(service, id, 2, today)
    completePage(service, id, 3, today)
  }

  it('moves to completed with the date when the last unit is marked', () => {
    const service = setup()
    const id = service.createProgram(input)
    finish(service, id)

    expect(service.listProgramSummaries('2026-11-06')[0]).toMatchObject({
      status: 'completed',
      completedAt: '2026-11-05',
    })
    expect(service.getProgram(id)).toMatchObject({ status: 'completed', completedAt: '2026-11-05' })
  })

  it('stays active while partly done', () => {
    const service = setup()
    const id = service.createProgram(input)
    completePage(service, id, 2, '2026-11-05')

    expect(service.listProgramSummaries('2026-11-06')[0]).toMatchObject({ status: 'active', completedAt: null })
  })

  it('completes a paused program and clears its pause', () => {
    const service = setup()
    const id = service.createProgram(input)
    service.setProgramStatus(id, 'paused', '2026-11-03')
    finish(service, id)

    expect(service.listProgramSummaries('2026-11-06')[0]).toMatchObject({ status: 'completed' })
    const raw = (service as unknown as { db: Database.Database }).db
    expect(raw.prepare('SELECT paused_at FROM study_programs WHERE id = ?').get(id)).toEqual({ paused_at: null })
  })

  it('locks a completed program against every change', () => {
    const service = setup()
    const id = service.createProgram(input)
    finish(service, id)
    const before = service.getPageProgress(id)

    expect(() => service.setUnitsCompleted(id, [{ pageNumber: 2, unit: 'side_a_rashi' }], false)).toThrow(/completed/i)
    expect(() => service.updateProgram(id, { ...input, programName: 'אחר' })).toThrow(/completed/i)
    expect(() => service.recalculateProgram(id)).toThrow(/completed/i)
    expect(() => service.setProgramStatus(id, 'paused')).toThrow(/completed/i)
    expect(service.getPageProgress(id)).toEqual(before)
    expect(service.getProgram(id)?.programName).toBe('תוכנית א')
  })

  it('cannot be set by hand', () => {
    const service = setup()
    const id = service.createProgram(input)
    expect(() => service.setProgramStatus(id, 'completed')).toThrow(/invalid program status/i)
  })

  it('is omitted from the today plan', () => {
    const service = setup()
    const id = service.createProgram(input)
    finish(service, id)
    expect(service.getTodayPlan('2026-11-05')).toEqual([])
  })

  it('migrates an old database whose programs are already fully done', () => {
    const dbPath = createTestPath('completed-migration')
    const first = new DatabaseService(dbPath)
    first.initialize()
    const id = first.createProgram(input)
    completePage(first, id, 2, '2026-11-02')
    completePage(first, id, 3, '2026-11-03')
    first.close()

    const raw = new Database(dbPath)
    raw.exec("ALTER TABLE study_programs DROP COLUMN completed_at; UPDATE study_programs SET status = 'active'")
    raw.exec("UPDATE page_progress SET completed_at = '2026-11-02 10:00:00' WHERE page_number = 2")
    raw.exec("UPDATE page_progress SET completed_at = '2026-11-03 12:00:00' WHERE page_number = 3")
    raw.close()

    const service = new DatabaseService(dbPath)
    testServices.push(service)
    service.initialize()
    expect(service.listProgramSummaries('2026-11-10')[0]).toMatchObject({ status: 'completed' })
    expect(service.listProgramSummaries('2026-11-10')[0].completedAt).toBe('2026-11-03')
  })
})

describe('getStudyStats', () => {
  const input: ProgramInput = {
    tractateId: 1,
    programName: 'סטטיסטיקה',
    startPage: 2,
    endPage: 6,
    startDate: '2026-11-01',
    paceMode: 'daily_pace',
    pagesPerDay: 1,
    targetEndDate: '2026-11-05',
    restWeekdays: [],
    restDates: [],
    restHolidays: [],
  }

  it('computes the streak and the 7/30-day counts from completed_at', () => {
    const dbPath = createTestPath('study-stats')
    const service = new DatabaseService(dbPath)
    testServices.push(service)
    service.initialize()
    const id = service.createProgram(input)
    for (const page of [2, 3, 4]) completePage(service, id, page, '2026-11-01')
    // A partial page must not count.
    service.setUnitsCompleted(id, [{ pageNumber: 5, unit: 'side_a_rashi' }], true, '2026-11-01')

    const raw = new Database(dbPath)
    raw.exec("UPDATE page_progress SET completed_at = '2026-11-08 12:00:00' WHERE page_number = 2")
    raw.exec("UPDATE page_progress SET completed_at = '2026-11-07 12:00:00' WHERE page_number = 3")
    raw.exec("UPDATE page_progress SET completed_at = '2026-10-01 12:00:00' WHERE page_number = 4")
    raw.close()

    expect(service.getStudyStats('2026-11-08')).toEqual({
      currentStreak: 2,
      pagesLast7Days: 2,
      pagesLast30Days: 2,
    })
  })

  it('is all zeros with no programs', () => {
    const service = new DatabaseService(createTestPath('study-stats-empty'))
    testServices.push(service)
    service.initialize()
    expect(service.getStudyStats('2026-11-08')).toEqual({ currentStreak: 0, pagesLast7Days: 0, pagesLast30Days: 0 })
  })
})

describe('tractate data', () => {
  function makeService(name: string) {
    const service = new DatabaseService(createTestPath(name))
    testServices.push(service)
    return service.initialize()
  }

  const byName = (service: DatabaseService, nameEn: string) =>
    service.getTractates().find((tractate) => tractate.name_en === nameEn)

  it('seeds the page counts used by the daf yomi cycle', () => {
    const service = makeService('tractate-data')
    expect(byName(service, 'Shabbat')?.total_pages).toBe(157)
    expect(byName(service, 'Eruvin')?.total_pages).toBe(105)
    expect(byName(service, 'Pesachim')?.total_pages).toBe(121)
    expect(byName(service, 'Taanit')?.total_pages).toBe(31)
    expect(byName(service, 'Nedarim')?.total_pages).toBe(91)
  })

  it('includes Kinnim, Tamid and Middot with their own first page', () => {
    const service = makeService('tractate-minor')
    expect(byName(service, 'Kinnim')).toMatchObject({ name_he: 'קינים', first_page: 22, total_pages: 25 })
    expect(byName(service, 'Tamid')).toMatchObject({ name_he: 'תמיד', first_page: 25, total_pages: 33 })
    expect(byName(service, 'Middot')).toMatchObject({ name_he: 'מידות', first_page: 34, total_pages: 37 })
    expect(byName(service, 'Berakhot')?.first_page).toBe(2)
  })

  it('rejects a range that starts before the first page of the tractate', () => {
    const service = makeService('tractate-first-page')
    const tamid = byName(service, 'Tamid')!
    const input: ProgramInput = {
      tractateId: tamid.id,
      programName: 'תמיד',
      startPage: 25,
      endPage: 33,
      startDate: '2026-11-08',
      paceMode: 'daily_pace',
      pagesPerDay: 1,
      targetEndDate: '2026-11-16',
      restWeekdays: [],
      restDates: [],
      restHolidays: [],
    }
    expect(() => service.createProgram({ ...input, startPage: 24 })).toThrow()
    expect(() => service.createProgram(input)).not.toThrow()
  })

  it('repairs an old database in place without touching existing ids or programs', () => {
    const dbPath = createTestPath('tractate-migration')
    const first = new DatabaseService(dbPath)
    testServices.push(first)
    first.initialize()
    const shabbatId = byName(first, 'Shabbat')!.id
    const programId = first.createProgram({
      tractateId: shabbatId,
      programName: 'שבת',
      startPage: 2,
      endPage: 10,
      startDate: '2026-11-08',
      paceMode: 'daily_pace',
      pagesPerDay: 1,
      targetEndDate: '2026-11-16',
      restWeekdays: [],
      restDates: [],
      restHolidays: [],
    })
    first.close()

    const raw = new Database(dbPath)
    raw.exec("UPDATE tractates SET total_pages = 156 WHERE name_en = 'Shabbat'")
    raw.exec("UPDATE tractates SET total_pages = 104 WHERE name_en = 'Eruvin'")
    raw.exec("DELETE FROM tractates WHERE name_en IN ('Kinnim', 'Tamid', 'Middot')")
    raw.exec('ALTER TABLE tractates DROP COLUMN first_page')
    raw.close()

    const second = new DatabaseService(dbPath)
    testServices.push(second)
    second.initialize()

    expect(second.getTractates()).toHaveLength(40)
    expect(byName(second, 'Shabbat')).toMatchObject({ id: shabbatId, total_pages: 157, first_page: 2 })
    expect(byName(second, 'Eruvin')?.total_pages).toBe(105)
    expect(byName(second, 'Tamid')?.first_page).toBe(25)
    expect(second.getProgram(programId)?.tractateId).toBe(shabbatId)
  })
})

describe('createPrograms', () => {
  const input = (tractateId: number, endPage: number): ProgramInput => ({
    tractateId,
    programName: `מסכת ${tractateId}`,
    startPage: 2,
    endPage,
    startDate: '2026-11-08',
    paceMode: 'daily_pace',
    pagesPerDay: 1,
    targetEndDate: '2026-11-20',
    restWeekdays: [],
    restDates: [],
    restHolidays: [],
  })

  function makeService(name: string) {
    const service = new DatabaseService(createTestPath(name))
    testServices.push(service)
    return service.initialize()
  }

  it('creates several programs with their schedules', () => {
    const service = makeService('create-programs')
    const ids = service.createPrograms([input(1, 4), input(2, 5), input(3, 6)])
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
    expect(service.getRowCount('study_programs')).toBe(3)
    expect(service.getRowCount('page_progress')).toBe(3 + 4 + 5)
  })

  it('saves nothing when one of the programs is invalid', () => {
    const service = makeService('create-programs-rollback')
    expect(() => service.createPrograms([input(1, 4), input(2, 9999)])).toThrow()
    expect(service.getRowCount('study_programs')).toBe(0)
    expect(service.getRowCount('page_progress')).toBe(0)
  })
})
