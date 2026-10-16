import { expect, test } from 'vitest'
import { SEED_COLUMNS } from '../src/domain/columns'
import { retypePatch, templateFor } from '../src/domain/templates'
import { programTotals } from '../src/domain/totals'
import type { Column } from '../src/domain/types'

const histrap5 = SEED_COLUMNS.find((c) => c.id === 'histrap-hp-5-ml') as Column

test('IMAC on HisTrap HP 5 ml: volume, time, fractions and buffer use per line', () => {
  const t = programTotals(templateFor('imac', histrap5), histrap5)
  expect(t).toMatchObject({ volume: 250, time: 70, fractions: 50, fractionMl: 100, fractionSizes: [2] })
  // A1: 25 + 50 × 0.95 + 100 × (1 − 0.525) + 25; A8: sample 25; B: 50 × 0.05 + 100 × 0.525 + 25
  expect(t.buffers).toEqual([
    { line: 'A1', ml: 145 },
    { line: 'A8', ml: 25 },
    { line: 'B', ml: 80 },
  ])
})

test('a pump wash uses each of its lines; a partial last fraction counts', () => {
  const [eq] = templateFor('general', histrap5)
  const wash = { ...eq, ...retypePatch(eq, 'pumpwash'), lines: ['B' as const, 'A2' as const] }
  const t = programTotals([wash, { ...eq, len: 3, unit: 'ml' as const, frac: 2 }], histrap5)
  expect(t.buffers).toEqual([
    { line: 'A1', ml: 3 },
    { line: 'A2', ml: 40 },
    { line: 'B', ml: 40 },
  ])
  expect(t.fractions).toBe(2)
})

test('no fractions', () => {
  expect(programTotals(templateFor('equil', histrap5), histrap5)).toMatchObject({ fractions: 0, fractionMl: 0, fractionSizes: [] })
})
