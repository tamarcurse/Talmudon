import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { parseBackup } from './backup.js'
import { DatabaseService, type ProgramInput } from './database.js'
import { UNIT_KEYS } from './progress.js'

const services: DatabaseService[] = []
const dirs: string[] = []

afterEach(() => {
  for (const service of services) service.close()
  services.length = 0
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs.length = 0
})

function dbPath(name: string) {
  const dir = mkdtempSync(join(tmpdir(), `talmudon-${name}-`))
  dirs.push(dir)
  return join(dir, 'talmudon.sqlite')
}

function makeService(name: string) {
  const service = new DatabaseService(dbPath(name))
  services.push(service)
  return service.initialize()
}

const input: ProgramInput = {
  tractateId: 1,
  programName: 'ברכות',
  startPage: 2,
  endPage: 6,
  startDate: '2026-11-08',
  paceMode: 'daily_pace',
  pagesPerDay: 1,
  targetEndDate: '2026-11-12',
  restWeekdays: [6],
  restDates: ['2026-11-20'],
  restHolidays: ['yom-kippur'],
}

function completePage(service: DatabaseService, programId: number, pageNumber: number, today = '2026-11-09') {
  service.setUnitsCompleted(programId, UNIT_KEYS.map((unit) => ({ pageNumber, unit })), true, today)
}

describe('program uid', () => {
  it('gives new programs distinct uids', () => {
    const service = makeService('uid-distinct')
    const a = service.createProgram(input)
    const b = service.createProgram(input)
    const uids = service.exportBackup().programs.map((p) => p.uid)
    expect(a).not.toBe(b)
    expect(new Set(uids).size).toBe(2)
  })

  it('backfills uids on a database created before the column existed', () => {
    const path = dbPath('uid-backfill')
    const first = new DatabaseService(path).initialize()
    first.createProgram(input)
    first.createProgram(input)
    first.close()

    const raw = new Database(path)
    raw.exec('DROP INDEX IF EXISTS idx_study_programs_uid')
    raw.exec('ALTER TABLE study_programs DROP COLUMN uid')
    raw.close()

    const service = new DatabaseService(path).initialize()
    services.push(service)
    const uids = service.exportBackup().programs.map((p) => p.uid)
    expect(uids).toHaveLength(2)
    expect(uids.every((uid) => uid.length > 0)).toBe(true)
    expect(new Set(uids).size).toBe(2)
  })
})

describe('last backup date', () => {
  it('is null until an export is recorded, then roundtrips', () => {
    const service = makeService('last-backup')
    expect(service.getLastBackupAt()).toBeNull()
    service.markBackupExported('2026-11-08T10:30:00.000Z')
    expect(service.getLastBackupAt()).toBe('2026-11-08T10:30:00.000Z')
  })

  it('rejects an invalid timestamp', () => {
    const service = makeService('last-backup-invalid')
    expect(() => service.markBackupExported('yesterday')).toThrow()
    expect(service.getLastBackupAt()).toBeNull()
  })
})

