import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, BACKUP_VERSION, BackupFormatError, parseBackup, parseBackupText, type BackupFile } from './backup.js'

function validBackup(): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: '2026-11-08T10:30:00.000Z',
    settings: { calendarType: 'hebrew', showHebrewDates: false },
    programs: [
      {
        uid: 'uid-1',
        tractateId: 1,
        tractateNameEn: 'Berakhot',
        programName: 'ברכות',
        startPage: 2,
        endPage: 3,
        startDate: '2026-11-08',
        paceMode: 'daily_pace',
        pagesPerDay: 1,
        targetEndDate: '2026-11-09',
        status: 'active',
        pausedAt: null,
        completedAt: null,
        createdAt: '2026-11-08 09:00:00',
        restWeekdays: [6],
        restDates: ['2026-11-10'],
        restHolidays: [],
        pages: [
          {
            pageNumber: 2,
            scheduledDate: '2026-11-08',
            units: { side_a_rashi: true, side_a_tosafot: false, side_b_rashi: false, side_b_tosafot: false },
            completedAt: null,
          },
          {
            pageNumber: 3,
            scheduledDate: '2026-11-09',
            units: { side_a_rashi: false, side_a_tosafot: false, side_b_rashi: false, side_b_tosafot: false },
            completedAt: null,
          },
        ],
      },
    ],
  }
}

type Loose = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function mutated(change: (backup: Loose) => void): unknown {
  const backup = structuredClone(validBackup()) as unknown as Loose
  change(backup)
  return backup
}

describe('parseBackup', () => {
  it('accepts a valid backup unchanged', () => {
    expect(parseBackup(validBackup())).toEqual(validBackup())
  })

  it.each<[string, (b: Loose) => void]>([
    ['wrong format', (b) => (b.format = 'other')],
    ['missing version', (b) => delete b.version],
    ['newer version', (b) => (b.version = 2)],
    ['non-array programs', (b) => (b.programs = {})],
    ['bad exportedAt', (b) => (b.exportedAt = 'yesterday')],
    ['bad calendar type', (b) => (b.settings.calendarType = 'lunar')],
    ['empty uid', (b) => (b.programs[0].uid = '')],
    ['duplicate uid', (b) => b.programs.push(structuredClone(b.programs[0]))],
    ['non-integer page range', (b) => (b.programs[0].startPage = 2.5)],
    ['invalid start date', (b) => (b.programs[0].startDate = '2026-02-30')],
    ['unknown pace mode', (b) => (b.programs[0].paceMode = 'fast')],
    ['unknown status', (b) => (b.programs[0].status = 'archived')],
    ['non-boolean unit', (b) => (b.programs[0].pages[0].units.side_a_rashi = 1)],
    ['missing unit', (b) => delete b.programs[0].pages[0].units.side_b_tosafot],
    ['page outside range', (b) => (b.programs[0].pages[1].pageNumber = 9)],
    ['non-integer page number', (b) => (b.programs[0].pages[0].pageNumber = 2.5)],
    ['duplicate page', (b) => (b.programs[0].pages[1].pageNumber = 2)],
    ['bad scheduled date', (b) => (b.programs[0].pages[0].scheduledDate = 'x')],
    ['bad rest weekday', (b) => (b.programs[0].restWeekdays = [7])],
    ['bad rest date', (b) => (b.programs[0].restDates = ['nope'])],
    ['non-string holiday', (b) => (b.programs[0].restHolidays = [1])],
  ])('rejects %s', (_name, change) => {
    expect(() => parseBackup(mutated(change))).toThrow(BackupFormatError)
  })

  it('rejects non-objects', () => {
    expect(() => parseBackup(null)).toThrow(BackupFormatError)
    expect(() => parseBackup('text')).toThrow(BackupFormatError)
  })
})

describe('parseBackupText', () => {
  it('parses JSON text', () => {
    expect(parseBackupText(JSON.stringify(validBackup()))).toEqual(validBackup())
  })

  it('wraps invalid JSON in BackupFormatError', () => {
    expect(() => parseBackupText('{not json')).toThrow(BackupFormatError)
  })
})
