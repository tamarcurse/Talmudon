import { useState } from 'react'
import { HOLIDAY_GROUPS, nextOccurrence, type HolidayGroup } from '../../../main/holidays'
import { useCalendar } from '../../context/CalendarContext'
import { formatIsoDate } from '../../lib/hebrewDate'
import type { Status } from '../../lib/progressTree'
import TriStateCheckbox from '../program/TriStateCheckbox'

type Props = {
  selected: string[]
  onChange: (ids: string[]) => void
  /** ISO date; each holiday shows its next date on or after it. */
  fromIso: string
}

function groupStatus(group: HolidayGroup, selected: string[]): Status {
  const count = group.leaves.filter((leaf) => selected.includes(leaf.id)).length
  return count === 0 ? 'empty' : count === group.leaves.length ? 'done' : 'partial'
}

function DateText({ leafIds, fromIso }: { leafIds: string[]; fromIso: string }) {
  const { calendarType } = useCalendar()
  const dates = nextOccurrence(leafIds[0], fromIso)
  if (dates.length === 0) return null
  const first = formatIsoDate(dates[0], calendarType)
  const last = formatIsoDate(dates[dates.length - 1], calendarType)
  return <span className="text-sm text-muted">{dates.length > 1 ? `${first} – ${last}` : first}</span>
}

function GroupRow({ group, selected, onChange, fromIso }: Props & { group: HolidayGroup }) {
  const [expanded, setExpanded] = useState(false)
  const leafIds = group.leaves.map((leaf) => leaf.id)

  function setGroup(on: boolean) {
    const rest = selected.filter((id) => !leafIds.includes(id))
    onChange(on ? [...rest, ...leafIds] : rest)
  }

  function toggleLeaf(id: string) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id])
  }

  if (group.leaves.length === 1) {
    return (
      <li>
        <label className="flex items-center gap-2 text-ink">
          <input
            type="checkbox"
            aria-label={group.name}
            checked={selected.includes(leafIds[0])}
            onChange={() => toggleLeaf(leafIds[0])}
            className="h-4 w-4 shrink-0 rounded accent-brand"
          />
          <span>{group.name}</span>
          <DateText leafIds={leafIds} fromIso={fromIso} />
        </label>
      </li>
    )
  }

  return (
    <li className="py-1">
      <div className="flex items-center gap-2">
        <TriStateCheckbox label={group.name} status={groupStatus(group, selected)} onToggle={setGroup} />
        <span className="text-ink">{group.name}</span>
        <DateText leafIds={leafIds} fromIso={fromIso} />
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`פתח ${group.name}`}
          onClick={() => setExpanded((value) => !value)}
          className="rounded px-2 text-sm text-brand hover:bg-brand-soft"
        >
          {expanded ? '▾' : '◂'}
        </button>
      </div>
      {expanded && (
        <ul className="me-6 mt-1 space-y-1 border-s border-line ps-4">
          {group.leaves.map((leaf) => (
            <li key={leaf.id}>
              <label className="flex items-center gap-2 text-ink">
                <input
                  type="checkbox"
                  aria-label={`${group.name} – ${leaf.name}`}
                  checked={selected.includes(leaf.id)}
                  onChange={() => toggleLeaf(leaf.id)}
                  className="h-4 w-4 shrink-0 rounded accent-brand"
                />
                <span>{leaf.name}</span>
                <DateText leafIds={[leaf.id]} fromIso={fromIso} />
              </label>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function HolidayPicker({ selected, onChange, fromIso }: Props) {
  return (
    <ul className="space-y-1">
      {HOLIDAY_GROUPS.map((group) => (
        <GroupRow key={group.id} group={group} selected={selected} onChange={onChange} fromIso={fromIso} />
      ))}
    </ul>
  )
}

export default HolidayPicker
