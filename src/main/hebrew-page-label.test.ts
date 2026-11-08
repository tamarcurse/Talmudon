import { describe, expect, it } from 'vitest'
import { toHebrewPageLabel } from './hebrew-page-label.js'

describe('toHebrewPageLabel', () => {
  it.each([
    [1, 'א\''],
    [2, 'ב\''],
    [5, 'ה\''],
    [9, 'ט\''],
    [10, 'י\''],
    [11, 'י"א'],
    [14, 'י"ד'],
    [15, 'ט"ו'],
    [16, 'ט"ז'],
    [17, 'י"ז'],
    [20, 'כ\''],
    [21, 'כ"א'],
    [99, 'צ"ט'],
    [100, 'ק\''],
    [115, 'קט"ו'],
    [176, 'קע"ו'],
    [200, 'ר\''],
  ])('renders page %i as %s', (page, expected) => {
    expect(toHebrewPageLabel(page)).toBe(expected)
  })
})
