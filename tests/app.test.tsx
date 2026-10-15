import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test } from 'vitest'
import App from '../src/App'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

test('shows the Cytiva disclaimer', () => {
  render(<App />)
  expect(screen.getByText(/Not affiliated with or endorsed by Cytiva/)).toBeTruthy()
})

test('walks through the wizard', async () => {
  const user = userEvent.setup()
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Choose an application' })).toBeTruthy()

  await user.click(screen.getByRole('button', { name: /Size exclusion/ }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByRole('heading', { name: 'Select a column' })).toBeTruthy()
  await user.click(screen.getByRole('radio', { name: /HiLoad 16\/600 Superdex 75 pg/ }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))

  expect(screen.getByRole('heading', { name: 'Program' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Isocratic elution' })).toBeTruthy()

  await user.click(screen.getByRole('button', { name: 'Review export' }))
  const rows = within(screen.getByRole('table', { name: 'Breakpoints' })).getAllByRole('row')
  expect(rows).toHaveLength(1 + 6)
})

test('flow above the column max shows the warning', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /Program/ }))
  const flow = screen.getByLabelText('Flow (ml/min)')
  await user.clear(flow)
  await user.type(flow, '25')
  expect(screen.getByText('Above the column maximum of 20 ml/min.')).toBeTruthy()
  expect(flow.getAttribute('aria-invalid')).toBe('true')
})

test('keyboard moves a handle', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /Program/ }))
  const handle = screen.getByRole('button', { name: /End of phase 1, Equilibration: 5 CV/ })
  handle.focus()
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('button', { name: /End of phase 1, Equilibration: 5.1 CV/ })).toBeTruthy()
})

test('save adds the method to the library', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByRole('button', { name: 'Methods (1) ▾' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Methods (1) ▾' }))
  expect(within(screen.getByRole('dialog', { name: 'Saved methods' })).getByText('IMAC_HisTrapHP5ml')).toBeTruthy()
})
