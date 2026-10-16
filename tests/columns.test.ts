import { describe, expect, test } from 'vitest'
import { columnsFor, columnsOfType, defaultColumnType, filterColumns, RECENT_LIMIT, searchColumns, SEED_COLUMNS, splitRecent, touchRecent, vendorCounts } from '../src/domain/columns'
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
    const apps: ApplicationId[] = ['general', 'preloaded', 'imac', 'affinity', 'iex', 'hic', 'sec', 'equil']
    for (const app of apps) expect(columnsFor(app, SEED_COLUMNS).length, app).toBeGreaterThan(0)
    expect(columnsFor('equil', SEED_COLUMNS)).toHaveLength(SEED_COLUMNS.length)
    expect(columnsFor('general', SEED_COLUMNS)).toHaveLength(SEED_COLUMNS.length)
    expect(columnsFor('preloaded', SEED_COLUMNS)).toHaveLength(SEED_COLUMNS.length)
    expect(defaultColumnType('preloaded')).toBe('all')
  })

  test('expands sizes and product groups', () => {
    expect(byName('HisTrap HP 1 ml')).toMatchObject({ cv: 1, flow: 4, rec: 1, p: 0.5, apps: ['imac'] })
    expect(byName('HisTrap HP 5 ml')).toMatchObject({ cv: 5, flow: 20, rec: 5 })
    expect(byName('HiTrap CM FF 5 ml')).toMatchObject({ cv: 5, flow: 20 })
    expect(byName('HiLoad 16/600 Superdex 200 pg')).toMatchObject({ cv: 120, flow: 1.6, rec: 1, p: 0.3 })
    expect(byName('Bio-Scale Mini Bio-Gel P-6 Desalting 50 ml')).toMatchObject({ flow: null, p: 0.28 })
    expect(byName('Strep-Tactin XT 4Flow Cartridge 5 ml')).toMatchObject({ flow: 3, rec: 1 })
  })

  test('unknown max flow is kept as null', () => {
    expect(byName('EconoFit Nuvia IMAC 5 ml').flow).toBeNull()
  })

  test('custom columns appear for every application', () => {
    const custom: Column = { id: 'x', name: 'X', manufacturer: '', cv: 1, flow: 1, rec: 0.5, p: 0.5, apps: [], custom: true }
    expect(columnsFor('sec', [...SEED_COLUMNS, custom])).toContain(custom)
  })
})

test('recommended flows from the source: vendor values, the lower end of a range, estimates marked', () => {
  expect(byName('GSTrap HP 5 ml')).toMatchObject({ rec: 2.5 })
  expect(byName('GSTrap HP 5 ml').recEstimated).toBeUndefined()
  expect(byName('Superdex 75 10/300 GL')).toMatchObject({ rec: 0.5 })
  expect(byName('Superdex 200 Increase 10/300 GL')).toMatchObject({ rec: 0.25, recEstimated: true })
  expect(byName('Bio-Scale Mini Bio-Gel P-6 Desalting 50 ml')).toMatchObject({ rec: 5, recEstimated: true })
  expect(SEED_COLUMNS.filter((c) => c.flow === null).every((c) => c.recEstimated)).toBe(true)
})

describe('column search', () => {
  const names = (q: string) => searchColumns(SEED_COLUMNS, q).map((c) => c.name)

  test('empty query lists everything', () => {
    expect(searchColumns(SEED_COLUMNS, '  ')).toHaveLength(SEED_COLUMNS.length)
  })

  test('every word must match, in any order and case', () => {
    expect(names('superdex 200')).toEqual(['HiLoad 16/600 Superdex 200 pg', 'HiLoad 26/600 Superdex 200 pg', 'Superdex 200 10/300 GL', 'Superdex 200 Increase 10/300 GL'])
    expect(names('IMAC bio-rad 5')).toEqual(['EconoFit Profinity IMAC 5 ml', 'EconoFit Nuvia IMAC 5 ml', 'Bio-Scale Mini Profinity IMAC 5 ml', 'Bio-Scale Mini Nuvia IMAC 5 ml'])
  })

  test('matches manufacturer and size', () => {
    expect(names('qiagen')).toEqual(['Ni-NTA Superflow Cartridge 1 ml', 'Ni-NTA Superflow Cartridge 5 ml'])
    expect(names('120 ml')).toEqual(['HiLoad 16/600 Superdex 75 pg', 'HiLoad 16/600 Superdex 200 pg'])
  })

  test('no match gives an empty list', () => {
    expect(names('zzz')).toEqual([])
  })
})

