import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TodayProgramPlan } from '../../../main/database'
import { UNIT_KEYS } from '../../../main/progress'
import { mockBridge, progressRow } from '../../../test/mockBridge'
import { CalendarProvider } from '../../context/CalendarContext'
import AppHeader from '../layout/AppHeader'
import TodayScreen from './TodayScreen'

afterEach(() => {
  delete (window as Partial<Window>).talmudonBridge
})

function plan(overrides: Partial<TodayProgramPlan> = {}): TodayProgramPlan {
  return {
    programId: 7,
    programName: 'ברכות בשנה',
    tractateName: 'ברכות',
    todayPages: [progressRow(4, '2026-11-03')],
    overduePages: [],
    ...overrides,
  }
}

async function renderToday(todayPlan: TodayProgramPlan[]) {
  const bridge = mockBridge({ todayPlan })
  const handlers = { onCreate: vi.fn(), onOpen: vi.fn() }
  render(
    <CalendarProvider>
      <AppHeader onHome={vi.fn()}>
        <TodayScreen {...handlers} />
      </AppHeader>
    </CalendarProvider>,
  )
  await waitFor(() => expect(bridge.getTodayPlan).toHaveBeenCalled())
  return { bridge, ...handlers }
}

const ALL_UNITS = UNIT_KEYS.map((unit) => ({ pageNumber: 4, unit }))

describe('TodayScreen', () => {
  it('shows the heading and a card per program with its name and tractate', async () => {
    await renderToday([plan(), plan({ programId: 8, programName: 'שבת בשנה', tractateName: 'שבת' })])

    expect(screen.getByRole('heading', { name: 'מה לומדים היום' })).toBeInTheDocument()
    expect(await screen.findByText('ברכות בשנה')).toBeInTheDocument()
    expect(screen.getByText('שבת בשנה')).toBeInTheDocument()
    expect(screen.getByText('מסכת ברכות')).toBeInTheDocument()
    expect(screen.getAllByText("דף ד'")).toHaveLength(2)
  })

  it('marks the whole page as learned and unmarks it on a second click', async () => {
    const { bridge } = await renderToday([plan()])
    const button = await screen.findByRole('button', { name: "למדתי דף ד'" })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(button)
    expect(bridge.setUnitsCompleted).toHaveBeenLastCalledWith(7, ALL_UNITS, true)
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))

    fireEvent.click(button)
    expect(bridge.setUnitsCompleted).toHaveBeenLastCalledWith(7, ALL_UNITS, false)
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'false'))
  })

  it('lets a single unit be ticked, leaving the page partially done', async () => {
    const { bridge } = await renderToday([plan()])

    fireEvent.click(await screen.findByRole('button', { name: "פתח דף ד'" }))
    fireEvent.click(screen.getByRole('checkbox', { name: "דף ד' עמוד א' רש\"י" }))

    expect(bridge.setUnitsCompleted).toHaveBeenLastCalledWith(
      7,
      [{ pageNumber: 4, unit: 'side_a_rashi' }],
      true,
    )
    expect(screen.getByRole('button', { name: "למדתי דף ד'" })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows only the 3 oldest overdue pages plus a count of the rest', async () => {
    const overduePages = [2, 3, 5, 6, 7].map((n) => progressRow(n, '2026-11-01'))
    await renderToday([plan({ todayPages: [], overduePages })])

    await screen.findByText("דף ב'")
    expect(screen.getByText("דף ג'")).toBeInTheDocument()
    expect(screen.getByText("דף ה'")).toBeInTheDocument()
    expect(screen.queryByText("דף ו'")).not.toBeInTheDocument()
    expect(screen.getByText('ועוד 2 דפים בפיגור')).toBeInTheDocument()
  })

  it('marks an overdue page as learned like a page of today', async () => {
    const { bridge } = await renderToday([plan({ todayPages: [], overduePages: [progressRow(2, '2026-11-01')] })])

    const button = await screen.findByRole('button', { name: "למדתי דף ב'" })
    fireEvent.click(button)

    expect(bridge.setUnitsCompleted).toHaveBeenLastCalledWith(
      7,
      UNIT_KEYS.map((unit) => ({ pageNumber: 2, unit })),
      true,
    )
    await waitFor(() => expect(button).toHaveAttribute('aria-pressed', 'true'))
  })

  it('says there is nothing to study when a program has no pages today or overdue', async () => {
    await renderToday([plan({ todayPages: [] })])
    expect(await screen.findByText('אין לימוד היום')).toBeInTheDocument()
  })

  it('offers to create a program when none is active', async () => {
    const { onCreate } = await renderToday([])

    expect(await screen.findByText('אין תוכניות פעילות')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית חדשה' }))
    expect(onCreate).toHaveBeenCalled()
  })

  it('opens the program from its card', async () => {
    const { onOpen } = await renderToday([plan()])

    const card = (await screen.findByText('ברכות בשנה')).closest('section') as HTMLElement
    fireEvent.click(within(card).getByRole('button', { name: 'כניסה לתוכנית' }))
    expect(onOpen).toHaveBeenCalledWith(7)
  })
})
