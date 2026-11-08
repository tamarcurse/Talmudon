import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './renderer/App'

describe('App', () => {
  it('renders the Talmudon desktop shell', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: /talmudon/i }),
    ).toBeInTheDocument()
  })
})
