import { describe, expect, test } from 'vitest'
import { applyStdFlow, breakpoints, calcProgram, clampFlows, convertLength, expandPhases, maxB, phaseMl, updatePhaseLinked } from '../src/domain/calc'
import { retypePatch, templateFor } from '../src/domain/templates'
import type { Column, Phase } from '../src/domain/types'
import { validatePhase, validateProgram, validateSettings } from '../src/domain/validate'

const column: Column = { id: 'c', name: 'C', manufacturer: '', cv: 5, flow: 20, rec: 5, p: 0.5, apps: ['imac'] }
const phase = (o: Partial<Phase> = {}): Phase => ({
  name: 'P', type: 'wash', len: 2, unit: 'CV', b0: 0, b1: 0, grad: false, flow: 5, flowStd: false, frac: 0, inlet: 1, inj: 'Load', az: false, ...o,
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

  test('no column max flow check while the injection valve is on Waste', () => {
    expect(validatePhase(phase({ inj: 'Waste', flow: 25 }), 0, column)).toEqual([])
    expect(validatePhase(phase({ type: 'pumpwash', inj: 'Waste', lines: ['B'], flow: 25 }), 0, column)).toEqual([])
  })

  test('a pump wash needs at least one line', () => {
    expect(validatePhase(phase({ type: 'pumpwash', inj: 'Waste', lines: [] }), 0, column).map((i) => [i.field, i.level])).toEqual([['lines', 'error']])
  })

  test('Inject on an inlet other than A1 is a warning', () => {
    expect(validatePhase(phase({ type: 'sample', inj: 'Inject', inlet: 8 }), 0, column)).toEqual([
      { phase: 0, field: 'inlet', level: 'warning', message: 'Inject pushes the sample loop with inlet A8; loop injections normally run on A1.' },
    ])
    expect(validatePhase(phase({ type: 'sample', inj: 'Inject', inlet: 1 }), 0, column)).toEqual([])
    expect(validatePhase(phase({ type: 'sample', inj: 'Load', inlet: 8, len: 60, unit: 'ml' }), 0, column)).toEqual([])
  })

  test('a sample on Load of 50 ml or less is a warning', () => {
    const message = 'Loading over the system pump makes sense above 50 ml; inject smaller samples over a sample loop.'
    expect(validatePhase(phase({ type: 'sample', inj: 'Load', inlet: 8, len: 50, unit: 'ml' }), 0, column)).toEqual([{ phase: 0, field: 'len', level: 'warning', message }])
    expect(validatePhase(phase({ type: 'sample', inj: 'Load', inlet: 8, len: 50.5, unit: 'ml' }), 0, column)).toEqual([])
    expect(validatePhase(phase({ type: 'wash', inj: 'Load', len: 5, unit: 'ml' }), 0, column)).toEqual([])
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

describe('pump wash', () => {
  const wash = (o: Partial<Phase> = {}) => phase({ name: 'Pump wash', type: 'pumpwash', len: 40, unit: 'ml', flow: 10, inj: 'Waste', lines: ['A1', 'B', 'A8'], ...o })

  test('runs one segment per line in the order B, A8 … A1', () => {
    expect(expandPhases([phase(), wash()]).map((s) => [s.src, s.p.lines, s.p.b0, s.p.inlet])).toEqual([
      [0, undefined, 0, 1], [1, ['B'], 100, 1], [1, ['A8'], 0, 8], [1, ['A1'], 0, 1],
    ])
  })

  test('volume and time count every line', () => {
    const c = calcProgram([wash()], column)
    expect(c.total).toBe(120)
    expect(c.time).toBe(12)
    expect(c.phases[0]).toMatchObject({ b0: 100, b1: 0 })
  })

  test('breakpoints: B, then A8 after a %B step, then A1, all on Waste', () => {
    const bps = breakpoints([wash()], column)
    expect(bps.map((b) => [b.volume, b.conc, b.inlet, b.flow, b.inj, b.phase])).toEqual([
      [0, 100, 1, 10, 'Waste', 0], [40, 100, 1, 10, 'Waste', 0], [40.1, 0, 8, 10, 'Waste', 0], [80, 0, 1, 10, 'Waste', 0], [120, 0, 1, 10, 'Waste', 0],
    ])
  })

  test('each line must be long enough for the file', () => {
    const issues = validateProgram([wash({ len: 0.1 })], column)
    expect(issues.map((i) => [i.field, i.level])).toEqual([['len', 'error']])
  })

  test('changing the column keeps the pump wash flow', () => {
    expect(clampFlows([wash({ flow: 30 })], column)[0].flow).toBe(30)
  })

  test('changing the type to pump wash sets its defaults; changing back drops the lines', () => {
    const p = phase({ b0: 5, b1: 5, frac: 2, az: true })
    const w = { ...p, ...retypePatch(p, 'pumpwash') }
    expect(w).toMatchObject({ type: 'pumpwash', lines: ['B', 'A1'], len: 40, unit: 'ml', flow: 10, frac: 0, inj: 'Waste', az: false, b0: 5 })
    expect({ ...w, ...retypePatch(w, 'sample') }).toMatchObject({ type: 'sample', inj: 'Inject', lines: undefined })
  })
})

describe('method settings', () => {
  test('standard flow above the column max and pressure above the column or system limit warn', () => {
    expect(validateSettings({ stdFlow: null, pressure: null, column })).toEqual([])
    expect(validateSettings({ stdFlow: 25, pressure: 0.6, column }).map((i) => i.field)).toEqual(['stdFlow', 'pressure'])
    expect(validateSettings({ stdFlow: null, pressure: 1.2, column: { ...column, p: 4 } }).map((i) => i.message)).toEqual([
      'The ÄKTA prime allows at most 1 MPa; the export writes 1 MPa.',
    ])
  })

  test('templates mark phases at the standard flow and derive slow loads from it', () => {
    const ph = templateFor('imac', { ...column, rec: 5 }, 2)
    expect(ph.map((p) => [p.flow, p.flowStd])).toEqual([[2, true], [1, false], [2, true], [2, true], [2, true], [2, true]])
    expect(applyStdFlow(ph, 4).map((p) => p.flow)).toEqual([4, 1, 4, 4, 4, 4])
  })
})
