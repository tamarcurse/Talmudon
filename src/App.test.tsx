import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProgramRecord, ProgramSummary } from './main/database'
import App from './renderer/App'
import { CalendarProvider } from './renderer/context/CalendarContext'
import { mockBridge, progressRow, type MockBridgeOptions } from './test/mockBridge'

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
  completedAt: null,
}

const PROGRAM: ProgramRecord = {
  id: 5,
  tractateId: 2,
  programName: 'שבת בשנה',
  startPage: 2,
  endPage: 157,
  startDate: '2026-11-08',
  paceMode: 'daily_pace',
  status: 'active',
  completedAt: null,
  pagesPerDay: 1,
  targetEndDate: '2027-04-12',
  restWeekdays: [],
  restDates: [],
  restHolidays: [],
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

async function openDashboard() {
  fireEvent.click(await screen.findByRole('button', { name: 'כל התוכניות' }))
  await screen.findByRole('heading', { name: 'תוכניות הלימוד שלי' })
}

const LOGO = { name: 'תלמודון – מסך הבית' }
const TODAY_HEADING = { name: 'מה לומדים היום' }
const TODAY_PLAN = [
  {
    programId: 5,
    programName: 'שבת בשנה',
    tractateName: 'שבת',
    todayPages: [progressRow(2, '2026-11-08')],
    overduePages: [],
  },
]

describe('App', () => {
  it('opens on the today screen', async () => {
    renderApp({ todayPlan: TODAY_PLAN })

    expect(screen.getByRole('heading', TODAY_HEADING)).toBeInTheDocument()
    expect(await screen.findByText('מסכת שבת')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'תוכניות הלימוד שלי' })).not.toBeInTheDocument()
  })

  it('"all programs" leads to the dashboard and the logo returns to today', async () => {
    renderApp()

    await openDashboard()
    expect(await screen.findByText('שבת בשנה')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', LOGO))
    expect(await screen.findByRole('heading', TODAY_HEADING)).toBeInTheDocument()
  })

  it('opening a program from the today screen shows the program view', async () => {
    renderApp({ todayPlan: TODAY_PLAN })

    fireEvent.click(await screen.findByRole('button', { name: 'כניסה לתוכנית' }))

    expect(await screen.findByRole('heading', { name: 'שבת בשנה' })).toBeInTheDocument()
  })

  it.each([
    ['all programs', { name: 'כל התוכניות' }, { name: 'תוכניות הלימוד שלי' }],
    ['the logo', LOGO, TODAY_HEADING],
  ])('leaving the wizard through %s asks for confirmation and then goes there', async (_label, button, heading) => {
    renderApp()

    fireEvent.click(await screen.findByRole('button', { name: 'צור תוכנית חדשה' }))
    await screen.findByLabelText('חיפוש מסכת')

    fireEvent.click(screen.getByRole('button', button))
    expect(screen.getByRole('dialog', { name: 'לצאת בלי לשמור?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'יציאה' }))

    expect(await screen.findByRole('heading', heading)).toBeInTheDocument()
  })

  it('dashboard pie reflects pages marked learned on the today screen', async () => {
    renderApp({ todayPlan: TODAY_PLAN })

    fireEvent.click(await screen.findByRole('button', { name: "למדתי דף ב'" }))
    await openDashboard()

    expect(await screen.findByRole('img', { name: 'הושלמו 100%' })).toBeInTheDocument()
  })

  it('create opens the wizard in create mode', async () => {
    const bridge = renderApp()
    await openDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'צור תוכנית חדשה' }))

    expect(await screen.findByLabelText('חיפוש מסכת')).toBeInTheDocument()
    expect(bridge.getProgram).not.toHaveBeenCalled()
  })

  it('edit loads the program into the wizard', async () => {
    const bridge = renderApp()
    await openDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'עריכה' }))

    await waitFor(() => expect(bridge.getProgram).toHaveBeenCalledWith(5))
    expect(await screen.findByLabelText('חיפוש מסכת')).toBeInTheDocument()
  })

  it('open enters the program view and can return to the dashboard', async () => {
    const bridge = renderApp()
    await openDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'כניסה לתוכנית' }))
    expect(await screen.findByRole('heading', { name: 'שבת בשנה' })).toBeInTheDocument()
    expect(bridge.getPageProgress).toHaveBeenCalledWith(5)
    expect(screen.queryByRole('heading', { name: 'תוכניות הלימוד שלי' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'חזרה לתוכניות' }))
    expect(await screen.findByRole('heading', { name: 'תוכניות הלימוד שלי' })).toBeInTheDocument()
  })

  it('edit from the program view opens the wizard and returns to the program view', async () => {
    const bridge = renderApp()
    await openDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'כניסה לתוכנית' }))
    fireEvent.click(await screen.findByRole('button', { name: 'עריכת תוכנית' }))

    await waitFor(() => expect(bridge.getProgram).toHaveBeenCalledWith(5))
    expect(await screen.findByLabelText('חיפוש מסכת')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }))
    expect(await screen.findByRole('heading', { name: 'שבת בשנה' })).toBeInTheDocument()
  })

  it('shows the top bar on the dashboard, program view and wizard', async () => {
    renderApp()
    const logo = LOGO
    expect(screen.getByRole('button', logo)).toBeInTheDocument()
    await openDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'כניסה לתוכנית' }))
    await screen.findByRole('heading', { name: 'שבת בשנה' })
    expect(screen.getByRole('button', logo)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'עריכת תוכנית' }))
    await screen.findByLabelText('חיפוש מסכת')
    expect(screen.getByRole('button', logo)).toBeInTheDocument()
  })

  it('logo returns from the program view to the today screen', async () => {
    renderApp()
    await openDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'כניסה לתוכנית' }))
    await screen.findByRole('heading', { name: 'שבת בשנה' })

    fireEvent.click(screen.getByRole('button', LOGO))
    expect(await screen.findByRole('heading', TODAY_HEADING)).toBeInTheDocument()
  })

  it('logo in the wizard asks for confirmation before leaving', async () => {
    renderApp()

    fireEvent.click(await screen.findByRole('button', { name: 'צור תוכנית חדשה' }))
    await screen.findByLabelText('חיפוש מסכת')

    fireEvent.click(screen.getByRole('button', { name: 'תלמודון – מסך הבית' }))
    expect(screen.getByRole('dialog', { name: 'לצאת בלי לשמור?' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'המשך עריכה' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('חיפוש מסכת')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'תלמודון – מסך הבית' }))
    fireEvent.click(screen.getByRole('button', { name: 'יציאה' }))
    expect(await screen.findByRole('heading', TODAY_HEADING)).toBeInTheDocument()
  })

  it('dashboard pie reflects units checked in the program view', async () => {
    renderApp({ progress: [progressRow(2, '2026-11-08')] })
    await openDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'כניסה לתוכנית' }))
    fireEvent.click(await screen.findByRole('button', { name: "פתח דף ב'" }))
    fireEvent.click(await screen.findByRole('checkbox', { name: "דף ב' עמוד א' רש\"י" }))
    fireEvent.click(screen.getByRole('button', { name: 'חזרה לתוכניות' }))

    expect(await screen.findByRole('img', { name: 'הושלמו 25%' })).toBeInTheDocument()
  })

  it('deleting from the program screen returns to the dashboard without the program', async () => {
    const bridge = renderApp({ todayPlan: TODAY_PLAN })
    await openDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'כניסה לתוכנית' }))
    await screen.findByRole('heading', { name: 'שבת בשנה' })

    fireEvent.click(screen.getByRole('button', { name: 'מחיקה' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'מחיקה' }))

    expect(await screen.findByRole('heading', { name: 'תוכניות הלימוד שלי' })).toBeInTheDocument()
    expect(bridge.deleteProgram).toHaveBeenCalledWith(5)
    expect(await screen.findByText('אין עדיין תוכניות')).toBeInTheDocument()
  })

  describe('backup', () => {
    it('opens the backup dialog from the header', async () => {
      renderApp()
      fireEvent.click(await screen.findByRole('button', { name: 'גיבוי ושחזור' }))
      expect(await screen.findByRole('dialog', { name: 'גיבוי ושחזור' })).toBeInTheDocument()
    })

    it('reloads the dashboard after a restore that added programs', async () => {
      const bridge = renderApp({
        chooseResult: {
          status: 'ready',
          backup: { format: 'talmudon-backup', version: 1, exportedAt: '2026-11-08T10:00:00.000Z', settings: { calendarType: 'gregorian', showHebrewDates: false }, programs: [] },
          preview: { total: 1, newPrograms: 1, existingPrograms: 0 },
        },
        restoreResult: { added: 1, skipped: 0, snapshotPath: 's.json' },
      })
      await openDashboard()
      const before = bridge.listProgramSummaries.mock.calls.length

      fireEvent.click(screen.getByRole('button', { name: 'גיבוי ושחזור' }))
      fireEvent.click(await screen.findByRole('button', { name: 'שחזור מגיבוי' }))
      fireEvent.click(await screen.findByRole('button', { name: 'שחזור' }))
      await screen.findByText(/נוספו 1 תוכניות/)

      await waitFor(() => expect(bridge.listProgramSummaries.mock.calls.length).toBeGreaterThan(before))
    })
  })
})