describe('column filters', () => {
  const custom: Column = { id: 'my', name: 'My gravity column', manufacturer: '', cv: 2, flow: 4, rec: 2, p: 0.3, apps: [], custom: true }
  const all = [...SEED_COLUMNS, custom]

  test('type preset follows the application', () => {
    expect(defaultColumnType('imac')).toBe('imac')
    expect(defaultColumnType('sec')).toBe('sec')
    expect(defaultColumnType('general')).toBe('all')
    expect(defaultColumnType('equil')).toBe('all')
  })

  test('type, vendor and search combine; custom columns are in every type', () => {
    expect(filterColumns(all, { type: 'all', vendor: null, query: '' })).toHaveLength(102)
    expect(filterColumns(all, { type: 'imac', vendor: null, query: '' })).toHaveLength(23)
    expect(filterColumns(all, { type: 'imac', vendor: 'Bio-Rad', query: '' }).map((c) => c.name)).toEqual([
      'EconoFit Profinity IMAC 1 ml', 'EconoFit Profinity IMAC 5 ml', 'EconoFit Nuvia IMAC 1 ml', 'EconoFit Nuvia IMAC 5 ml',
      'Bio-Scale Mini Profinity IMAC 1 ml', 'Bio-Scale Mini Profinity IMAC 5 ml', 'Bio-Scale Mini Nuvia IMAC 1 ml', 'Bio-Scale Mini Nuvia IMAC 5 ml',
    ])
    expect(filterColumns(all, { type: 'imac', vendor: 'Bio-Rad', query: 'econofit 5' })).toHaveLength(2)
    expect(filterColumns(all, { type: 'hic', vendor: 'Custom', query: '' })).toEqual([custom])
  })

  test('vendor counts: most columns first, custom last', () => {
    expect(vendorCounts(columnsOfType(all, 'imac'))).toEqual([
      { vendor: 'Bio-Rad', count: 8 },
      { vendor: 'Cytiva', count: 8 },
      { vendor: 'Qiagen', count: 2 },
      { vendor: 'Takara Bio', count: 2 },
      { vendor: 'Thermo Fisher', count: 2 },
      { vendor: 'Custom', count: 1 },
    ])
  })
})

describe('recent columns', () => {
  const custom: Column = { id: 'my', name: 'My gravity column', manufacturer: '', cv: 2, flow: 4, rec: 2, p: 0.3, apps: [], custom: true }

  test('touch moves to the front and keeps the newest few', () => {
    expect(touchRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
    expect(touchRecent(['a', 'b', 'c', 'd', 'e'], 'x')).toEqual(['x', 'a', 'b', 'c', 'd'])
    expect(RECENT_LIMIT).toBe(5)
  })

  test('recent section: used columns newest first, then custom; no duplicates in the rest', () => {
    const cols = [...SEED_COLUMNS, custom]
    const { recent, rest } = splitRecent(cols, ['superdex-75-10-300-gl', 'histrap-hp-1-ml', 'gone'])
    expect(recent.map((c) => c.id)).toEqual(['superdex-75-10-300-gl', 'histrap-hp-1-ml', 'my'])
    expect(rest).toHaveLength(SEED_COLUMNS.length - 2)
    expect(rest.some((c) => recent.includes(c))).toBe(false)
    expect(rest[0].id).toBe('histrap-hp-5-ml')
  })

  test('filtered-out recent columns stay out', () => {
    const imac = columnsOfType(SEED_COLUMNS, 'imac')
    expect(splitRecent(imac, ['superdex-75-10-300-gl', 'histrap-hp-1-ml']).recent.map((c) => c.id)).toEqual(['histrap-hp-1-ml'])
  })
})
