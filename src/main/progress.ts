// The four atomic study units of a page (daf). Keys are the page_progress column names,
// so they double as the allow-list for SQL column interpolation.
export const UNIT_KEYS = ['side_a_rashi', 'side_a_tosafot', 'side_b_rashi', 'side_b_tosafot'] as const
export type UnitKey = (typeof UNIT_KEYS)[number]
export type UnitFlags = Record<UnitKey, boolean>
export type UnitTarget = { pageNumber: number; unit: UnitKey }

export function isUnitKey(value: unknown): value is UnitKey {
  return (UNIT_KEYS as readonly unknown[]).includes(value)
}

export function isPageComplete(units: UnitFlags): boolean {
  return UNIT_KEYS.every((key) => units[key])
}

/** Completion percent by atomic units: done / (pages x 4) x 100. 0 for an empty program. */
export function unitPercent(pages: Array<{ units: UnitFlags }>): number {
  if (pages.length === 0) {
    return 0
  }
  const done = pages.reduce((sum, page) => sum + UNIT_KEYS.filter((key) => page.units[key]).length, 0)
  return (done / (pages.length * UNIT_KEYS.length)) * 100
}
