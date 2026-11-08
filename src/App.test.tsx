import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProgramRecord, ProgramSummary } from './main/database'
import App from './renderer/App'
import { CalendarProvider } from './renderer/context/CalendarContext'
import { mockBridge, type MockBridgeOptions } from './test/mockBridge'

afterEach(() => {
  delete (window as Partial<Window>).talmudonBridge
})

const SUMMARY: ProgramSummary = {
  id: 5,
  programName: 'שבת בשנה',
  status: 'active',
  percentComplete: 0,
  lag: 0,
  lead: 0,
  estimatedEndDate: '2026-12-25',
}

const PROGRAM: ProgramRecord = {
  id: 5,
  tractateId: 2,
  programName: 'שבת בשנה',
  startPage: 2,
  endPage: 157,
  startDate: '2026-11-08',
  paceMode: 'daily_pace',
  pagesPerDay: 1,
  targetEndDate: '2027-04-12',
  restWeekdays: [],
  restDates: [],
}

function renderApp(options: MockBridgeOptions = {}) {
  const bridge = mockBridge({ summaries: [SUMMARY], program: PROGRAM, ...options })
  render(
    <CalendarProvider>
      <App />
    </CalendarProvider>,
  )
  return bridge
}

describe('App', () => {
  it('opens on the programs dashboard', async () => {
    renderApp()

    expect(screen.getByRole('heading', { name: 'תוכניות הלימוד שלי' })).toBeInTheDocument()
    expect(await screen.findByText('שבת בשנה')).toBeInTheDocument()
  })

  it('create opens the wizard in create mode', async () => {
    const bridge = renderApp()

    fireEvent.click(await screen.findByRole('button', { name: 'צור תוכנית חדשה' }))

    expect(await screen.findByLabelText('חיפוש מסכת')).toBeInTheDocument()
    expect(bridge.getProgram).not.toHaveBeenCalled()
  })

  it('edit loads the program into the wizard', async () => {
    const bridge = renderApp()

    fireEvent.click(await screen.findByRole('button', { name: 'עריכה' }))

    await waitFor(() => expect(bridge.getProgram).toHaveBeenCalledWith(5))
    expect(await screen.findByLabelText('חיפוש מסכת')).toBeInTheDocument()
  })

  it('open enters the program view and can return to the dashboard', async () => {
    renderApp()

    fireEvent.click(await screen.findByRole('button', { name: 'כניסה לתוכנית' }))
    expect(screen.queryByRole('heading', { name: 'תוכניות הלימוד שלי' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'חזרה לתוכניות' }))
    expect(await screen.findByRole('heading', { name: 'תוכניות הלימוד שלי' })).toBeInTheDocument()
  })
})
