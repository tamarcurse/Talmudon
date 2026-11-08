import { vi } from 'vitest'
import { toHebrewPageLabel } from '../main/hebrew-page-label'
import type {
  PageProgressRecord,
  ProgramInput,
  ProgramRecord,
  ProgramStatus,
  ProgramSummary,
  ShasPageRecord,
} from '../main/database'
import { UNIT_KEYS, isPageComplete, unitPercent, type UnitFlags, type UnitTarget } from '../main/progress'

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

export function progressRow(
  pageNumber: number,
  scheduledDate: string,
  units: Partial<UnitFlags> = {},
): PageProgressRecord {
  const full = Object.fromEntries(UNIT_KEYS.map((key) => [key, units[key] ?? false])) as UnitFlags
  return {
    id: pageNumber,
    pageNumber,
    scheduledDate,
    units: full,
    isPageCompleted: isPageComplete(full),
    completedAt: null,
  }
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
  /** Schedule rows returned by getPageProgress (stateful: setUnitsCompleted updates them). */
  progress?: PageProgressRecord[]
  /** Replaces the schedule rows once the program is rescheduled (recalculateProgram or updateProgram). */
  progressAfterRecalc?: PageProgressRecord[]
}

export function mockBridge(options: MockBridgeOptions = {}) {
  // Stateful so pausing/resuming is reflected in the next listProgramSummaries call.
  let summaries = options.summaries ?? []
  let progress = options.progress ?? []
  let program = options.program ?? null
  const progressProgramId = options.program?.id
  const bridge = {
    // Summaries of the program whose schedule is mocked reflect its units, like the real service.
    listProgramSummaries: vi.fn(async () =>
      options.progress === undefined
        ? summaries
        : summaries.map((summary) =>
            summary.id === progressProgramId ? { ...summary, percentComplete: unitPercent(progress) } : summary,
          ),
    ),
    setProgramStatus: vi.fn(async (id: number, status: ProgramStatus) => {
      summaries = summaries.map((summary) => (summary.id === id ? { ...summary, status } : summary))
    }),
    getUserSetting: vi.fn().mockResolvedValue(options.calendar ?? null),
    setUserSetting: vi.fn().mockResolvedValue(undefined),
    getTractates: vi.fn().mockResolvedValue(options.tractates ?? TRACTATES_FIXTURE),
    getShasPages: vi.fn().mockResolvedValue(options.pages ?? buildPagesFixture()),
    getProgram: vi.fn(async () => program),
    createProgram: vi.fn<(input: ProgramInput) => Promise<number>>().mockResolvedValue(options.createdProgramId ?? 1),
    recalculateProgram: vi.fn(async () => {
      if (options.progressAfterRecalc) progress = options.progressAfterRecalc
    }),
    getPageProgress: vi.fn(async () => progress.map((row) => ({ ...row, units: { ...row.units } }))),
    setUnitsCompleted: vi.fn(async (_programId: number, targets: UnitTarget[], done: boolean) => {
      progress = progress.map((row) => {
        const units = { ...row.units }
        for (const target of targets) {
          if (target.pageNumber === row.pageNumber) units[target.unit] = done
        }
        return { ...row, units, isPageCompleted: isPageComplete(units) }
      })
    }),
    updateProgram: vi.fn(async (id: number, input: ProgramInput) => {
      if (program) program = { ...input, id }
      if (options.progressAfterRecalc) progress = options.progressAfterRecalc
    }),
  }
  window.talmudonBridge = bridge as unknown as Window['talmudonBridge']
  return bridge
}
