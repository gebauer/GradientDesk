import { describe, expect, test } from 'vitest'
import { breakpoints, calcProgram, clampFlows, convertLength, maxB, phaseMl } from '../src/domain/calc'
import type { Column, Phase } from '../src/domain/types'
import { validatePhase } from '../src/domain/validate'

const column: Column = { id: 'c', name: 'C', manufacturer: '', cv: 5, flow: 20, rec: 5, p: 0.5, apps: ['imac'] }
const phase = (o: Partial<Phase> = {}): Phase => ({
  name: 'P', type: 'wash', len: 2, unit: 'CV', b0: 0, b1: 0, grad: false, flow: 5, frac: 0, inlet: 1, az: false, ...o,
})

describe('volumes', () => {
  test('CV and ml lengths', () => {
    expect(phaseMl(phase({ len: 2, unit: 'CV' }), column)).toBe(10)
    expect(phaseMl(phase({ len: 7, unit: 'ml' }), column)).toBe(7)
    expect(phaseMl(phase({ len: -1 }), column)).toBe(0)
  })

  test('CV <-> ml conversion', () => {
    expect(convertLength(2, 'CV', 'ml', 5)).toBe(10)
    expect(convertLength(7, 'ml', 'CV', 5)).toBe(1.4)
    expect(convertLength(1, 'ml', 'CV', 3)).toBe(0.33)
    expect(convertLength(3, 'CV', 'CV', 5)).toBe(3)
  })

  test('start/end volumes, total and time', () => {
    const c = calcProgram([phase({ len: 2 }), phase({ len: 10, unit: 'ml', flow: 2 })], column)
    expect(c.phases.map((p) => [p.v0, p.v1])).toEqual([[0, 10], [10, 20]])
    expect(c.total).toBe(20)
    expect(c.time).toBe(2 + 5)
  })
})

describe('breakpoints', () => {
  const phases = [phase({ az: true }), phase({ b0: 0, b1: 100, grad: true, frac: 2, inlet: 3, az: true })]
  const bps = breakpoints(phases, column)

  test('two per phase', () => {
    expect(bps).toHaveLength(4)
  })

  test('start carries the phase autozero, end never does', () => {
    expect(bps.map((b) => b.az)).toEqual([true, false, true, false])
  })

  test('volumes, %B and phase settings', () => {
    expect(bps.map((b) => [b.volume, b.conc])).toEqual([[0, 0], [10, 0], [10, 0], [20, 100]])
    expect(bps[3]).toMatchObject({ flow: 5, frac: 2, inlet: 3, phase: 1 })
  })

  test('isocratic phases ignore a stale end %B', () => {
    const b = breakpoints([phase({ b0: 20, b1: 80, grad: false })], column)
    expect(b.map((x) => x.conc)).toEqual([20, 20])
    expect(maxB([phase({ b0: 20, b1: 80, grad: false })])).toBe(20)
  })
})

describe('column change', () => {
  test('clamps flows to the column max', () => {
    expect(clampFlows([phase({ flow: 30 }), phase({ flow: 3 })], column).map((p) => p.flow)).toEqual([20, 3])
  })

  test('leaves flows alone when the max flow is unknown', () => {
    expect(clampFlows([phase({ flow: 30 })], { ...column, flow: null })[0].flow).toBe(30)
  })
})

describe('validation', () => {
  test('flow above column max is a warning', () => {
    expect(validatePhase(phase({ flow: 25 }), 0, column)).toEqual([
      { phase: 0, field: 'flow', level: 'warning', message: 'Above the column maximum of 20 ml/min.' },
    ])
    expect(validatePhase(phase({ flow: 25 }), 0, { ...column, flow: null })).toEqual([])
  })

  test('invalid values are errors', () => {
    const issues = validatePhase(phase({ len: 0, b0: 120, flow: 0, frac: -1, inlet: 9 as Phase['inlet'] }), 2, column)
    expect(issues.map((i) => [i.field, i.level])).toEqual([
      ['len', 'error'], ['b0', 'error'], ['flow', 'error'], ['frac', 'error'], ['inlet', 'error'],
    ])
  })
})
