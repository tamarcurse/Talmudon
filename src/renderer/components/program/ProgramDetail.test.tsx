import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProgramRecord } from '../../../main/database'
import { mockBridge, progressRow, type MockBridgeOptions } from '../../../test/mockBridge'
import { CalendarProvider } from '../../context/CalendarContext'
import AppHeader from '../layout/AppHeader'
import { formatIsoDate } from '../../lib/hebrewDate'
import ProgramDetail from './ProgramDetail'

afterEach(() => {
  delete (window as Partial<Window>).talmudonBridge
})

const PROGRAM: ProgramRecord = {
  id: 7,
  tractateId: 2,
  programName: 'שבת בשנה',
  startPage: 2,
  endPage: 3,
  startDate: '2026-11-08',
  paceMode: 'daily_pace',
  status: 'active',
  completedAt: null,
  pagesPerDay: 2,
  targetEndDate: '2026-11-08',
  restWeekdays: [],
  restDates: [],
  restHolidays: [],
}

const ALL_DONE = { side_a_rashi: true, side_a_tosafot: true, side_b_rashi: true, side_b_tosafot: true }
const ONE_PAGE = [progressRow(3, '2026-11-08')]
const TWO_PAGES = [progressRow(2, '2026-11-08'), progressRow(3, '2026-11-08')]

async function renderDetail(options: MockBridgeOptions = {}) {
  const bridge = mockBridge({ program: PROGRAM, progress: ONE_PAGE, ...options })
  const handlers = { onBack: vi.fn(), onEdit: vi.fn(), onDeleted: vi.fn() }
  render(
    <CalendarProvider>
      <AppHeader onHome={vi.fn()}>
        <ProgramDetail programId={7} {...handlers} />
      </AppHeader>
    </CalendarProvider>,
  )
  await screen.findByRole('heading', { name: 'שבת בשנה' })
  await waitFor(() => expect(bridge.getPageProgress).toHaveBeenCalled())
  return { bridge, ...handlers }
}

const dayName = `יום ${formatIsoDate('2026-11-08', 'gregorian')}`
const expand = (label: string) => fireEvent.click(screen.getByRole('button', { name: `פתח דף ${label}` }))

describe('header', () => {
  it('shows the name, pie, calendar toggle and action buttons', async () => {
    await renderDetail()

    expect(screen.getByRole('img', { name: 'הושלמו 0%' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'לוח שנה' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'חישוב מסלול מחדש' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'עריכת תוכנית' })).toBeInTheDocument()
  })

  it('edit and back call their handlers', async () => {
    const { onEdit, onBack } = await renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'עריכת תוכנית' }))
    expect(onEdit).toHaveBeenCalledWith(7)
    fireEvent.click(screen.getByRole('button', { name: 'חזרה לתוכניות' }))
    expect(onBack).toHaveBeenCalled()
  })
})

describe('tree', () => {
  it('shows only days and pages by default', async () => {
    await renderDetail()

    expect(await screen.findByRole('checkbox', { name: dayName })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: "דף ג'" })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: "דף ג' עמוד א'" })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: "פתח דף ג'" })).toHaveAttribute('aria-expanded', 'false')
  })

  it('expands and collapses a page', async () => {
    await renderDetail()
    expand("ג'")

    expect(screen.getByRole('button', { name: "פתח דף ג'" })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('checkbox', { name: "דף ג' עמוד א'" })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: "דף ג' עמוד ב'" })).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox', { name: /רש"י|תוספות/ })).toHaveLength(4)

    expand("ג'")
    expect(screen.queryByRole('checkbox', { name: "דף ג' עמוד א'" })).not.toBeInTheDocument()
  })

  it('shows units that arrive already done as checked, with the right percent', async () => {
    await renderDetail({ progress: [progressRow(3, '2026-11-08', { side_a_rashi: true, side_a_tosafot: true })] })
    await screen.findByRole('img', { name: 'הושלמו 50%' })
    expand("ג'")

    expect(screen.getByRole('checkbox', { name: "דף ג' עמוד א'" })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: "דף ג' עמוד ב'" })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: "דף ג'" })).toBePartiallyChecked()
  })
})

