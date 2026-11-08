import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { mockBridge } from '../../../test/mockBridge'
import StatsScreen from './StatsScreen'

afterEach(() => {
  delete (window as Partial<Window>).talmudonBridge
})

describe('StatsScreen', () => {
  it('shows the values from getStudyStats', async () => {
    mockBridge({ studyStats: { currentStreak: 3, pagesLast7Days: 5, pagesLast30Days: 12 } })
    render(<StatsScreen />)
    expect(await screen.findByText('3 ימים')).toBeInTheDocument()
    expect(screen.getByText('דפים ב-7 הימים האחרונים').nextSibling).toHaveTextContent('5')
    expect(screen.getByText('דפים ב-30 הימים האחרונים').nextSibling).toHaveTextContent('12')
  })

  it('uses the singular for one day', async () => {
    mockBridge({ studyStats: { currentStreak: 1, pagesLast7Days: 1, pagesLast30Days: 1 } })
    render(<StatsScreen />)
    expect(await screen.findByText('יום אחד')).toBeInTheDocument()
  })

  it('shows an empty state when everything is zero', async () => {
    mockBridge()
    render(<StatsScreen />)
    expect(await screen.findByText('עוד לא הושלמו דפים')).toBeInTheDocument()
  })
})
