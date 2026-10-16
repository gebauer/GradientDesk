import { describe, expect, test } from 'vitest'
import { calcProgram } from '../src/domain/calc'
import { columnsFor, SEED_COLUMNS } from '../src/domain/columns'
import { APPLICATIONS, defaultInj, defaultMethodName, defaultSelection, newPhaseAfter, PHASE_TYPES, templateFor } from '../src/domain/templates'
import type { ApplicationId, Column } from '../src/domain/types'
import { validateProgram } from '../src/domain/validate'

const col = (name: string): Column => {
  const c = SEED_COLUMNS.find((x) => x.name === name)
  if (!c) throw new Error(`missing column ${name}`)
  return c
}

const mls = (app: ApplicationId, c: Column) => calcProgram(templateFor(app, c), c).phases.map((p) => p.ml)

describe('templates (ml per phase)', () => {
  test('IMAC on HisTrap HP 5 ml', () => {
    const c = col('HisTrap HP 5 ml')
    const ph = templateFor('imac', c)
    expect(mls('imac', c)).toEqual([25, 25, 50, 100, 25, 25])
    expect(ph[1]).toMatchObject({ type: 'sample', inlet: 8, flow: 1 })
    expect(ph[3]).toMatchObject({ b0: 5, b1: 100, grad: true, frac: 2, az: true })
    expect(calcProgram(ph, c).time).toBe(70)
  })

  test('IMAC on HisTrap HP 1 ml uses slow load and 1 ml fractions', () => {
    const c = col('HisTrap HP 1 ml')
    const ph = templateFor('imac', c)
    expect(mls('imac', c)).toEqual([5, 25, 10, 20, 5, 5])
    expect(ph[1].flow).toBe(0.5)
    expect(ph[3].frac).toBe(1)
    expect(calcProgram(ph, c).time).toBe(95)
  })

  test('IEX on HiTrap Q HP 5 ml', () => {
    const c = col('HiTrap Q HP 5 ml')
    expect(mls('iex', c)).toEqual([25, 20, 25, 100, 25, 25])
    expect(templateFor('iex', c)[3]).toMatchObject({ b0: 0, b1: 50 })
  })

  test('affinity on GSTrap HP 5 ml uses an isocratic step elution', () => {
    const c = col('GSTrap HP 5 ml')
    expect(mls('affinity', c)).toEqual([25, 20, 50, 50, 25])
    expect(templateFor('affinity', c)[3]).toMatchObject({ b0: 100, b1: 100, grad: false, frac: 2 })
  })

  test('HIC on HiTrap Phenyl HP 1 ml', () => {
    const c = col('HiTrap Phenyl HP 1 ml')
    expect(mls('hic', c)).toEqual([5, 20, 5, 20, 5, 5])
    expect(templateFor('hic', c)[1].flow).toBe(0.5)
  })

  test('SEC on HiLoad 16/600 Superdex 200 pg', () => {
    const c = col('HiLoad 16/600 Superdex 200 pg')
    const ph = templateFor('sec', c)
    expect(mls('sec', c)).toEqual([120, 2, 144])
    expect(ph.every((p) => p.flow === 1 && !p.grad)).toBe(true)
  })

  test('pre-loaded column: no sample phase, wash then gradient', () => {
    const c = col('HisTrap HP 5 ml')
    const ph = templateFor('preloaded', c)
    expect(mls('preloaded', c)).toEqual([25, 100, 25, 25])
    expect(ph.some((p) => p.type === 'sample' || p.inlet === 8)).toBe(false)
    expect(ph[0]).toMatchObject({ type: 'wash', az: true })
    expect(ph[1]).toMatchObject({ type: 'elution', b0: 0, b1: 100, grad: true, frac: 2, az: true })
    expect(defaultSelection(ph)).toBe(1)
  })

  test('column equilibration rinses with water on A2', () => {
    const c = col('HisTrap HP 5 ml')
    expect(mls('equil', c)).toEqual([15, 25])
    expect(templateFor('equil', c)[0].inlet).toBe(2)
  })

  test('templates are valid for every application and listed column', () => {
    for (const app of APPLICATIONS) {
      for (const c of columnsFor(app.id, SEED_COLUMNS)) {
        const errors = validateProgram(templateFor(app.id, c), c).filter((i) => i.level === 'error')
        expect(errors, `${app.id} / ${c.name}`).toEqual([])
      }
    }
  })
})

test('default selection is the first elution phase', () => {
  const c = col('HisTrap HP 5 ml')
  expect(defaultSelection(templateFor('imac', c))).toBe(3)
  expect(defaultSelection(templateFor('sec', c))).toBe(2)
  expect(defaultSelection(templateFor('equil', c))).toBe(0)
})

test('default method name', () => {
  expect(defaultMethodName('imac', col('HisTrap HP 5 ml'))).toBe('IMAC_HisTrapHP5ml')
})

test('new phase continues at the end %B of the selected phase', () => {
  const sel = templateFor('imac', col('HisTrap HP 5 ml'))[3]
  expect(newPhaseAfter(sel)).toMatchObject({ name: 'New phase', type: 'wash', len: 5, unit: 'CV', b0: 100, b1: 100, grad: false, flow: 5, inlet: 1 })
})

test('injection valve default follows the phase type', () => {
  expect(PHASE_TYPES.map((t) => [t.id, defaultInj(t.id)])).toEqual([
    ['equil', 'Load'], ['sample', 'Inject'], ['wash', 'Load'], ['elution', 'Load'], ['strip', 'Load'], ['pumpwash', 'Waste'],
  ])
  for (const app of APPLICATIONS) {
    const c = columnsFor(app.id, SEED_COLUMNS)[0]
    expect(templateFor(app.id, c).every((p) => p.inj === defaultInj(p.type)), app.id).toBe(true)
  }
})