describe('marking', () => {
  it('marks one unit atomically and updates the pie and ancestors', async () => {
    const { bridge } = await renderDetail()
    expand("ג'")

    fireEvent.click(screen.getByRole('checkbox', { name: 'דף ג\' עמוד א\' רש"י' }))

    expect(bridge.setUnitsCompleted).toHaveBeenCalledWith(7, [{ pageNumber: 3, unit: 'side_a_rashi' }], true)
    expect(await screen.findByRole('img', { name: 'הושלמו 25%' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: "דף ג'" })).toBePartiallyChecked()
    expect(screen.getByRole('checkbox', { name: dayName })).toBePartiallyChecked()
  })

  it('marking a day marks every unit beneath it in one call, and unmarking clears them', async () => {
    const { bridge } = await renderDetail({ progress: TWO_PAGES })

    fireEvent.click(screen.getByRole('checkbox', { name: dayName }))
    expect(bridge.setUnitsCompleted).toHaveBeenCalledTimes(1)
    expect(bridge.setUnitsCompleted.mock.calls[0][1]).toHaveLength(8)
    expect(bridge.setUnitsCompleted.mock.calls[0][2]).toBe(true)
    expect(await screen.findByRole('img', { name: 'הושלמו 100%' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: dayName })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: "דף ב'" })).toBeChecked()
  })

  it('unmarking a day clears every unit beneath it', async () => {
    const { bridge } = await renderDetail({
      progress: TWO_PAGES.map((row) => progressRow(row.pageNumber, row.scheduledDate, ALL_DONE)),
    })

    fireEvent.click(screen.getByRole('checkbox', { name: dayName }))
    expect(bridge.setUnitsCompleted.mock.calls[0][2]).toBe(false)
    expect(await screen.findByRole('img', { name: 'הושלמו 0%' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: dayName })).not.toBeChecked()
  })

  it('clicking a partial parent turns everything on', async () => {
    const { bridge } = await renderDetail({ progress: [progressRow(3, '2026-11-08', { side_a_rashi: true })] })

    fireEvent.click(screen.getByRole('checkbox', { name: "דף ג'" }))

    expect(bridge.setUnitsCompleted.mock.calls[0][2]).toBe(true)
    expect(await screen.findByRole('img', { name: 'הושלמו 100%' })).toBeInTheDocument()
  })

  it('reloads from the bridge when saving fails', async () => {
    const { bridge } = await renderDetail()
    bridge.setUnitsCompleted.mockRejectedValueOnce(new Error('boom'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    fireEvent.click(screen.getByRole('checkbox', { name: "דף ג'" }))

    await waitFor(() => expect(bridge.getPageProgress).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('img', { name: 'הושלמו 0%' })).toBeInTheDocument()
    consoleError.mockRestore()
  })
})

