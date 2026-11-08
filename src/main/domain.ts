export const PACE_MODES = ['target_date', 'daily_pace'] as const
export type PaceMode = (typeof PACE_MODES)[number]

/** Statuses a caller may set by hand; `completed` is reached only by marking the last unit. */
export const SETTABLE_PROGRAM_STATUSES = ['active', 'paused'] as const
export type SettableProgramStatus = (typeof SETTABLE_PROGRAM_STATUSES)[number]

export const CALENDAR_TYPES = ['gregorian', 'hebrew'] as const
export type CalendarType = (typeof CALENDAR_TYPES)[number]
