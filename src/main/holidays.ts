// Catalog of Hebrew holidays and fasts (Israel calendar: one day of Yom Tov). Selections are stored
// as recurring leaf ids; dates are computed on demand with `HDate`.
import { HDate } from '@hebcal/core'

// hebcal month numbering: 1 = Nisan … 7 = Tishrei, 9 = Kislev, 10 = Tevet, 12 = Adar (I), 13 = Adar II.
const NISAN = 1
const SIVAN = 3
const TAMMUZ = 4
const AV = 5
const TISHREI = 7
const KISLEV = 9
const TEVET = 10

type Leaf = { id: string; name: string; dates: (year: number) => HDate[] }
type Group = { id: string; name: string; leaves: Leaf[] }

const SATURDAY = 6

function on(day: number, month: number) {
  return (year: number): HDate[] => [new HDate(day, month, year)]
}

function range(from: number, to: number, month: number) {
  return (year: number): HDate[] =>
    Array.from({ length: to - from + 1 }, (_, i) => new HDate(from + i, month, year))
}

/** A fast that slides by `shift` days when it would fall on Shabbat. */
function fast(day: number, month: number | ((year: number) => number), shift: number) {
  return (year: number): HDate[] => {
    const m = typeof month === 'function' ? month(year) : month
    const date = new HDate(day, m, year)
    return [date.getDay() === SATURDAY ? new HDate(date.abs() + shift) : date]
  }
}

const adar = (year: number) => (HDate.isLeapYear(year) ? 13 : 12)

const chanukahLeaves: Leaf[] = Array.from({ length: 8 }, (_, i) => ({
  id: `chanukah-${i + 1}`,
  name: `נר ${i + 1}`,
  dates: (year: number) => [new HDate(new HDate(25, KISLEV, year).abs() + i)],
}))

const GROUPS: Group[] = [
  {
    id: 'rosh-hashana',
    name: 'ראש השנה',
    leaves: [
      { id: 'rosh-hashana-1', name: 'יום ראשון', dates: on(1, TISHREI) },
      { id: 'rosh-hashana-2', name: 'יום שני', dates: on(2, TISHREI) },
    ],
  },
  { id: 'tzom-gedalia', name: 'צום גדליה', leaves: [{ id: 'tzom-gedalia', name: 'צום גדליה', dates: fast(3, TISHREI, 1) }] },
  { id: 'yom-kippur', name: 'יום כיפור', leaves: [{ id: 'yom-kippur', name: 'יום כיפור', dates: on(10, TISHREI) }] },
  {
    id: 'sukkot',
    name: 'סוכות',
    leaves: [
      { id: 'sukkot-1', name: 'יום טוב ראשון', dates: on(15, TISHREI) },
      { id: 'sukkot-chol-hamoed', name: 'חול המועד', dates: range(16, 21, TISHREI) },
      { id: 'shmini-atzeret', name: 'שמיני עצרת ושמחת תורה', dates: on(22, TISHREI) },
    ],
  },
  { id: 'chanukah', name: 'חנוכה', leaves: chanukahLeaves },
  { id: 'asara-btevet', name: 'עשרה בטבת', leaves: [{ id: 'asara-btevet', name: 'עשרה בטבת', dates: on(10, TEVET) }] },
  {
    id: 'taanit-esther',
    name: 'תענית אסתר',
    leaves: [{ id: 'taanit-esther', name: 'תענית אסתר', dates: fast(13, adar, -2) }],
  },
  {
    id: 'purim',
    name: 'פורים',
    leaves: [
      { id: 'purim', name: 'פורים', dates: (year) => [new HDate(14, adar(year), year)] },
      { id: 'shushan-purim', name: 'שושן פורים', dates: (year) => [new HDate(15, adar(year), year)] },
    ],
  },
  {
    id: 'pesach',
    name: 'פסח',
    leaves: [
      { id: 'pesach-1', name: 'יום טוב ראשון', dates: on(15, NISAN) },
      { id: 'pesach-chol-hamoed', name: 'חול המועד', dates: range(16, 20, NISAN) },
      { id: 'pesach-7', name: 'שביעי של פסח', dates: on(21, NISAN) },
    ],
  },
  { id: 'shavuot', name: 'שבועות', leaves: [{ id: 'shavuot', name: 'שבועות', dates: on(6, SIVAN) }] },
  { id: 'tzom-tammuz', name: 'י"ז בתמוז', leaves: [{ id: 'tzom-tammuz', name: 'י"ז בתמוז', dates: fast(17, TAMMUZ, 1) }] },
  { id: 'tisha-bav', name: 'תשעה באב', leaves: [{ id: 'tisha-bav', name: 'תשעה באב', dates: fast(9, AV, 1) }] },
]

export type HolidayGroup = { id: string; name: string; leaves: Array<{ id: string; name: string }> }

/** In calendar order from Tishrei. */
export const HOLIDAY_GROUPS: HolidayGroup[] = GROUPS.map((group) => ({
  id: group.id,
  name: group.name,
  leaves: group.leaves.map(({ id, name }) => ({ id, name })),
}))

const LEAVES = new Map(GROUPS.flatMap((group) => group.leaves).map((leaf) => [leaf.id, leaf]))

export function isHolidayId(id: unknown): id is string {
  return typeof id === 'string' && LEAVES.has(id)
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

function hdateToIso(date: HDate): string {
  const greg = date.greg()
  return `${pad(greg.getFullYear(), 4)}-${pad(greg.getMonth() + 1)}-${pad(greg.getDate())}`
}

function isoToHDate(iso: string): HDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) {
    throw new Error(`Invalid ISO date: ${iso}`)
  }
  return new HDate(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

const yearCache = new Map<number, Map<string, string[]>>()

/** ISO date -> leaf ids falling on it, for one Hebrew year. */
function leavesByDate(year: number): Map<string, string[]> {
  let byDate = yearCache.get(year)
  if (!byDate) {
    byDate = new Map()
    for (const leaf of LEAVES.values()) {
      for (const date of leaf.dates(year)) {
        const iso = hdateToIso(date)
        byDate.set(iso, [...(byDate.get(iso) ?? []), leaf.id])
      }
    }
    yearCache.set(year, byDate)
  }
  return byDate
}

const dateCache = new Map<string, string[]>()

/** Leaf ids that fall on the given ISO date (usually none). */
export function holidayLeavesOnDate(iso: string): string[] {
  let leaves = dateCache.get(iso)
  if (!leaves) {
    leaves = leavesByDate(isoToHDate(iso).getFullYear()).get(iso) ?? []
    dateCache.set(iso, leaves)
  }
  return leaves
}

/** ISO dates of the next occurrence of a holiday leaf that has not fully passed by `fromIso`. */
export function nextOccurrence(leafId: string, fromIso: string): string[] {
  const leaf = LEAVES.get(leafId)
  if (!leaf) {
    return []
  }
  const startYear = isoToHDate(fromIso).getFullYear()
  for (let year = startYear; year <= startYear + 1; year += 1) {
    const dates = leaf.dates(year).map(hdateToIso)
    if (dates[dates.length - 1] >= fromIso) {
      return dates
    }
  }
  return []
}
