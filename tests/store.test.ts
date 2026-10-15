import { beforeEach, describe, expect, test } from 'vitest'
import { currentColumn, currentMethod, initialState, reducer, type Action, type State } from '../src/state/store'
import * as storage from '../src/storage/local'

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

  test('switching the unit converts the length', () => {
    const s = run(initialState(), { type: 'setUnit', index: 0, unit: 'ml' })
    expect(s.phases[0]).toMatchObject({ unit: 'ml', len: 25 })
    expect(run(s, { type: 'setUnit', index: 0, unit: 'CV' }).phases[0]).toMatchObject({ unit: 'CV', len: 5 })
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

  test('custom columns survive a reload', () => {
    const s = run(initialState(), { type: 'addCustomColumn', id: 'custom-1', name: 'Gravity 2 ml', cv: 2, flow: 4, p: 0.3 })
    storage.saveCustomColumns(s.customColumns)
    expect(initialState().customColumns).toEqual(s.customColumns)
  })
})
