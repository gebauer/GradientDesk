import { describe, expect, test } from 'vitest'
import { columnsFor, SEED_COLUMNS } from '../src/domain/columns'
import { fromJson, MethodImportError, resolveColumn, toJson, toMethodFile } from '../src/domain/methodJson'
import { APPLICATIONS, templateFor } from '../src/domain/templates'
import type { Column, Method } from '../src/domain/types'

const histrap5 = SEED_COLUMNS.find((c) => c.id === 'histrap-hp-5-ml') as Column

const method = (o: Partial<Method> = {}): Method => ({
  format: 'gradientdesk',
  version: 3,
  name: 'IMAC_HisTrapHP5ml',
  application: 'imac',
  system: 'AKTAprime',
  column: histrap5,
  stdFlow: null,
  pressure: null,
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
      gradient: true, flow: 5, flowDefault: true, fraction: 2, inletA: 1, injection: 'Load', autozero: false,
    })
  })

  test('keeps the injection valve of every phase', () => {
    const phases = method().phases.map((p, i) => ({ ...p, inj: (['Load', 'Inject', 'Waste'] as const)[i % 3] }))
    expect(fromJson(toJson(method({ phases }))).phases.map((p) => p.inj)).toEqual(phases.map((p) => p.inj))
  })
})

describe('import', () => {
  const file = (o: Record<string, unknown>) => JSON.stringify({ ...toMethodFile(method()), ...o })

  test('rejects broken input with a readable message', () => {
    expect(() => fromJson('{nope')).toThrow('not valid JSON')
    expect(() => fromJson('{"format":"other"}')).toThrow('not a GradientDesk method file')
    expect(() => fromJson(file({ version: 4 }))).toThrow('newer version')
    expect(() => fromJson(file({ phases: [] }))).toThrow('no phases')
    expect(() => fromJson(file({ column: undefined }))).toThrow(MethodImportError)
  })

  test('fills missing or odd phase fields with safe values', () => {
    const m = fromJson(file({ phases: [{ length: '3', unit: 'CV', startB: 10, endB: 40, inletA: 12, type: 'bogus' }] }))
    expect(m.phases[0]).toEqual({
      name: 'Phase', type: 'wash', len: 3, unit: 'CV', b0: 10, b1: 40, grad: true, flow: 1, flowStd: false, frac: 0, inlet: 8, inj: 'Load', az: false,
    })
  })

  test('migrates version 2: column values, and phases at the recommended flow follow the standard flow', () => {
    const v3 = toMethodFile(method())
    const phases = v3.phases.map((p) => ({ ...p, flowDefault: undefined }))
    const m = fromJson(JSON.stringify({ ...v3, version: 2, standardFlow: undefined, pressureLimit: undefined, phases }))
    expect(m).toMatchObject({ version: 3, stdFlow: null, pressure: null })
    expect(m.phases.map((p) => [p.flow, p.flowStd])).toEqual([[5, true], [1, false], [5, true], [5, true], [5, true], [5, true]])
  })

  test('keeps standard flow and pressure overrides', () => {
    const m = method({ stdFlow: 3, pressure: 0.3, phases: templateFor('imac', histrap5, 3) })
    expect(fromJson(toJson(m))).toEqual(m)
  })

  test('migrates version 1: the injection valve follows the phase type', () => {
    const v1 = toMethodFile(method())
    const phases = [...v1.phases, { ...v1.phases[0], type: 'pumpwash' }].map((p) => ({ ...p, injection: undefined }))
    const m = fromJson(JSON.stringify({ ...v1, version: 1, phases }))
    expect(m.version).toBe(3)
    expect(m.phases.map((p) => [p.type, p.inj])).toEqual([
      ['equil', 'Load'], ['sample', 'Inject'], ['wash', 'Load'], ['elution', 'Load'], ['strip', 'Load'], ['equil', 'Load'], ['pumpwash', 'Waste'],
    ])
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
