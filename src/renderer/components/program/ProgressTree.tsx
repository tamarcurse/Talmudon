import { useState } from 'react'
import type { UnitTarget } from '../../../main/progress'
import { useCalendar } from '../../context/CalendarContext'
import { formatIsoDate } from '../../lib/hebrewDate'
import { unitsUnder, type DayNode, type PageNode, type SideNode, type TreeNode } from '../../lib/progressTree'
import TriStateCheckbox from './TriStateCheckbox'

type SetUnits = (targets: UnitTarget[], done: boolean) => void

type Props = {
  days: DayNode[]
  onSetUnits: SetUnits
}

const UNIT_LABELS = { rashi: 'רש"י', tosafot: 'תוספות' } as const

function PageRow({ page, onSetUnits }: { page: PageNode; onSetUnits: SetUnits }) {
  const [expanded, setExpanded] = useState(false)
  const pageName = `דף ${page.label}`
  const toggle = (node: TreeNode) => (done: boolean) => onSetUnits(unitsUnder(node), done)

  return (
    <li className="py-1">
      <div className="flex items-center gap-2">
        <TriStateCheckbox label={pageName} status={page.status} onToggle={toggle(page)} />
        <span className="text-ink">{pageName}</span>
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`פתח ${pageName}`}
          onClick={() => setExpanded((value) => !value)}
          className="rounded px-2 text-sm text-brand hover:bg-brand-soft"
        >
          {expanded ? '▾' : '◂'}
        </button>
      </div>
      {expanded && (
        <ul className="me-6 mt-1 space-y-1 border-s border-line ps-4">
          {page.sides.map((side) => (
            <SideRow key={side.side} side={side} pageName={pageName} onSetUnits={onSetUnits} />
          ))}
        </ul>
      )}
    </li>
  )
}

function SideRow({ side, pageName, onSetUnits }: { side: SideNode; pageName: string; onSetUnits: SetUnits }) {
  const sideName = `${pageName} עמוד ${side.side === 'a' ? "א'" : "ב'"}`
  return (
    <li>
      <label className="flex items-center gap-2 text-ink">
        <TriStateCheckbox label={sideName} status={side.status} onToggle={(done) => onSetUnits(unitsUnder(side), done)} />
        <span>{sideName}</span>
      </label>
      <ul className="me-6 mt-1 space-y-1">
        {side.units.map((unit) => {
          const kind = unit.unit.endsWith('rashi') ? 'rashi' : 'tosafot'
          const unitName = `${sideName} ${UNIT_LABELS[kind]}`
          return (
            <li key={unit.unit}>
              <label className="flex items-center gap-2 text-muted">
                <TriStateCheckbox
                  label={unitName}
                  status={unit.done ? 'done' : 'empty'}
                  onToggle={(done) => onSetUnits(unitsUnder(unit), done)}
                />
                <span>{UNIT_LABELS[kind]}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </li>
  )
}

function ProgressTree({ days, onSetUnits }: Props) {
  const { calendarType } = useCalendar()

  return (
    <ul className="space-y-4">
      {days.map((day) => {
        const dayName = `יום ${formatIsoDate(day.date, calendarType)}`
        return (
          <li key={day.date} className="card p-4">
            <label className="flex items-center gap-2 border-b border-line pb-3 font-semibold text-ink">
              <TriStateCheckbox label={dayName} status={day.status} onToggle={(done) => onSetUnits(unitsUnder(day), done)} />
              <span>{dayName}</span>
            </label>
            <ul className="me-6 mt-2 divide-y divide-line">
              {day.pages.map((page) => (
                <PageRow key={page.pageNumber} page={page} onSetUnits={onSetUnits} />
              ))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}

export default ProgressTree