describe('recalculate and calendar', () => {
  const openDialog = () => {
    fireEvent.click(screen.getByRole('button', { name: 'חישוב מסלול מחדש' }))
    return screen.getByRole('dialog', { name: 'חישוב מסלול מחדש' })
  }

  it('opens a dialog offering to change the target date or the pace; cancel closes it', async () => {
    const { bridge } = await renderDetail()
    const dialog = openDialog()

    expect(within(dialog).getByRole('radio', { name: 'שינוי תאריך יעד' })).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: 'שינוי קצב' })).toBeChecked()

    fireEvent.click(within(dialog).getByRole('button', { name: 'ביטול' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(bridge.updateProgram).not.toHaveBeenCalled()
  })

  it('a new pace reschedules the program and shows the new dates', async () => {
    const { bridge } = await renderDetail({ progressAfterRecalc: [progressRow(3, '2030-01-05')] })
    const dialog = openDialog()

    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'דפים ביום' }), { target: { value: '0.5' } })
    expect(within(dialog).getByText(/תאריך סיום משוער/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'עדכון מסלול' }))

    await waitFor(() =>
      expect(bridge.updateProgram).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ paceMode: 'daily_pace', pagesPerDay: 0.5, programName: 'שבת בשנה' }),
      ),
    )
    expect(
      await screen.findByRole('checkbox', { name: `יום ${formatIsoDate('2030-01-05', 'gregorian')}` }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a new target date switches the program to target-date mode', async () => {
    const { bridge } = await renderDetail()
    const dialog = openDialog()

    fireEvent.click(within(dialog).getByRole('radio', { name: 'שינוי תאריך יעד' }))
    fireEvent.change(within(dialog).getByLabelText('תאריך יעד חדש'), { target: { value: '2030-01-01' } })
    expect(within(dialog).getByText(/קצב נדרש/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'עדכון מסלול' }))

    await waitFor(() =>
      expect(bridge.updateProgram).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ paceMode: 'target_date', targetEndDate: '2030-01-01' }),
      ),
    )
  })

  it('rejects a target date in the past before saving', async () => {
    await renderDetail()
    const dialog = openDialog()

    fireEvent.click(within(dialog).getByRole('radio', { name: 'שינוי תאריך יעד' }))
    fireEvent.change(within(dialog).getByLabelText('תאריך יעד חדש'), { target: { value: '2020-01-01' } })

    expect(within(dialog).getByText('תאריך היעד לא יכול להיות לפני היום')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'עדכון מסלול' })).toBeDisabled()
  })

  it('keeps the dialog open with an error when saving fails', async () => {
    const { bridge } = await renderDetail()
    bridge.updateProgram.mockRejectedValueOnce(new Error('boom'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dialog = openDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: 'עדכון מסלול' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('חישוב המסלול מחדש נכשל')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    consoleError.mockRestore()
  })

  it('switches day labels to Hebrew dates', async () => {
    await renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'עברי' }))

    expect(
      await screen.findByRole('checkbox', { name: `יום ${formatIsoDate('2026-11-08', 'hebrew')}` }),
    ).toBeInTheDocument()
  })
})

