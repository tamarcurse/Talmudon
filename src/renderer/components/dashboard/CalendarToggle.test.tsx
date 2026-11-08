import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mockBridge } from '../../../test/mockBridge'
import { CalendarProvider } from '../../context/CalendarContext'
import CalendarToggle from './CalendarToggle'

afterEach(() => {
  delete (window as Partial<Window>).talmudonBridge
})

function renderToggle() {
  return render(
    <CalendarProvider>
      <CalendarToggle />
    </CalendarProvider>,
  )
}

describe('CalendarToggle', () => {
  it('has Gregorian active by default', async () => {
    const bridge = mockBridge()
    renderToggle()
    await waitFor(() => expect(bridge.getUserSetting).toHaveBeenCalled())

    expect(screen.getByRole('button', { name: 'לועזי' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'עברי' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reflects a persisted Hebrew calendar on mount', async () => {
    mockBridge({ calendar: 'hebrew' })
    renderToggle()

    await waitFor(() => expect(screen.getByRole('button', { name: 'עברי' })).toHaveAttribute('aria-pressed', 'true'))
  })

  it('persists the choice when toggled', async () => {
    const bridge = mockBridge()
    renderToggle()
    await waitFor(() => expect(bridge.getUserSetting).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'עברי' }))
    expect(bridge.setUserSetting).toHaveBeenCalledWith('calendar_type', 'hebrew')

    fireEvent.click(screen.getByRole('button', { name: 'לועזי' }))
    expect(bridge.setUserSetting).toHaveBeenLastCalledWith('calendar_type', 'gregorian')
  })
})
