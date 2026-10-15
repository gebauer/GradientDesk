import { describe, expect, test } from 'vitest'
import { columnsFor, defaultRecFlow, SEED_COLUMNS } from '../src/domain/columns'
import type { ApplicationId, Column } from '../src/domain/types'

const byName = (name: string): Column => {
  const c = SEED_COLUMNS.find((x) => x.name === name)
  if (!c) throw new Error(`missing column ${name}`)
  return c
}

describe('seed column library', () => {
  test('ids are unique', () => {
    const ids = SEED_COLUMNS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('values are positive and rec flow stays within max flow', () => {
    for (const c of SEED_COLUMNS) {
      expect(c.cv, c.name).toBeGreaterThan(0)
      expect(c.p, c.name).toBeGreaterThan(0)
      expect(c.rec, c.name).toBeGreaterThan(0)
      if (c.flow !== null) expect(c.rec, c.name).toBeLessThanOrEqual(c.flow)
      expect(c.apps.length, c.name).toBeGreaterThan(0)
    }
  })

  test('every application lists columns', () => {
    const apps: ApplicationId[] = ['imac', 'affinity', 'iex', 'hic', 'sec', 'equil']
    for (const app of apps) expect(columnsFor(app, SEED_COLUMNS).length, app).toBeGreaterThan(0)
    expect(columnsFor('equil', SEED_COLUMNS)).toHaveLength(SEED_COLUMNS.length)
  })

  test('expands sizes and product groups', () => {
    expect(byName('HisTrap HP 1 ml')).toMatchObject({ cv: 1, flow: 4, rec: 1, p: 0.5, apps: ['imac'] })
    expect(byName('HisTrap HP 5 ml')).toMatchObject({ cv: 5, flow: 20, rec: 5 })
    expect(byName('HiTrap CM FF 5 ml')).toMatchObject({ cv: 5, flow: 20 })
    expect(byName('HiLoad 16/600 Superdex 200 pg')).toMatchObject({ cv: 120, flow: 1.6, rec: 0.8, p: 0.3 })
    expect(byName('Bio-Scale Mini Bio-Gel P-6 Desalting 50 ml')).toMatchObject({ flow: null, p: 0.28 })
    expect(byName('Strep-Tactin XT 4Flow Cartridge 5 ml')).toMatchObject({ flow: 3, rec: 3 })
  })

  test('unknown max flow is kept as null', () => {
    expect(byName('EconoFit Nuvia IMAC 5 ml').flow).toBeNull()
  })

  test('custom columns appear for every application', () => {
    const custom: Column = { id: 'x', name: 'X', manufacturer: '', cv: 1, flow: 1, rec: 0.5, p: 0.5, apps: [], custom: true }
    expect(columnsFor('sec', [...SEED_COLUMNS, custom])).toContain(custom)
  })
})

test('defaultRecFlow', () => {
  expect(defaultRecFlow(1, 4)).toBe(1)
  expect(defaultRecFlow(5, 3)).toBe(3)
  expect(defaultRecFlow(5, null)).toBe(5)
  expect(defaultRecFlow(20, 10)).toBe(5)
  expect(defaultRecFlow(50, null)).toBe(5)
})
