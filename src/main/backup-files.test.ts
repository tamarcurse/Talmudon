import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { BackupFormatError, type BackupFile } from './backup.js'
import {
  defaultBackupFileName,
  readBackupFile,
  writeBackupFile,
  writeSafetySnapshot,
} from './backup-files.js'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs.length = 0
})

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'talmudon-backup-files-'))
  dirs.push(dir)
  return dir
}

const backup: BackupFile = {
  format: 'talmudon-backup',
  version: 1,
  exportedAt: '2026-11-08T10:30:00.000Z',
  settings: { calendarType: 'gregorian', showHebrewDates: false },
  programs: [],
}

describe('defaultBackupFileName', () => {
  it('uses the local date', () => {
    expect(defaultBackupFileName(new Date(2026, 10, 8, 23, 59))).toBe('talmudon-backup-2026-11-08.json')
  })
})

describe('writeBackupFile / readBackupFile', () => {
  it('round-trips a backup as UTF-8 JSON', () => {
    const file = join(tempDir(), 'b.json')
    writeBackupFile(file, backup)
    expect(readFileSync(file, 'utf8')).toContain('\n')
    expect(readBackupFile(file)).toEqual(backup)
  })

  it('rejects a file that is not a backup', () => {
    const file = join(tempDir(), 'x.json')
    writeFileSync(file, '{"hello": 1}')
    expect(() => readBackupFile(file)).toThrow(BackupFormatError)
  })

  it('rejects a file that is not JSON', () => {
    const file = join(tempDir(), 'x.json')
    writeFileSync(file, 'plain text')
    expect(() => readBackupFile(file)).toThrow(BackupFormatError)
  })
})

describe('writeSafetySnapshot', () => {
  it('creates the directory and names the file by local timestamp', () => {
    const dir = join(tempDir(), 'nested', 'backups')
    const file = writeSafetySnapshot(dir, backup, new Date(2026, 10, 8, 10, 30, 0))
    expect(file).toBe(join(dir, 'pre-restore-2026-11-08T10-30-00.json'))
    expect(existsSync(file)).toBe(true)
    expect(readBackupFile(file)).toEqual(backup)
  })

  it('keeps only the newest 10 snapshots', () => {
    const dir = tempDir()
    for (let minute = 0; minute < 13; minute += 1) {
      writeSafetySnapshot(dir, backup, new Date(2026, 10, 8, 10, minute, 0))
    }
    const names = readdirSync(dir).sort()
    expect(names).toHaveLength(10)
    expect(names[0]).toBe('pre-restore-2026-11-08T10-03-00.json')
    expect(names[9]).toBe('pre-restore-2026-11-08T10-12-00.json')
  })

  it('does not delete unrelated files', () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'notes.txt'), 'keep')
    for (let minute = 0; minute < 12; minute += 1) {
      writeSafetySnapshot(dir, backup, new Date(2026, 10, 8, 10, minute, 0))
    }
    expect(existsSync(join(dir, 'notes.txt'))).toBe(true)
  })
})
