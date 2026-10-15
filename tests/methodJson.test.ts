import { describe, expect, test } from 'vitest'
import { columnsFor, SEED_COLUMNS } from '../src/domain/columns'
import { fromJson, MethodImportError, resolveColumn, toJson, toMethodFile } from '../src/domain/methodJson'
import { APPLICATIONS, templateFor } from '../src/domain/templates'
import type { Column, Method } from '../src/domain/types'

const histrap5 = SEED_COLUMNS.find((c) => c.id === 'histrap-hp-5-ml') as Column

const method = (o: Partial<Method> = {}): Method => ({
  format: 'gradientdesk',
  version: 1,
  name: 'IMAC_HisTrapHP5ml',
  application: 'imac',
  system: 'AKTAprime',
  column: histrap5,
  phases: templateFor('imac', histrap5),
  modified: '2026-10-15T10:00:00.000Z',
  ...o,
})

describe('JSON round trip', () => {
  test('every template on every listed column', () => {
    for (const app of APPLICATIONS) {
      for (const c of columnsFor(app.id, SEED_COLUMNS)) {
        const m = method({ application: app.id, column: c, phases: templateFor(app.id, c) })
        expect(fromJson(toJson(m))).toEqual(m)
      }
    }
  })

  test('custom column with unknown max flow', () => {
    const c: Column = { id: 'my-col', name: 'My col', manufacturer: '', cv: 2, flow: null, rec: 1, p: 0.3, apps: [], custom: true }
    const m = method({ column: c })
    expect(fromJson(toJson(m))).toEqual(m)
  })

  test('file uses the documented field names', () => {
    const f = toMethodFile(method())
    expect(f.phases[3]).toEqual({
      name: 'Elution', type: 'elution', length: 20, unit: 'CV', startB: 5, endB: 100,
      gradient: true, flow: 5, fraction: 2, inletA: 1, autozero: true,
    })
  })
})

describe('import', () => {
  const file = (o: Record<string, unknown>) => JSON.stringify({ ...toMethodFile(method()), ...o })

  test('rejects broken input with a readable message', () => {
    expect(() => fromJson('{nope')).toThrow('not valid JSON')
    expect(() => fromJson('{"format":"other"}')).toThrow('not a GradientDesk method file')
    expect(() => fromJson(file({ version: 2 }))).toThrow('newer version')
    expect(() => fromJson(file({ phases: [] }))).toThrow('no phases')
    expect(() => fromJson(file({ column: undefined }))).toThrow(MethodImportError)
  })

  test('fills missing or odd phase fields with safe values', () => {
    const m = fromJson(file({ phases: [{ length: '3', unit: 'CV', startB: 10, endB: 40, inletA: 12, type: 'bogus' }] }))
    expect(m.phases[0]).toEqual({
      name: 'Phase', type: 'wash', len: 3, unit: 'CV', b0: 10, b1: 40, grad: true, flow: 1, frac: 0, inlet: 8, az: false,
    })
  })

  test('unknown application falls back to General', () => {
    expect(fromJson(file({ application: 'xyz' })).application).toBe('general')
  })
})

describe('resolveColumn', () => {
  test('matches by id, then by name', () => {
    expect(resolveColumn(histrap5, SEED_COLUMNS)).toEqual({ column: histrap5, added: false })
    expect(resolveColumn({ ...histrap5, id: 'histrap5' }, SEED_COLUMNS)).toEqual({ column: histrap5, added: false })
  })

  test('creates a custom column when nothing matches', () => {
    const c: Column = { id: 'x', name: 'Unknown 3 ml', manufacturer: '', cv: 3, flow: 10, rec: 5, p: 0.5, apps: ['imac'] }
    expect(resolveColumn(c, SEED_COLUMNS)).toEqual({ column: { ...c, apps: [], custom: true }, added: true })
    expect(resolveColumn({ ...c, cv: 0 }, SEED_COLUMNS)).toBeNull()
  })
})