describe('exportBackup / mergeBackup', () => {
  function seed(service: DatabaseService) {
    const active = service.createProgram(input)
    completePage(service, active, 2)
    service.setUnitsCompleted(active, [{ pageNumber: 3, unit: 'side_a_rashi' }], true, '2026-11-09')

    const paused = service.createProgram({ ...input, programName: 'מושהית', restHolidays: [] })
    service.setProgramStatus(paused, 'paused', '2026-11-09')

    const done = service.createProgram({ ...input, programName: 'גמורה', startPage: 2, endPage: 3, restHolidays: [] })
    completePage(service, done, 2)
    completePage(service, done, 3)
    return { active, paused, done }
  }

  it('round-trips programs, progress, status and rest days into a fresh database', () => {
    const source = makeService('rt-source')
    seed(source)
    const backup = parseBackup(JSON.parse(JSON.stringify(source.exportBackup('2026-11-10T00:00:00.000Z'))))

    const target = makeService('rt-target')
    expect(target.mergeBackup(backup)).toEqual({ added: 3, skipped: 0 })

    const sourceSummaries = source.listProgramSummaries('2026-11-10')
    const targetSummaries = target.listProgramSummaries('2026-11-10')
    expect(targetSummaries).toEqual(sourceSummaries)
    for (const summary of sourceSummaries) {
      expect(target.getProgram(summary.id)).toEqual(source.getProgram(summary.id))
      expect(target.getPageProgress(summary.id)).toEqual(source.getPageProgress(summary.id))
    }
    expect(target.getProgram(1)?.restHolidays).toEqual(['yom-kippur'])
    expect(target.getProgram(2)?.status).toBe('paused')
    expect(target.getProgram(3)?.status).toBe('completed')
    expect(target.exportBackup().programs.map((p) => p.uid)).toEqual(backup.programs.map((p) => p.uid))
  })

  it('previews new versus existing programs by uid', () => {
    const source = makeService('preview-source')
    seed(source)
    const backup = source.exportBackup()
    const target = makeService('preview-target')
    expect(target.previewBackup(backup)).toEqual({ total: 3, newPrograms: 3, existingPrograms: 0 })
    target.mergeBackup(backup)
    expect(target.previewBackup(backup)).toEqual({ total: 3, newPrograms: 0, existingPrograms: 3 })
  })

  it('adds on the first merge and skips on the second', () => {
    const source = makeService('twice-source')
    seed(source)
    const backup = source.exportBackup()
    const target = makeService('twice-target')
    expect(target.mergeBackup(backup).added).toBe(3)
    expect(target.mergeBackup(backup)).toEqual({ added: 0, skipped: 3 })
    expect(target.getRowCount('study_programs')).toBe(3)
  })

  it('keeps existing local programs untouched and local settings', () => {
    const source = makeService('keep-source')
    seed(source)
    source.setUserSetting('calendar_type', 'hebrew')
    const backup = source.exportBackup()

    const target = makeService('keep-target')
    const local = target.createProgram({ ...input, programName: 'מקומית' })
    target.setUserSetting('calendar_type', 'gregorian')
    target.mergeBackup(backup)

    expect(target.getProgram(local)?.programName).toBe('מקומית')
    expect(target.getRowCount('study_programs')).toBe(4)
    expect(target.getUserSetting('calendar_type')).toBe('gregorian')
  })

  it('does not overwrite an existing program that shares a uid with the file', () => {
    const source = makeService('skip-source')
    seed(source)
    const backup = source.exportBackup()
    const target = makeService('skip-target')
    target.mergeBackup(backup)
    target.setUnitsCompleted(1, [{ pageNumber: 4, unit: 'side_a_rashi' }], true, '2026-11-09')
    const before = target.getPageProgress(1)
    target.mergeBackup(backup)
    expect(target.getPageProgress(1)).toEqual(before)
  })

  it('rolls everything back when a program refers to an unknown tractate', () => {
    const source = makeService('bad-source')
    seed(source)
    const backup = source.exportBackup()
    backup.programs[2] = { ...backup.programs[2], tractateNameEn: 'Nonexistent' }

    const target = makeService('bad-target')
    expect(() => target.mergeBackup(backup)).toThrow()
    expect(target.getRowCount('study_programs')).toBe(0)
    expect(target.getRowCount('page_progress')).toBe(0)
    expect(target.getRowCount('program_rest_days')).toBe(0)
  })

  it('rolls everything back when a program fails validation', () => {
    const source = makeService('invalid-source')
    seed(source)
    const backup = source.exportBackup()
    backup.programs[1] = { ...backup.programs[1], endPage: 9999 }

    const target = makeService('invalid-target')
    expect(() => target.mergeBackup(backup)).toThrow()
    expect(target.getRowCount('study_programs')).toBe(0)
  })

  it('exports settings and a timestamp', () => {
    const service = makeService('export-meta')
    service.setUserSetting('calendar_type', 'hebrew')
    const backup = service.exportBackup('2026-11-10T08:00:00.000Z')
    expect(backup).toMatchObject({
      format: 'talmudon-backup',
      version: 1,
      exportedAt: '2026-11-10T08:00:00.000Z',
      settings: { calendarType: 'hebrew', showHebrewDates: false },
    })
  })
})
