import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mockBridge } from '../test/mockBridge'
import App from './App'
import { CalendarProvider } from './context/CalendarContext'

afterEach(() => {
  delete (window as Partial<Window>).talmudonBridge
})

function renderApp() {
  mockBridge({ studyStats: { currentStreak: 2, pagesLast7Days: 3, pagesLast30Days: 4 } })
  render(
    <CalendarProvider>
      <App />
    </CalendarProvider>,
  )
}

describe('statistics navigation', () => {
  it('opens the statistics screen from the top bar and the logo returns home', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'סטטיסטיקה' }))
    expect(await screen.findByRole('heading', { name: 'סטטיסטיקה' })).toBeInTheDocument()
    expect(screen.getByText('2 ימים')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /מסך הבית/ }))
    expect(screen.queryByRole('heading', { name: 'סטטיסטיקה' })).not.toBeInTheDocument()
  })
})
