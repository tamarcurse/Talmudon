import { describe, expect, it } from 'vitest'
import { progressRow } from '../../test/mockBridge'
import type { PageProgressRecord } from '../../main/database'
import { completionSummary, hadranText } from './completionSummary'

const ALL = { side_a_rashi: true, side_a_tosafot: true, side_b_rashi: true, side_b_tosafot: true }

function done(page: number, completedAt: string | null): PageProgressRecord {
  return { ...progressRow(page, '2026-11-01', ALL), completedAt }
}

describe('completionSummary', () => {
  it('returns null when a page is not complete', () => {
    expect(completionSummary([done(2, '2026-11-01 12:00:00'), progressRow(3, '2026-11-01')], '2026-11-20')).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(completionSummary([], '2026-11-20')).toBeNull()
  })

  it('uses the earliest completedAt as start and the latest as end', () => {
    const rows = [done(3, '2026-11-10 12:00:00'), done(2, '2026-11-01 12:00:00'), done(4, '2026-11-05 12:00:00')]
    const result = completionSummary(rows, '2026-11-20')
    expect(result?.startDate).toBe('2026-11-01')
    expect(result?.endDate).toBe('2026-11-10')
  })

  it('counts a completed page with null completedAt as today', () => {
    const result = completionSummary([done(2, '2026-11-01 12:00:00'), done(3, null)], '2026-11-20')
    expect(result?.endDate).toBe('2026-11-20')
  })

  it('counts both ends in durationDays', () => {
    expect(completionSummary([done(2, '2026-11-05 12:00:00')], '2026-11-20')?.durationDays).toBe(1)
    expect(
      completionSummary([done(2, '2026-11-01 12:00:00'), done(3, '2026-11-10 12:00:00')], '2026-11-20')?.durationDays,
    ).toBe(10)
  })
})

describe('hadranText', () => {
  it('fills in the tractate name three times', () => {
    const text = hadranText('שבת')
    expect(text.match(/הדרן עלך מסכת שבת/g)).toHaveLength(1)
    expect(text.match(/מסכת שבת/g)).toHaveLength(3)
  })
})
