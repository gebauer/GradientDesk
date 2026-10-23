import { beforeEach, describe, expect, test } from 'vitest'
import { currentColumn, currentMethod, initialState, reducer, type Action, type State } from '../src/state/store'
import * as storage from '../src/storage/local'
import { fromMethodTxt, toMethodTxt } from '../src/domain/methodTxt'

const run = (s: State, ...actions: Action[]) => actions.reduce(reducer, s)
const NOW = '2026-10-15T10:00:00.000Z'

beforeEach(() => localStorage.clear())

describe('initial state', () => {
  test('starts on step 1 with General on HisTrap HP 5 ml', () => {
    const s = initialState()
    expect(s).toMatchObject({ step: 1, app: 'general', colId: 'histrap-hp-5-ml', sel: 3, methodName: 'General_HisTrapHP5ml' })
    expect(s.phases).toHaveLength(5)
  })

  test('restores the autosaved method', () => {
    const s = run(initialState(), { type: 'loadApp', app: 'sec' }, { type: 'setStep', step: 3 })
    storage.saveCurrent({ method: currentMethod(s, NOW), step: s.step, sel: 1, slot: 7 })
    const r = initialState()
    expect(r).toMatchObject({ app: 'sec', colId: s.colId, step: 3, sel: 1, slot: 7, methodName: s.methodName })
    expect(r.phases).toEqual(s.phases)
  })

  test('ignores broken storage', () => {
    localStorage.setItem('gd.current', '{not json')
    localStorage.setItem('gd.methods', '"x"')
    expect(initialState().app).toBe('general')
  })
})

describe('application and column', () => {
  test('loading an application keeps the column when it is listed, otherwise picks the first', () => {
    const s = run(initialState(), { type: 'loadApp', app: 'equil' })
    expect(s.colId).toBe('histrap-hp-5-ml')
    const t = run(s, { type: 'loadApp', app: 'sec' })
    expect(currentColumn(t).apps).toContain('sec')
  })

  test('changing the column clamps flows', () => {
    const s = run(initialState(), { type: 'loadApp', app: 'sec' }, { type: 'updatePhase', index: 2, patch: { flow: 50 } }, { type: 'selectColumn', id: 'hiload-16-600-superdex-200-pg' })
    expect(s.phases[2].flow).toBe(1.6)
  })

  test('custom columns are added, selected and removed', () => {
    let s = run(initialState(), { type: 'addCustomColumn', id: 'custom-1', name: 'Gravity 2 ml', cv: 2, flow: 4, p: 0.3 })
    expect(currentColumn(s)).toMatchObject({ id: 'custom-1', rec: 2, custom: true })
    s = run(s, { type: 'removeCustomColumn', id: 'custom-1' })
    expect(s.customColumns).toEqual([])
    expect(currentColumn(s).apps).toContain('imac')
  })
})

describe('recent columns', () => {
  test('choosing or opening counts, loading a template and the automatic fallback do not', () => {
    let s = initialState()
    expect(s.recentColumns).toEqual([])
    s = run(s, { type: 'loadApp', app: 'sec' })
    expect(s.recentColumns).toEqual([])
    s = run(s, { type: 'selectColumn', id: 'superdex-75-10-300-gl' }, { type: 'selectColumn', id: 'histrap-hp-1-ml' })
    expect(s.recentColumns).toEqual(['histrap-hp-1-ml', 'superdex-75-10-300-gl'])
    s = run(s, { type: 'addCustomColumn', id: 'custom-1', name: 'Gravity 2 ml', cv: 2, flow: 4, p: 0.3 })
    expect(s.recentColumns[0]).toBe('custom-1')
    s = run(s, { type: 'removeCustomColumn', id: 'custom-1' })
    expect(s.recentColumns).toEqual(['histrap-hp-1-ml', 'superdex-75-10-300-gl'])
  })

  test('survive a reload', () => {
    storage.saveRecentColumns(['histrap-hp-1-ml'])
    expect(initialState().recentColumns).toEqual(['histrap-hp-1-ml'])
  })
})

