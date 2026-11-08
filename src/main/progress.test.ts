import { describe, expect, it } from 'vitest'
import { isPageComplete, unitPercent, type UnitFlags } from './progress.js'

const units = (on: number): UnitFlags => ({
  side_a_rashi: on > 0,
  side_a_tosafot: on > 1,
  side_b_rashi: on > 2,
  side_b_tosafot: on > 3,
})

describe('unitPercent', () => {
  it('is 0 for an empty program', () => {
    expect(unitPercent([])).toBe(0)
  })

  it('counts units, not whole pages', () => {
    expect(unitPercent([{ units: units(3) }, { units: units(0) }])).toBe(37.5)
    expect(unitPercent([{ units: units(4) }])).toBe(100)
  })
})

describe('isPageComplete', () => {
  it('requires all four units', () => {
    expect(isPageComplete(units(4))).toBe(true)
    expect(isPageComplete(units(3))).toBe(false)
  })
})