describe('calendar view', () => {
  const ROWS = [
    progressRow(2, '2026-11-03'),
    progressRow(3, '2026-11-08'),
    progressRow(4, '2026-11-20'),
    progressRow(5, '2026-12-02'),
  ]
  const cellOn = (iso: string) => screen.getByRole('gridcell', { name: new RegExp(`^${formatIsoDate(iso, 'gregorian')}`) })

  async function openCalendar() {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 8, 12))
    const result = await renderDetail({ program: { ...PROGRAM, restWeekdays: [6] }, progress: ROWS })
    fireEvent.click(screen.getByRole('button', { name: 'לוח שנה' }))
    return result
  }

  afterEach(() => vi.useRealTimers())

  it('switches from the tree to a month grid', async () => {
    await openCalendar()
    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'נובמבר 2026' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: "דף ג'" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'עץ' }))
    expect(screen.getByRole('checkbox', { name: "דף ג'" })).toBeInTheDocument()
  })

  it('shows page status in the cell label', async () => {
    await openCalendar()
    expect(cellOn('2026-11-03')).toHaveAccessibleName(/דף ב' באיחור/)
    expect(cellOn('2026-11-08')).toHaveAccessibleName(/דף ג' להיום/)
    expect(cellOn('2026-11-20')).toHaveAccessibleName(/דף ד' מתוכנן/)
  })

  it('marks rest days', async () => {
    await openCalendar()
    expect(cellOn('2026-11-07')).toHaveAccessibleName(/מנוחה/)
    expect(cellOn('2026-11-09')).not.toHaveAccessibleName(/מנוחה/)
  })

  it('moves between months', async () => {
    await openCalendar()
    fireEvent.click(screen.getByRole('button', { name: 'חודש הבא' }))
    expect(screen.getByRole('heading', { name: 'דצמבר 2026' })).toBeInTheDocument()
    expect(cellOn('2026-12-02')).toHaveAccessibleName(/דף ה'/)
    expect(cellOn('2026-12-05')).toHaveAccessibleName(/חנוכה/)
    fireEvent.click(screen.getByRole('button', { name: 'חודש קודם' }))
    fireEvent.click(screen.getByRole('button', { name: 'חודש קודם' }))
    expect(screen.getByRole('heading', { name: 'אוקטובר 2026' })).toBeInTheDocument()
  })

  it('follows the Hebrew calendar setting', async () => {
    await openCalendar()
    fireEvent.click(screen.getByRole('button', { name: 'עברי' }))
    expect(screen.getByRole('heading', { name: 'חשון תשפ״ז' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'חודש הבא' }))
    expect(screen.getByRole('heading', { name: 'כסלו תשפ״ז' })).toBeInTheDocument()
  })

  it('reflects progress marked in the tree', async () => {
    await openCalendar()
    fireEvent.click(screen.getByRole('button', { name: 'עץ' }))
    fireEvent.click(screen.getByRole('checkbox', { name: "דף ג'" }))
    fireEvent.click(screen.getByRole('button', { name: 'לוח שנה' }))
    expect(cellOn('2026-11-08')).toHaveAccessibleName(/דף ג' הושלם/)
  })
})

describe('deleting', () => {
  it('asks for confirmation, and cancelling keeps the program', async () => {
    const { bridge, onDeleted } = await renderDetail()

    fireEvent.click(screen.getByRole('button', { name: 'מחיקה' }))
    expect(screen.getByRole('heading', { name: 'למחוק את התוכנית?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }))

    expect(bridge.deleteProgram).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('confirming deletes the program and reports it', async () => {
    const { bridge, onDeleted } = await renderDetail()

    fireEvent.click(screen.getByRole('button', { name: 'מחיקה' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'מחיקה' }))

    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
    expect(bridge.deleteProgram).toHaveBeenCalledWith(7)
  })
})

describe('completed program', () => {
  const COMPLETED = { ...PROGRAM, status: 'completed' as const, completedAt: '2026-11-05' }
  const doneRows = TWO_PAGES.map((row) => progressRow(row.pageNumber, row.scheduledDate, ALL_DONE))

  it('shows the completion date and hides edit and recalculate', async () => {
    await renderDetail({ program: COMPLETED, progress: doneRows })

    expect(await screen.findByText(`הושלמה ב-${formatIsoDate('2026-11-05', 'gregorian')}`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'חישוב מסלול מחדש' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'עריכת תוכנית' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'מחיקה' })).toBeInTheDocument()
  })

  it('locks the checkboxes', async () => {
    const { bridge } = await renderDetail({ program: COMPLETED, progress: doneRows })
    await screen.findByText(/הושלמה ב-/)

    const day = screen.getByRole('checkbox', { name: dayName })
    expect(day).toBeDisabled()
    fireEvent.click(day)
    expect(bridge.setUnitsCompleted).not.toHaveBeenCalled()
  })

  it('switches to the locked view once the last unit is marked', async () => {
    const { bridge } = await renderDetail({ progress: TWO_PAGES })
    expect(screen.queryByText(/הושלמה ב-/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: dayName }))

    expect(await screen.findByText(/הושלמה ב-/)).toBeInTheDocument()
    expect(bridge.getProgram).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('checkbox', { name: dayName })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'עריכת תוכנית' })).not.toBeInTheDocument()
  })

  it('does not reload the program while marking short of 100%', async () => {
    const { bridge } = await renderDetail({ progress: TWO_PAGES })

    fireEvent.click(screen.getByRole('checkbox', { name: "דף ב'" }))
    await screen.findByRole('img', { name: 'הושלמו 50%' })

    expect(bridge.getProgram).toHaveBeenCalledTimes(1)
  })
})

describe('pace chart', () => {
  it('shows the chart with a summary and updates after a page is fully checked off', async () => {
    await renderDetail()
    expect(screen.getByRole('img', { name: /גרף קצב לימוד/ })).toBeInTheDocument()
    expect(screen.getByText(/^נלמדו 0 מתוך \d+ דפים מתוכננים עד היום$/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /דף ג/ }))
    expect(await screen.findByText(/^נלמדו 1 מתוך \d+ דפים מתוכננים עד היום$/)).toBeInTheDocument()
  })

  it('is hidden for a program with no pages', async () => {
    await renderDetail({ progress: [] })
    expect(screen.queryByRole('img', { name: /גרף קצב לימוד/ })).not.toBeInTheDocument()
  })
})
