import { describe, expect, test } from 'vitest'
import { breakpoints, calcProgram, clampFlows, convertLength, maxB, phaseMl, updatePhaseLinked } from '../src/domain/calc'
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

  test('one per phase start plus the end; continuous %B needs no extra end breakpoint', () => {
    expect(bps).toHaveLength(3)
  })

  test('start carries the phase autozero, end never does', () => {
    expect(bps.map((b) => b.az)).toEqual([true, true, false])
  })

  test('volumes, %B and phase settings', () => {
    expect(bps.map((b) => [b.volume, b.conc])).toEqual([[0, 0], [10, 0], [20, 100]])
    expect(bps[2]).toMatchObject({ flow: 5, frac: 2, inlet: 3, phase: 1 })
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

describe('mixer', () => {
  test('gradients over less than 10 ml warn about the 4 ml mixer', () => {
    const steep = validatePhase(phase({ len: 1.8, b1: 100, grad: true }), 0, column)
    expect(steep.map((i) => [i.field, i.level])).toEqual([['len', 'warning']])
    expect(steep[0].message).toContain('4 ml mixer')
    expect(validatePhase(phase({ len: 2, b1: 100, grad: true }), 0, column)).toEqual([])
    expect(validatePhase(phase({ len: 1, b0: 50, b1: 50 }), 0, column)).toEqual([])
  })
})

describe('linked %B edits', () => {
  // Elution gradient 5→100, strip 100, re-equilibration 0 (the IMAC tail)
  const tail = () => [
    phase({ name: 'Elution', b0: 5, b1: 100, grad: true }),
    phase({ name: 'Strip', b0: 100, b1: 100 }),
    phase({ name: 'Re-equilibration', b0: 0, b1: 0 }),
  ]

  test('moving an isocratic phase pulls the end of the gradient before it', () => {
    const out = updatePhaseLinked(tail(), 1, { b0: 53, b1: 53 })
    expect(out.map((p) => [p.b0, p.b1])).toEqual([[5, 53], [53, 53], [0, 0]])
  })

  test('isocratic neighbours keep their level', () => {
    const out = updatePhaseLinked(tail(), 0, { b1: 80 })
    expect(out.map((p) => [p.b0, p.b1])).toEqual([[5, 80], [100, 100], [0, 0]])
    expect(updatePhaseLinked(tail(), 2, { b0: 20, b1: 20 })[1]).toMatchObject({ b0: 100, b1: 100 })
  })

  test('a gradient after the phase follows its end', () => {
    const ph = [phase({ b0: 10, b1: 10 }), phase({ b0: 10, b1: 60, grad: true })]
    expect(updatePhaseLinked(ph, 0, { b0: 30, b1: 30 })[1]).toMatchObject({ b0: 30, b1: 60 })
  })

  test('only connected neighbours follow; other fields never touch neighbours', () => {
    const ph = [phase({ b0: 0, b1: 40, grad: true }), phase({ b0: 50, b1: 50 })]
    expect(updatePhaseLinked(ph, 1, { b0: 70, b1: 70 })[0].b1).toBe(40)
    expect(updatePhaseLinked(tail(), 1, { len: 9, flow: 2 })).toEqual([tail()[0], { ...tail()[1], len: 9, flow: 2 }, tail()[2]])
  })
})
