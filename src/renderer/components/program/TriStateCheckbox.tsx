import { useEffect, useRef } from 'react'
import type { Status } from '../../lib/progressTree'

type Props = {
  label: string
  status: Status
  /** `done` is the state to move to: a partial or empty node turns everything on, a done node turns it off. */
  onToggle: (done: boolean) => void
  disabled?: boolean
}

function TriStateCheckbox({ label, status, onToggle, disabled = false }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = status === 'partial'
  }, [status])

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={status === 'done'}
      onChange={() => onToggle(status !== 'done')}
      disabled={disabled}
      className="h-4 w-4 shrink-0 rounded accent-brand"
    />
  )
}

export default TriStateCheckbox
