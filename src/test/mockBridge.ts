import { vi } from 'vitest'
import { toHebrewPageLabel } from '../main/hebrew-page-label'
import type {
  PageProgressRecord,
  ProgramInput,
  ProgramRecord,
  SettableProgramStatus,
  ProgramSummary,
  ShasPageRecord,
  TodayProgramPlan,
} from '../main/database'
import type { ChooseBackupResult, ExportBackupResult, RestoreBackupResult } from '../main/preload'
import type { StudyStats } from '../main/stats'
import { UNIT_KEYS, isPageComplete, unitPercent, type UnitFlags, type UnitTarget } from '../main/progress'

export const TRACTATES_FIXTURE = [
  { id: 1, name_he: 'ברכות', name_en: 'Berakhot', total_pages: 64, first_page: 2 },
  { id: 2, name_he: 'שבת', name_en: 'Shabbat', total_pages: 157, first_page: 2 },
  { id: 3, name_he: 'עירובין', name_en: 'Eruvin', total_pages: 105, first_page: 2 },
  { id: 4, name_he: 'פסחים', name_en: 'Pesachim', total_pages: 121, first_page: 2 },
  { id: 5, name_he: 'תמיד', name_en: 'Tamid', total_pages: 33, first_page: 25 },
  { id: 6, name_he: 'בכורות', name_en: 'Bechorot', total_pages: 61, first_page: 2 },
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
  /** Ids returned by createPrograms (default: 1, 2, 3, …). */
  createdProgramIds?: number[]
  /** Summaries returned by listProgramSummaries (dashboard). */
  summaries?: ProgramSummary[]
  /** Schedule rows returned by getPageProgress (stateful: setUnitsCompleted updates them). */
  progress?: PageProgressRecord[]
  /** Replaces the schedule rows once the program is rescheduled (recalculateProgram or updateProgram). */
  progressAfterRecalc?: PageProgressRecord[]
  /** Plan returned by getTodayPlan (stateful: setUnitsCompleted updates the units inside it). */
  todayPlan?: TodayProgramPlan[]
  /** Stats returned by getStudyStats. */
  studyStats?: StudyStats
  /** completedAt stamped on a page when its last unit is checked (default: a fixed UTC noon). */
  completedAtNow?: string
  /** Last backup timestamp (stateful: a saved export updates it). */
  lastBackupAt?: string | null
  exportResult?: ExportBackupResult
  chooseResult?: ChooseBackupResult
  restoreResult?: RestoreBackupResult
}

export function mockBridge(options: MockBridgeOptions = {}) {
  // Stateful so pausing/resuming is reflected in the next listProgramSummaries call.
  let summaries = options.summaries ?? []
  let progress = options.progress ?? []
  let program = options.program ?? null
  let todayPlan = options.todayPlan ?? []
  const completedAtNow = options.completedAtNow ?? '2026-11-08 12:00:00'
  const planRows = (plan: TodayProgramPlan) => [...plan.todayPages, ...plan.overduePages]
  const progressProgramId = options.program?.id
  let lastBackupAt = options.lastBackupAt ?? null
  const bridge = {
    getLastBackupAt: vi.fn(async () => lastBackupAt),
    exportBackup: vi.fn(async (): Promise<ExportBackupResult> => {
      const result = options.exportResult ?? { status: 'canceled' }
      if (result.status === 'saved') lastBackupAt = result.exportedAt
      return result
    }),
    chooseBackupFile: vi.fn(async (): Promise<ChooseBackupResult> => options.chooseResult ?? { status: 'canceled' }),
    restoreBackup: vi.fn(
      async (): Promise<RestoreBackupResult> =>
        options.restoreResult ?? { added: 0, skipped: 0, snapshotPath: 'snapshot.json' },
    ),
    // Summaries of the program whose schedule is mocked reflect its units, like the real service.
    listProgramSummaries: vi.fn(async () =>
      summaries.map((summary) => {
        if (options.progress !== undefined && summary.id === progressProgramId) {
          return { ...summary, percentComplete: unitPercent(progress) }
        }
        const plan = todayPlan.find((entry) => entry.programId === summary.id)
        return plan ? { ...summary, percentComplete: unitPercent(planRows(plan)) } : summary
      }),
    ),
    setProgramStatus: vi.fn(async (id: number, status: SettableProgramStatus) => {
      summaries = summaries.map((summary) => (summary.id === id ? { ...summary, status } : summary))
    }),
    deleteProgram: vi.fn(async (id: number) => {
      summaries = summaries.filter((summary) => summary.id !== id)
      todayPlan = todayPlan.filter((plan) => plan.programId !== id)
    }),
    getUserSetting: vi.fn().mockResolvedValue(options.calendar ?? null),
    setUserSetting: vi.fn().mockResolvedValue(undefined),
    getTractates: vi.fn().mockResolvedValue(options.tractates ?? TRACTATES_FIXTURE),
    getShasPages: vi.fn().mockResolvedValue(options.pages ?? buildPagesFixture()),
    getProgram: vi.fn(async () => program),
    createProgram: vi.fn<(input: ProgramInput) => Promise<number>>().mockResolvedValue(options.createdProgramId ?? 1),
    createPrograms: vi
      .fn<(inputs: ProgramInput[]) => Promise<number[]>>()
      .mockImplementation(async (inputs) => options.createdProgramIds ?? inputs.map((_, index) => index + 1)),
    recalculateProgram: vi.fn(async () => {
      if (options.progressAfterRecalc) progress = options.progressAfterRecalc
    }),
    getPageProgress: vi.fn(async () => progress.map((row) => ({ ...row, units: { ...row.units } }))),
    getTodayPlan: vi.fn(async () => structuredClone(todayPlan)),
    getStudyStats: vi.fn(async () => options.studyStats ?? { currentStreak: 0, pagesLast7Days: 0, pagesLast30Days: 0 }),
    setUnitsCompleted: vi.fn(async (programId: number, targets: UnitTarget[], done: boolean) => {
      const applyUnits = (row: PageProgressRecord): PageProgressRecord => {
        const units = { ...row.units }
        for (const target of targets) {
          if (target.pageNumber === row.pageNumber) units[target.unit] = done
        }
        const isPageCompleted = isPageComplete(units)
        const completedAt = isPageCompleted ? (row.completedAt ?? completedAtNow) : null
        return { ...row, units, isPageCompleted, completedAt }
      }
      todayPlan = todayPlan.map((plan) =>
        plan.programId === programId
          ? { ...plan, todayPages: plan.todayPages.map(applyUnits), overduePages: plan.overduePages.map(applyUnits) }
          : plan,
      )
      progress = progress.map((row) => {
        const units = { ...row.units }
        for (const target of targets) {
          if (target.pageNumber === row.pageNumber) units[target.unit] = done
        }
        const isPageCompleted = isPageComplete(units)
        const completedAt = isPageCompleted ? (row.completedAt ?? completedAtNow) : null
        return { ...row, units, isPageCompleted, completedAt }
      })
      // Like the real service: finishing every unit completes (and locks) the program.
      if (program && program.id === programId && progress.length > 0 && progress.every((row) => row.isPageCompleted)) {
        program = { ...program, status: 'completed', completedAt: '2026-11-08' }
      }
    }),
    updateProgram: vi.fn(async (id: number, input: ProgramInput) => {
      if (program) program = { ...program, ...input, id }
      if (options.progressAfterRecalc) progress = options.progressAfterRecalc
    }),
  }
  window.talmudonBridge = bridge as unknown as Window['talmudonBridge']
  return bridge
}
