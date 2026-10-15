import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import App from '../src/App'

test('shows the Cytiva disclaimer', () => {
  render(<App />)
  expect(screen.getByText(/Not affiliated with or endorsed by Cytiva/)).toBeTruthy()
})
