import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProgramSummary } from '../../../main/database'
import { mockBridge, type MockBridgeOptions } from '../../../test/mockBridge'
import { CalendarProvider } from '../../context/CalendarContext'
import AppHeader from '../layout/AppHeader'
import { formatIsoDate } from '../../lib/hebrewDate'
import Dashboard from './Dashboard'

afterEach(() => {
  delete (window as Partial<Window>).talmudonBridge
})

function summary(overrides: Partial<ProgramSummary> = {}): ProgramSummary {
  return {
    id: 1,
    programName: 'ברכות בשנה',
    status: 'active',
    percentComplete: 50,
    lag: 0,
    lead: 0,
    estimatedEndDate: '2026-12-25',
    ...overrides,
  }
}

async function renderDashboard(options: MockBridgeOptions = {}) {
  const bridge = mockBridge(options)
  const handlers = { onCreate: vi.fn(), onEdit: vi.fn(), onOpen: vi.fn() }
  render(
    <CalendarProvider>
      <AppHeader onHome={vi.fn()}>
        <Dashboard {...handlers} />
      </AppHeader>
    </CalendarProvider>,
  )
  await waitFor(() => expect(bridge.listProgramSummaries).toHaveBeenCalled())
  return { bridge, ...handlers }
}

describe('top bar', () => {
  it('shows the heading, the create button and the calendar toggle', async () => {
    const { onCreate } = await renderDashboard()

    expect(screen.getByRole('heading', { name: 'תוכניות הלימוד שלי' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'לועזי' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'עברי' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'צור תוכנית חדשה' }))
    expect(onCreate).toHaveBeenCalled()
  })
})

describe('empty state', () => {
  it('says there are no programs yet', async () => {
    await renderDashboard({ summaries: [] })
    expect(await screen.findByText('אין עדיין תוכניות')).toBeInTheDocument()
  })
})

describe('program card', () => {
  it('shows the name and a pie labelled with the completion percent', async () => {
    await renderDashboard({ summaries: [summary()] })

    expect(await screen.findByText('ברכות בשנה')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'הושלמו 50%' })).toBeInTheDocument()
  })

  it('describes lag, lead and on-pace', async () => {
    await renderDashboard({
      summaries: [
        summary({ id: 1, programName: 'א', lag: 2 }),
        summary({ id: 2, programName: 'ב', lead: 1 }),
        summary({ id: 3, programName: 'ג' }),
      ],
    })

    expect(await screen.findByText('בפיגור של 2 דפים')).toBeInTheDocument()
    expect(screen.getByText('מקדים ב-1 דפים')).toBeInTheDocument()
    expect(screen.getByText('בקצב')).toBeInTheDocument()
  })

  it('formats the estimated end date and switches calendar immediately on toggle', async () => {
    await renderDashboard({ summaries: [summary()] })

    expect(await screen.findByText(formatIsoDate('2026-12-25', 'gregorian'))).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'עברי' }))
    expect(screen.getByText(formatIsoDate('2026-12-25', 'hebrew'))).toBeInTheDocument()
  })

  it('open and edit buttons report the program id', async () => {
    const { onOpen, onEdit } = await renderDashboard({ summaries: [summary({ id: 7 })] })

    fireEvent.click(await screen.findByRole('button', { name: 'כניסה לתוכנית' }))
    fireEvent.click(screen.getByRole('button', { name: 'עריכה' }))

    expect(onOpen).toHaveBeenCalledWith(7)
    expect(onEdit).toHaveBeenCalledWith(7)
  })
})

describe('pause and resume', () => {
  it('pausing reloads the list, shows the badge, dims the card and offers resume', async () => {
    const { bridge } = await renderDashboard({ summaries: [summary({ id: 3 })] })

    fireEvent.click(await screen.findByRole('button', { name: 'השהה' }))

    expect(bridge.setProgramStatus).toHaveBeenCalledWith(3, 'paused')
    expect(await screen.findByText('תוכנית מושהית')).toBeInTheDocument()
    const card = screen.getByRole('article')
    expect(card).toHaveAttribute('data-paused', 'true')
    expect(within(card).getByRole('button', { name: 'הפעל מחדש' })).toBeInTheDocument()
  })

  it('resuming sets the program active again', async () => {
    const { bridge } = await renderDashboard({ summaries: [summary({ id: 3, status: 'paused' })] })

    fireEvent.click(await screen.findByRole('button', { name: 'הפעל מחדש' }))

    expect(bridge.setProgramStatus).toHaveBeenCalledWith(3, 'active')
    await waitFor(() => expect(screen.queryByText('תוכנית מושהית')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'השהה' })).toBeInTheDocument()
  })
})
