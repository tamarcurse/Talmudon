import { isPageComplete, unitPercent, type UnitFlags } from './progress.js'
import { computeEndDate, type RestRules } from './schedule.js'

export type MetricsPage = { scheduledDate: string; units: UnitFlags }

export type ProgramMetrics = {
  percentComplete: number
  lag: number
  lead: number
  estimatedEndDate: string | null
}

/**
 * Dashboard numbers for one program. ISO dates compare correctly as strings.
 * A paused program is evaluated at `pausedAt`, so lag/lead freeze while it is paused.
 */
export function computeProgramMetrics(params: {
  pages: MetricsPage[]
  today: string
  status: string
  pausedAt: string | null
  startDate: string
  pagesPerDay: number
  rest: RestRules
}): ProgramMetrics {
  const { pages, today, status, pausedAt, startDate, pagesPerDay, rest } = params
  const referenceDate = status === 'paused' && pausedAt ? pausedAt : today

  const completed = pages.filter((page) => isPageComplete(page.units))
  const pending = pages.filter((page) => !isPageComplete(page.units))

  const percentComplete = unitPercent(pages)
  const lag = pending.filter((page) => page.scheduledDate < referenceDate).length
  const lead = completed.filter((page) => page.scheduledDate > referenceDate).length

  const estimatedEndDate =
    pending.length === 0
      ? pages.reduce<string | null>(
          (latest, page) => (latest === null || page.scheduledDate > latest ? page.scheduledDate : latest),
          null,
        )
      : computeEndDate({
          startDate: referenceDate > startDate ? referenceDate : startDate,
          totalDafim: pending.length,
          pagesPerDay,
          rest,
        })

  return { percentComplete, lag, lead, estimatedEndDate }
}