describe('phases', () => {
  test('add inserts after the selection and selects it; delete keeps at least one', () => {
    let s = run(initialState(), { type: 'selectPhase', index: 0 }, { type: 'addPhase' })
    expect(s.sel).toBe(1)
    expect(s.phases[1].name).toBe('New phase')
    expect(s.phases).toHaveLength(6)
    s = run(s, { type: 'deletePhase' })
    expect(s.phases).toHaveLength(5)
    expect(s.sel).toBe(0)
    s = run(s, { type: 'loadApp', app: 'equil' }, { type: 'deletePhase' }, { type: 'deletePhase' })
    expect(s.phases).toHaveLength(1)
  })

  test('add before inserts at the selection, at its start %B, and selects the new phase', () => {
    const s = run(initialState(), { type: 'loadApp', app: 'imac' }, { type: 'selectPhase', index: 0 }, { type: 'addPhase', before: true })
    expect(s.sel).toBe(0)
    expect(s.phases).toHaveLength(7)
    expect(s.phases[0]).toMatchObject({ name: 'New phase', b0: 0, b1: 0 })
    expect(s.phases[1].name).toBe('Equilibration')
    const mid = run(s, { type: 'selectPhase', index: 4 }, { type: 'addPhase', before: true })
    expect(mid.sel).toBe(4)
    expect(mid.phases[4]).toMatchObject({ name: 'New phase', b0: 5, b1: 5 })
    expect(mid.phases[5].name).toBe('Elution')
  })

  test('standard flow: default phases follow it, own values stay, null goes back to the column value', () => {
    let s = run(initialState(), { type: 'loadApp', app: 'imac' })
    const own = s.phases.findIndex((p) => !p.flowStd)
    expect(s.phases[own].type).toBe('sample')
    s = run(s, { type: 'setStdFlow', value: 3 })
    expect(s.phases.filter((p) => p.flowStd).every((p) => p.flow === 3)).toBe(true)
    expect(s.phases[own].flow).toBe(1)
    s = run(s, { type: 'setStdFlow', value: null })
    expect(s.stdFlow).toBeNull()
    expect(s.phases.filter((p) => p.flowStd).every((p) => p.flow === currentColumn(s).rec)).toBe(true)
  })

  test('a new application on the same column keeps the overrides; another column resets them', () => {
    let s = run(initialState(), { type: 'setStdFlow', value: 3 }, { type: 'setPressure', value: 0.3 }, { type: 'loadApp', app: 'imac' })
    expect([s.stdFlow, s.pressure]).toEqual([3, 0.3])
    expect(s.phases.filter((p) => p.flowStd).every((p) => p.flow === 3)).toBe(true)
    s = run(s, { type: 'selectColumn', id: 'histrap-hp-1-ml' })
    expect([s.stdFlow, s.pressure]).toEqual([null, null])
    expect(s.phases.filter((p) => p.flowStd).every((p) => p.flow === 1)).toBe(true)
  })

  test('the export writes the method pressure limit as Max pressure', () => {
    const s = run(initialState(), { type: 'setPressure', value: 0.3 })
    expect(toMethodTxt(currentMethod(s, NOW))).toContain('Max pressure (kPa) ,300\r\n')
  })

  test('switching the unit converts the length', () => {
    const s = run(initialState(), { type: 'setUnit', index: 0, unit: 'ml' })
    expect(s.phases[0]).toMatchObject({ unit: 'ml', len: 25 })
    expect(run(s, { type: 'setUnit', index: 0, unit: 'CV' }).phases[0]).toMatchObject({ unit: 'CV', len: 5 })
  })
})

