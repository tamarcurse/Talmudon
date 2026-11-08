import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './renderer/App'
import { CalendarProvider } from './renderer/context/CalendarContext'

describe('App', () => {
  it('renders the Talmudon desktop shell', () => {
    render(
      <CalendarProvider>
        <App />
      </CalendarProvider>,
    )

    expect(
      screen.getByRole('heading', { name: /talmudon/i }),
    ).toBeInTheDocument()
  })
})
