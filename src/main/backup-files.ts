import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseBackupText, type BackupFile } from './backup.js'

const SNAPSHOT_PREFIX = 'pre-restore-'
const SNAPSHOT_PATTERN = /^pre-restore-.*\.json$/
const MAX_SNAPSHOTS = 10

const pad = (n: number) => String(n).padStart(2, '0')

function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function defaultBackupFileName(date: Date = new Date()): string {
  return `talmudon-backup-${localDate(date)}.json`
}

export function writeBackupFile(filePath: string, backup: BackupFile): void {
  writeFileSync(filePath, JSON.stringify(backup, null, 2), 'utf8')
}

export function readBackupFile(filePath: string): BackupFile {
  return parseBackupText(readFileSync(filePath, 'utf8'))
}

/** Saves a copy of the current data before a restore and prunes all but the newest snapshots. */
export function writeSafetySnapshot(dir: string, backup: BackupFile, now: Date = new Date()): string {
  mkdirSync(dir, { recursive: true })
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  const filePath = path.join(dir, `${SNAPSHOT_PREFIX}${localDate(now)}T${time}.json`)
  writeBackupFile(filePath, backup)

  // Names sort chronologically because the timestamp is zero-padded.
  const snapshots = readdirSync(dir).filter((name) => SNAPSHOT_PATTERN.test(name)).sort()
  for (const name of snapshots.slice(0, Math.max(0, snapshots.length - MAX_SNAPSHOTS))) {
    rmSync(path.join(dir, name), { force: true })
  }
  return filePath
}
