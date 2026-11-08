import { describe, expect, it } from 'vitest'
import type { PageProgressRecord } from '../../main/database'
import { UNIT_KEYS, type UnitKey } from '../../main/progress'
import { buildProgressTree, unitsUnder } from './progressTree'

function row(pageNumber: number, scheduledDate: string, on: UnitKey[] = []): PageProgressRecord {
  const units = Object.fromEntries(UNIT_KEYS.map((key) => [key, on.includes(key)])) as PageProgressRecord['units']
  return {
    id: pageNumber,
    pageNumber,
    scheduledDate,
    units,
    isPageCompleted: on.length === 4,
    completedAt: null,
  }
}

describe('buildProgressTree', () => {
  it('turns one row into one day with one page, two sides and four units', () => {
    const [day] = buildProgressTree([row(2, '2026-11-08')])
    expect(day.date).toBe('2026-11-08')
    expect(day.pages).toHaveLength(1)
    expect(day.pages[0].label).toBe("ב'")
    expect(day.pages[0].sides.map((s) => s.side)).toEqual(['a', 'b'])
    expect(unitsUnder(day.pages[0])).toHaveLength(4)
  })

  it('groups pages sharing a date and orders by date then page, across rest days', () => {
    const days = buildProgressTree([
      row(5, '2026-11-12'),
      row(3, '2026-11-08'),
      row(2, '2026-11-08'),
      row(4, '2026-11-12'),
    ])
    expect(days.map((d) => d.date)).toEqual(['2026-11-08', '2026-11-12'])
    expect(days.map((d) => d.pages.map((p) => p.pageNumber))).toEqual([
      [2, 3],
      [4, 5],
    ])
  })

  it('computes done / partial / empty at side, page and day level', () => {
    const [day] = buildProgressTree([
      row(2, '2026-11-08', ['side_a_rashi', 'side_a_tosafot']),
      row(3, '2026-11-08'),
    ])
    const page = day.pages[0]
    expect(page.sides.map((s) => s.status)).toEqual(['done', 'empty'])
    expect(page.status).toBe('partial')
    expect(day.pages[1].status).toBe('empty')
    expect(day.status).toBe('partial')

    const [full] = buildProgressTree([row(2, '2026-11-08', [...UNIT_KEYS])])
    expect([full.status, full.pages[0].status]).toEqual(['done', 'done'])
    const [none] = buildProgressTree([row(2, '2026-11-08')])
    expect(none.status).toBe('empty')
  })
})

describe('unitsUnder', () => {
  it('returns exact targets for each level', () => {
    const [day] = buildProgressTree([row(2, '2026-11-08'), row(3, '2026-11-08')])
    const page = day.pages[1]
    expect(unitsUnder(page.sides[1].units[0])).toEqual([{ pageNumber: 3, unit: 'side_b_rashi' }])
    expect(unitsUnder(page.sides[1])).toEqual([
      { pageNumber: 3, unit: 'side_b_rashi' },
      { pageNumber: 3, unit: 'side_b_tosafot' },
    ])
    expect(unitsUnder(page)).toHaveLength(4)
    expect(unitsUnder(day)).toHaveLength(8)
  })
})
