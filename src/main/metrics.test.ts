import { describe, expect, it } from 'vitest'
import { computeProgramMetrics } from './metrics.js'

const NO_REST = { weekdays: [], dates: [] }

type Page = { scheduledDate: string; isPageCompleted: boolean }

function metrics(
  pages: Page[],
  overrides: Partial<Parameters<typeof computeProgramMetrics>[0]> = {},
) {
  return computeProgramMetrics({
    pages,
    today: '2026-11-10',
    status: 'active',
    pausedAt: null,
    startDate: '2026-11-01',
    pagesPerDay: 1,
    rest: NO_REST,
    ...overrides,
  })
}

const done = (scheduledDate: string): Page => ({ scheduledDate, isPageCompleted: true })
const pending = (scheduledDate: string): Page => ({ scheduledDate, isPageCompleted: false })

describe('percentComplete', () => {
  it('is 0 when nothing is completed and 50 when half are', () => {
    expect(metrics([pending('2026-11-11'), pending('2026-11-12')]).percentComplete).toBe(0)
    expect(metrics([done('2026-11-09'), pending('2026-11-12')]).percentComplete).toBe(50)
  })
})

describe('lag and lead', () => {
  it('counts pending pages scheduled before today as lag', () => {
    const result = metrics([pending('2026-11-08'), pending('2026-11-09'), pending('2026-11-12')])
    expect(result).toMatchObject({ lag: 2, lead: 0 })
  })

  it('counts completed pages scheduled after today as lead', () => {
    const result = metrics([done('2026-11-11'), done('2026-11-09'), pending('2026-11-12')])
    expect(result).toMatchObject({ lag: 0, lead: 1 })
  })

  it('does not count a page scheduled exactly today as lag or lead', () => {
    expect(metrics([pending('2026-11-10')])).toMatchObject({ lag: 0, lead: 0 })
    expect(metrics([done('2026-11-10'), pending('2026-11-20')])).toMatchObject({ lag: 0, lead: 0 })
  })

  it('freezes at pausedAt while paused, however much time passes', () => {
    const pages = [pending('2026-11-08'), pending('2026-11-09'), pending('2026-11-12')]
    const paused = { status: 'paused', pausedAt: '2026-11-09' }
    expect(metrics(pages, { ...paused, today: '2026-11-10' }).lag).toBe(1)
    expect(metrics(pages, { ...paused, today: '2026-12-31' }).lag).toBe(1)
  })
})

describe('estimatedEndDate', () => {
  it('projects the remaining pages from today for a lagging program', () => {
    // 3 pending pages at 1/day starting today (2026-11-10) -> 10, 11, 12.
    const pages = [pending('2026-11-05'), pending('2026-11-06'), pending('2026-11-07')]
    expect(metrics(pages).estimatedEndDate).toBe('2026-11-12')
  })

  it('projects from the start date when the program has not started yet', () => {
    const pages = [pending('2026-12-01'), pending('2026-12-02')]
    expect(metrics(pages, { startDate: '2026-12-01' }).estimatedEndDate).toBe('2026-12-02')
  })

  it('is the last scheduled date when every page is complete, and 100%', () => {
    const result = metrics([done('2026-11-03'), done('2026-11-05'), done('2026-11-04')])
    expect(result.percentComplete).toBe(100)
    expect(result.estimatedEndDate).toBe('2026-11-05')
  })
})
