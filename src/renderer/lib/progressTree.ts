import type { PageProgressRecord } from '../../main/database'
import { toHebrewPageLabel } from '../../main/hebrew-page-label'
import type { UnitKey, UnitTarget } from '../../main/progress'

export type Status = 'done' | 'partial' | 'empty'
export type UnitNode = { kind: 'unit'; pageNumber: number; unit: UnitKey; done: boolean }
export type SideNode = {
  kind: 'side'
  side: 'a' | 'b'
  pageNumber: number
  status: Status
  units: [UnitNode, UnitNode]
}
export type PageNode = {
  kind: 'page'
  pageNumber: number
  label: string
  status: Status
  sides: [SideNode, SideNode]
}
export type DayNode = { kind: 'day'; date: string; status: Status; pages: PageNode[] }
export type TreeNode = DayNode | PageNode | SideNode | UnitNode

function statusOf(flags: boolean[]): Status {
  if (flags.every(Boolean)) return 'done'
  return flags.some(Boolean) ? 'partial' : 'empty'
}

function buildSide(row: PageProgressRecord, side: 'a' | 'b'): SideNode {
  const unit = (kind: 'rashi' | 'tosafot'): UnitNode => {
    const key = `side_${side}_${kind}` as UnitKey
    return { kind: 'unit', pageNumber: row.pageNumber, unit: key, done: row.units[key] }
  }
  const units: [UnitNode, UnitNode] = [unit('rashi'), unit('tosafot')]
  return { kind: 'side', side, pageNumber: row.pageNumber, status: statusOf(units.map((u) => u.done)), units }
}

function buildPage(row: PageProgressRecord): PageNode {
  const sides: [SideNode, SideNode] = [buildSide(row, 'a'), buildSide(row, 'b')]
  return {
    kind: 'page',
    pageNumber: row.pageNumber,
    label: toHebrewPageLabel(row.pageNumber),
    status: statusOf(sides.flatMap((side) => side.units.map((u) => u.done))),
    sides,
  }
}

/** Groups schedule rows into days (ordered by date), each holding its pages (ordered by page). */
export function buildProgressTree(rows: PageProgressRecord[]): DayNode[] {
  const byDate = new Map<string, PageProgressRecord[]>()
  for (const row of rows) {
    byDate.set(row.scheduledDate, [...(byDate.get(row.scheduledDate) ?? []), row])
  }
  return [...byDate.keys()]
    .sort()
    .map((date) => {
      const pages = (byDate.get(date) ?? []).sort((a, b) => a.pageNumber - b.pageNumber).map(buildPage)
      const statuses = pages.map((page) => page.status)
      const status: Status = statuses.every((s) => s === 'done')
        ? 'done'
        : statuses.every((s) => s === 'empty')
          ? 'empty'
          : 'partial'
      return { kind: 'day', date, status, pages }
    })
}

/** Every atomic unit at or below a node. */
export function unitsUnder(node: TreeNode): UnitTarget[] {
  switch (node.kind) {
    case 'unit':
      return [{ pageNumber: node.pageNumber, unit: node.unit }]
    case 'side':
      return node.units.flatMap(unitsUnder)
    case 'page':
      return node.sides.flatMap(unitsUnder)
    case 'day':
      return node.pages.flatMap(unitsUnder)
  }
}
