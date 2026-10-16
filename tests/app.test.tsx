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
  expect(rows).toHaveLength(1 + 4)
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
  expect(within(screen.getByRole('dialog', { name: 'Saved methods' })).getByText('General_HisTrapHP5ml')).toBeTruthy()
})

test('right-click on a phase offers delete', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /Program/ }))
  const row = screen.getByRole('button', { name: /^2\s*Sample load/ })
  await user.pointer({ keys: '[MouseRight]', target: row })
  const menu = screen.getByRole('menu', { name: 'Phase 2, Sample load' })
  await user.click(within(menu).getByRole('menuitem', { name: 'Delete phase' }))
  expect(screen.queryByRole('menu')).toBeNull()
  expect(screen.queryByRole('button', { name: /Sample load/ })).toBeNull()
  expect(screen.getByRole('button', { name: /^2\s*Wash/ })).toBeTruthy()
})

test('column search filters the table', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getAllByRole('radio')).toHaveLength(101)
  await user.type(screen.getByRole('searchbox', { name: 'Search columns' }), 'superdex 75')
  expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
    expect.stringContaining('HiLoad 16/600 Superdex 75 pg'),
    expect.stringContaining('HiLoad 26/600 Superdex 75 pg'),
    expect.stringContaining('Superdex 75 10/300 GL'),
  ])
  expect(screen.getByText('3 of 101 columns')).toBeTruthy()
})

test('column type is preset from the application and vendor pills filter', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /Affinity · IMAC/ }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  const type = screen.getByRole('combobox', { name: 'Column type' }) as HTMLSelectElement
  expect(type.value).toBe('imac')
  expect(screen.getAllByRole('radio')).toHaveLength(22)

  const vendors = within(screen.getByRole('group', { name: 'Vendor' }))
  await user.click(vendors.getByRole('button', { name: /Bio-Rad/ }))
  expect(screen.getAllByRole('radio')).toHaveLength(8)
  expect(screen.getByText('8 of 101 columns')).toBeTruthy()

  await user.selectOptions(type, 'all')
  expect(screen.getAllByRole('radio').length).toBeGreaterThan(8)
  await user.click(vendors.getByRole('button', { name: 'All vendors' }))
  expect(screen.getAllByRole('radio')).toHaveLength(101)
})

test('recently used columns appear in a Recent section at the top', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.queryByText('Recent')).toBeNull()
  await user.type(screen.getByRole('searchbox', { name: 'Search columns' }), 'superdex 200 increase')
  await user.click(screen.getByRole('radio', { name: /Superdex 200 Increase/ }))
  await user.clear(screen.getByRole('searchbox', { name: 'Search columns' }))
  // The clicked row stays in place until the step is opened again.
  expect(screen.queryByText('Recent')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Back' }))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByText('Recent')).toBeTruthy()
  expect(screen.getByText('All columns')).toBeTruthy()
  const radios = screen.getAllByRole('radio')
  expect(radios[0].textContent).toContain('Superdex 200 Increase 10/300 GL')
  expect(radios).toHaveLength(101)
})

test('a pump wash phase picks its lines with checkboxes', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: /Program/ }))
  await user.selectOptions(screen.getByLabelText('Phase type'), 'Pump wash')
  const lines = within(screen.getByRole('group', { name: /Lines to wash/ }))
  expect(lines.getByLabelText('B')).toHaveProperty('checked', true)
  expect(lines.getByLabelText('A1')).toHaveProperty('checked', true)
  await user.click(lines.getByLabelText('A8'))
  expect(screen.getByText('3 × 40 ml · B, A8, A1')).toBeTruthy()
  expect((screen.getByLabelText('Volume per line (ml)') as HTMLInputElement).value).toBe('40')
  expect(screen.queryByLabelText('Start %B')).toBeNull()
})
