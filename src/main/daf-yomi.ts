// The worldwide Daf Yomi cycle: one daf a day through Shas, 2711 days per cycle.
// Pure date math on ISO `YYYY-MM-DD` strings, like schedule.ts.

import { DAY_MS, parseIso, toIso } from './schedule.js'

/** A tractate as the cycle studies it. This is not always the full tractate (Tamid starts at daf 26). */
export type CycleTractate = { nameEn: string; firstPage: number; lastPage: number }

/** Day 0 of cycle 14: Berakhot 2. */
export const CYCLE_14_START = '2020-01-05'

export const CYCLE_LENGTH_DAYS = 2711

const T = (nameEn: string, lastPage: number, firstPage = 2): CycleTractate => ({ nameEn, firstPage, lastPage })

export const DAF_YOMI_CYCLE: readonly CycleTractate[] = [
  T('Berakhot', 64),
  T('Shabbat', 157),
  T('Eruvin', 105),
  T('Pesachim', 121),
  T('Shekalim', 22),
  T('Yoma', 88),
  T('Sukkah', 56),
  T('Beitzah', 40),
  T('Rosh Hashanah', 35),
  T('Taanit', 31),
  T('Megillah', 32),
  T('Moed Katan', 29),
  T('Chagigah', 27),
  T('Yevamot', 122),
  T('Ketubot', 112),
  T('Nedarim', 91),
  T('Nazir', 66),
  T('Sotah', 49),
  T('Gittin', 90),
  T('Kiddushin', 82),
  T('Bava Kamma', 119),
  T('Bava Metzia', 119),
  T('Bava Batra', 176),
  T('Sanhedrin', 113),
  T('Makkot', 24),
  T('Shevuot', 49),
  T('Avodah Zarah', 76),
  T('Horayot', 14),
  T('Zevachim', 120),
  T('Menachot', 110),
  T('Chullin', 142),
  T('Bechorot', 61),
  T('Arachin', 34),
  T('Temurah', 34),
  T('Keritot', 28),
  T('Meilah', 22),
  T('Kinnim', 25, 23),
  T('Tamid', 33, 26),
  T('Middot', 37, 34),
  T('Niddah', 73),
]

const dayCount = (tractate: CycleTractate) => tractate.lastPage - tractate.firstPage + 1

/** Day offset in the cycle on which each tractate starts. */
const OFFSETS: ReadonlyMap<string, number> = (() => {
  const offsets = new Map<string, number>()
  let offset = 0
  for (const tractate of DAF_YOMI_CYCLE) {
    offsets.set(tractate.nameEn, offset)
    offset += dayCount(tractate)
  }
  return offsets
})()

/** Start (UTC ms) of the cycle containing `time`. */
function cycleStartOf(time: number): number {
  const anchor = parseIso(CYCLE_14_START)
  const dayIndex = Math.round((time - anchor) / DAY_MS)
  return anchor + Math.floor(dayIndex / CYCLE_LENGTH_DAYS) * CYCLE_LENGTH_DAYS * DAY_MS
}

/** The daf studied worldwide on `date`. */
export function dafYomiOn(date: string): { nameEn: string; page: number } {
  const time = parseIso(date)
  let dayInCycle = Math.round((time - cycleStartOf(time)) / DAY_MS)
  for (const tractate of DAF_YOMI_CYCLE) {
    if (dayInCycle < dayCount(tractate)) {
      return { nameEn: tractate.nameEn, page: tractate.firstPage + dayInCycle }
    }
    dayInCycle -= dayCount(tractate)
  }
  throw new Error(`Date outside the Daf Yomi cycle: ${date}`)
}

export type DafYomiWindow = { startDate: string; endDate: string; firstPage: number; lastPage: number }

/**
 * When the cycle studies `nameEn`: the window in the cycle containing `date`, or in the next
 * cycle if the tractate has already ended in the current one.
 */
export function dafYomiWindow(nameEn: string, date: string): DafYomiWindow {
  const tractate = DAF_YOMI_CYCLE.find((item) => item.nameEn === nameEn)
  const offset = OFFSETS.get(nameEn)
  if (!tractate || offset === undefined) {
    throw new Error(`Tractate is not part of the Daf Yomi cycle: ${nameEn}`)
  }
  const time = parseIso(date)
  let cycleStart = cycleStartOf(time)
  const lastDay = (start: number) => start + (offset + dayCount(tractate) - 1) * DAY_MS
  if (lastDay(cycleStart) < time) {
    cycleStart += CYCLE_LENGTH_DAYS * DAY_MS
  }
  return {
    startDate: toIso(cycleStart + offset * DAY_MS),
    endDate: toIso(lastDay(cycleStart)),
    firstPage: tractate.firstPage,
    lastPage: tractate.lastPage,
  }
}
