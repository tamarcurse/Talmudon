import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CalendarProvider } from '../context/CalendarContext'
import { formatGregorianDate, formatHebrewDate } from '../lib/hebrewDate'
import { mockBridge } from '../../test/mockBridge'
import Sidebar from './Sidebar'

function renderSidebar() {
  return render(
    <CalendarProvider>
      <Sidebar />
    </CalendarProvider>,
  )
}

afterEach(() => {
  delete (window as Partial<Window>).talmudonBridge
})

describe('Sidebar calendar toggle', () => {
  it('renders the לועזי / עברי toggle with Gregorian active by default', async () => {
    const bridge = mockBridge()
    renderSidebar()
    await vi.waitFor(() => expect(bridge.getUserSetting).toHaveBeenCalled())

    expect(screen.getByRole('button', { name: 'לועזי' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'עברי' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('sample-date')).toHaveTextContent(formatGregorianDate(new Date()))
  })

  it('reflects a persisted Hebrew calendar on mount', async () => {
    mockBridge({ calendar: 'hebrew' })
    renderSidebar()

    expect(await screen.findByText(formatHebrewDate(new Date()))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'עברי' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('flips the sample date and persists the choice when toggled', async () => {
    const bridge = mockBridge()
    renderSidebar()
    await vi.waitFor(() => expect(bridge.getUserSetting).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'עברי' }))

    expect(screen.getByTestId('sample-date')).toHaveTextContent(formatHebrewDate(new Date()))
    expect(bridge.setUserSetting).toHaveBeenCalledWith('calendar_type', 'hebrew')

    fireEvent.click(screen.getByRole('button', { name: 'לועזי' }))

    expect(screen.getByTestId('sample-date')).toHaveTextContent(formatGregorianDate(new Date()))
    expect(bridge.setUserSetting).toHaveBeenLastCalledWith('calendar_type', 'gregorian')
  })
})