describe('system precision', () => {
  test('phase edits snap to whole %B, 0.1 flow, fraction and ml, 0.01 CV', () => {
    const s = run(initialState(), { type: 'updatePhase', index: 1, patch: { b0: 4.6, flow: 0.55, frac: 1.04, len: 12.34 } })
    expect(s.phases[1]).toMatchObject({ b0: 5, flow: 0.6, frac: 1, len: 12.3, unit: 'ml' })
    expect(run(s, { type: 'updatePhase', index: 0, patch: { len: 5.123 } }).phases[0]).toMatchObject({ len: 5.12, unit: 'CV' })
  })

  test('standard flow and pressure limit snap to 0.1 ml/min and whole kPa', () => {
    const s = run(initialState(), { type: 'setStdFlow', value: 2.46 }, { type: 'setPressure', value: 0.3337 })
    expect(s).toMatchObject({ stdFlow: 2.5, pressure: 0.334 })
    expect(s.phases.filter((p) => p.flowStd).every((p) => p.flow === 2.5)).toBe(true)
  })

  test('a column recommended flow off the 0.1 grid runs at the nearest step', () => {
    const s = run(initialState(), { type: 'loadApp', app: 'sec' }, { type: 'selectColumn', id: 'superdex-200-increase-10-300-gl' })
    expect(currentColumn(s).rec).toBe(0.25)
    expect(s.phases.every((p) => p.flow === 0.3)).toBe(true)
  })

  test('opening a stored method with finer values snaps them', () => {
    const s = initialState()
    const m = currentMethod(s, NOW)
    const fine = { ...m, stdFlow: 4.44, phases: m.phases.map((p) => ({ ...p, b0: p.b0 + 0.4, flow: p.flow + 0.04, frac: p.frac + 0.01 })) }
    const r = run(s, { type: 'openMethod', method: fine, message: '' })
    expect(r.stdFlow).toBe(4.4)
    expect(r.phases).toEqual(s.phases.map((p) => ({ ...p, flow: p.flowStd ? 4.4 : p.flow })))
  })
})

describe('library', () => {
  test('save upserts by name; save → reload → open restores the method', () => {
    let s = run(initialState(), { type: 'save', now: NOW }, { type: 'updatePhase', index: 0, patch: { len: 7 } }, { type: 'save', now: NOW })
    expect(s.library).toHaveLength(1)
    expect(s.library[0].phases[0].len).toBe(7)
    storage.saveMethods(s.library)

    const fresh = run(initialState(), { type: 'loadApp', app: 'iex' })
    const lib = storage.loadMethods()
    s = run({ ...fresh, library: lib }, { type: 'openMethod', method: lib[0], message: 'Opened' })
    expect(currentMethod(s, NOW)).toEqual(lib[0])
    expect(s.step).toBe(3)
  })

  test('opening a method with an unknown column adds it as a custom column', () => {
    const s = initialState()
    const m = { ...currentMethod(s, NOW), column: { ...currentColumn(s), id: 'lab-col', name: 'Lab column' } }
    const r = run(s, { type: 'openMethod', method: m, message: '' })
    expect(r.customColumns.map((c) => c.id)).toEqual(['lab-col'])
    expect(currentColumn(r).custom).toBe(true)
  })

  test('importing a .txt with a method block restores the method and the method number', () => {
    const s = run(initialState(), { type: 'loadApp', app: 'sec' }, { type: 'setMethodName', name: 'SEC run' })
    const txt = toMethodTxt(currentMethod(s, NOW))
    const result = fromMethodTxt(txt)
    if (result.kind !== 'method') throw new Error('expected the method block')
    const r = run(initialState(), { type: 'loadApp', app: 'imac' }, { type: 'openMethod', method: result.method, message: '', slot: 7 })
    expect(r.methodName).toBe('SEC run')
    expect(r.app).toBe('sec')
    expect(r.phases).toEqual(s.phases)
    expect(r.slot).toBe(7)
  })

  test('a custom column takes the given recommended flow, otherwise half its max flow', () => {
    const s = run(initialState(), { type: 'addCustomColumn', id: 'c1', name: 'A', cv: 2, flow: 4, p: 0.3, rec: 1.5 }, { type: 'addCustomColumn', id: 'c2', name: 'B', cv: 2, flow: 4, p: 0.3 })
    expect(s.customColumns.map((c) => c.rec)).toEqual([1.5, 2])
  })

  test('custom columns survive a reload', () => {
    const s = run(initialState(), { type: 'addCustomColumn', id: 'custom-1', name: 'Gravity 2 ml', cv: 2, flow: 4, p: 0.3 })
    storage.saveCustomColumns(s.customColumns)
    expect(initialState().customColumns).toEqual(s.customColumns)
  })
})
