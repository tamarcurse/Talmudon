import { vi } from 'vitest'
import { toHebrewPageLabel } from '../main/hebrew-page-label'
import type { ProgramInput, ProgramRecord, ProgramStatus, ProgramSummary, ShasPageRecord } from '../main/database'

export const TRACTATES_FIXTURE = [
  { id: 1, name_he: 'ברכות', name_en: 'Berakhot', total_pages: 64 },
  { id: 2, name_he: 'שבת', name_en: 'Shabbat', total_pages: 157 },
  { id: 3, name_he: 'עירובין', name_en: 'Eruvin', total_pages: 105 },
  { id: 4, name_he: 'פסחים', name_en: 'Pesachim', total_pages: 121 },
]

export function buildPagesFixture(lastPage = 200): ShasPageRecord[] {
  return Array.from({ length: lastPage }, (_, index) => ({
    page_number: index + 1,
    page_label_he: toHebrewPageLabel(index + 1),
  }))
}

export type MockBridgeOptions = {
  /** Persisted calendar_type returned by getUserSetting. */
  calendar?: string | null
  tractates?: typeof TRACTATES_FIXTURE
  pages?: ShasPageRecord[]
  /** Program returned by getProgram (edit mode). */
  program?: ProgramRecord | null
  createdProgramId?: number
  /** Summaries returned by listProgramSummaries (dashboard). */
  summaries?: ProgramSummary[]
}

export function mockBridge(options: MockBridgeOptions = {}) {
  // Stateful so pausing/resuming is reflected in the next listProgramSummaries call.
  let summaries = options.summaries ?? []
  const bridge = {
    listProgramSummaries: vi.fn(async () => summaries),
    setProgramStatus: vi.fn(async (id: number, status: ProgramStatus) => {
      summaries = summaries.map((summary) => (summary.id === id ? { ...summary, status } : summary))
    }),
    getUserSetting: vi.fn().mockResolvedValue(options.calendar ?? null),
    setUserSetting: vi.fn().mockResolvedValue(undefined),
    getTractates: vi.fn().mockResolvedValue(options.tractates ?? TRACTATES_FIXTURE),
    getShasPages: vi.fn().mockResolvedValue(options.pages ?? buildPagesFixture()),
    getProgram: vi.fn().mockResolvedValue(options.program ?? null),
    createProgram: vi.fn<(input: ProgramInput) => Promise<number>>().mockResolvedValue(options.createdProgramId ?? 1),
    recalculateProgram: vi.fn().mockResolvedValue(undefined),
    getPageProgress: vi.fn().mockResolvedValue([]),
    setPageCompleted: vi.fn().mockResolvedValue(undefined),
    updateProgram: vi.fn<(id: number, input: ProgramInput) => Promise<void>>().mockResolvedValue(undefined),
  }
  window.talmudonBridge = bridge as unknown as Window['talmudonBridge']
  return bridge
}
