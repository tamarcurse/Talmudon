import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DatabaseService } from './database.js'

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
})
