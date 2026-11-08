import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockBridge } from '../../test/mockBridge'
import { CalendarProvider, useCalendar } from './CalendarContext'

function CalendarTypeProbe() {
  const { calendarType } = useCalendar()
  return <p data-testid="calendar-type">{calendarType}</p>
}

afterEach(() => {
  delete (window as Partial<Window>).talmudonBridge
})

describe('CalendarProvider', () => {
  it('defaults calendarType to gregorian', () => {
    mockBridge()
    render(
      <CalendarProvider>
        <CalendarTypeProbe />
      </CalendarProvider>,
    )

    expect(screen.getByTestId('calendar-type')).toHaveTextContent('gregorian')
  })

  it('loads the persisted calendar type on mount', async () => {
    const bridge = mockBridge({ calendar: 'hebrew' })
    render(
      <CalendarProvider>
        <CalendarTypeProbe />
      </CalendarProvider>,
    )

    expect(await screen.findByText('hebrew')).toBeInTheDocument()
    expect(bridge.getUserSetting).toHaveBeenCalledWith('calendar_type')
  })

  it('ignores an unknown persisted value', async () => {
    const bridge = mockBridge({ calendar: 'banana' })
    render(
      <CalendarProvider>
        <CalendarTypeProbe />
      </CalendarProvider>,
    )

    await vi.waitFor(() => expect(bridge.getUserSetting).toHaveBeenCalled())
    expect(screen.getByTestId('calendar-type')).toHaveTextContent('gregorian')
  })

  it('works without the Electron bridge (plain browser)', () => {
    render(
      <CalendarProvider>
        <CalendarTypeProbe />
      </CalendarProvider>,
    )

    expect(screen.getByTestId('calendar-type')).toHaveTextContent('gregorian')
  })
})

describe('useCalendar', () => {
  it('throws when used outside a CalendarProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<CalendarTypeProbe />)).toThrow(/CalendarProvider/)
  })
})
