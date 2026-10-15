import { useEffect, useReducer } from 'react'
import { clampFlows, convertLength } from '../domain/calc'
import { columnsFor, customRecFlow, SEED_COLUMNS } from '../domain/columns'
import { resolveColumn } from '../domain/methodJson'
import { defaultMethodName, defaultSelection, newPhaseAfter, templateFor } from '../domain/templates'
import type { ApplicationId, Column, LengthUnit, Method, Phase } from '../domain/types'
import * as storage from '../storage/local'

export type Step = 1 | 2 | 3 | 4

export interface Status {
  text: string
  /** Errors stay until the next action; other messages clear after 2.5 s. */
  sticky: boolean
}

export interface State {
  app: ApplicationId
  colId: string
  phases: Phase[]
  sel: number
  step: Step
  methodName: string
  customColumns: Column[]
  library: Method[]
  showMethods: boolean
  status: Status | null
  /** x-axis maximum frozen at drag start, so the axis doesn't rescale under the cursor. */
  dragDomain: number | null
}

export type Action =
  | { type: 'loadApp'; app: ApplicationId }
  | { type: 'selectColumn'; id: string }
  | { type: 'addCustomColumn'; name: string; cv: number; flow: number; p: number; id: string }
  | { type: 'removeCustomColumn'; id: string }
  | { type: 'selectPhase'; index: number }
  | { type: 'updatePhase'; index: number; patch: Partial<Phase> }
  | { type: 'setUnit'; index: number; unit: LengthUnit }
  | { type: 'addPhase' }
  | { type: 'deletePhase' }
  | { type: 'setStep'; step: Step }
  | { type: 'setMethodName'; name: string }
  | { type: 'dragStart'; index: number; domain: number }
  | { type: 'dragEnd' }
  | { type: 'save'; now: string }
  | { type: 'deleteMethod'; index: number }
  | { type: 'openMethod'; method: Method; message: string }
  | { type: 'toggleMethods' }
  | { type: 'closeMethods' }
  | { type: 'setStatus'; status: Status | null }

export const allColumns = (s: Pick<State, 'customColumns'>): Column[] => [...SEED_COLUMNS, ...s.customColumns]

export function currentColumn(s: Pick<State, 'customColumns' | 'colId' | 'app'>): Column {
  const all = allColumns(s)
  return all.find((c) => c.id === s.colId) ?? columnsFor(s.app, all)[0] ?? all[0]
}

export function currentMethod(s: State, now: string): Method {
  return {
    format: 'gradientdesk',
    version: 1,
    name: s.methodName,
    application: s.app,
    system: 'AKTAprime',
    column: currentColumn(s),
    phases: s.phases,
    modified: now,
  }
}

const clampSel = (sel: number, phases: readonly Phase[]) => Math.max(0, Math.min(sel, phases.length - 1))

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'loadApp': {
      const list = columnsFor(a.app, allColumns(s))
      const col = list.find((c) => c.id === s.colId) ?? list[0]
      const phases = templateFor(a.app, col)
      return { ...s, app: a.app, colId: col.id, phases, sel: defaultSelection(phases), methodName: defaultMethodName(a.app, col) }
    }
    case 'selectColumn': {
      const col = allColumns(s).find((c) => c.id === a.id)
      if (!col) return s
      return { ...s, colId: col.id, phases: clampFlows(s.phases, col) }
    }
    case 'addCustomColumn': {
      const col: Column = { id: a.id, name: a.name, manufacturer: '', cv: a.cv, flow: a.flow, rec: customRecFlow(a.flow), p: a.p, apps: [], custom: true }
      const next = { ...s, customColumns: [...s.customColumns, col] }
      return reducer(next, { type: 'selectColumn', id: col.id })
    }
    case 'removeCustomColumn': {
      const customColumns = s.customColumns.filter((c) => c.id !== a.id)
      const next = { ...s, customColumns }
      if (s.colId !== a.id) return next
      const fallback = columnsFor(s.app, allColumns(next))[0]
      return reducer(next, { type: 'selectColumn', id: fallback.id })
    }
    case 'selectPhase':
      return { ...s, sel: clampSel(a.index, s.phases) }
    case 'updatePhase':
      return { ...s, phases: s.phases.map((p, i) => (i === a.index ? { ...p, ...a.patch } : p)) }
    case 'setUnit': {
      const p = s.phases[a.index]
      if (!p || p.unit === a.unit) return s
      const len = convertLength(p.len, p.unit, a.unit, currentColumn(s).cv)
      return reducer(s, { type: 'updatePhase', index: a.index, patch: { unit: a.unit, len } })
    }
    case 'addPhase': {
      const src = s.phases[s.sel]
      const phases = [...s.phases.slice(0, s.sel + 1), newPhaseAfter(src), ...s.phases.slice(s.sel + 1)]
      return { ...s, phases, sel: s.sel + 1 }
    }
    case 'deletePhase': {
      if (s.phases.length <= 1) return s
      const phases = s.phases.filter((_, i) => i !== s.sel)
      return { ...s, phases, sel: Math.max(0, s.sel - 1) }
    }
    case 'setStep':
      return { ...s, step: a.step }
    case 'setMethodName':
      return { ...s, methodName: a.name }
    case 'dragStart':
      return { ...s, sel: a.index, dragDomain: a.domain }
    case 'dragEnd':
      return { ...s, dragDomain: null }
    case 'save': {
      const m = currentMethod(s, a.now)
      const i = s.library.findIndex((x) => x.name === m.name)
      const library = i >= 0 ? s.library.map((x, j) => (j === i ? m : x)) : [...s.library, m]
      return { ...s, library, status: { text: `Saved “${m.name}”`, sticky: false } }
    }
    case 'deleteMethod':
      return { ...s, library: s.library.filter((_, i) => i !== a.index) }
    case 'openMethod': {
      const resolved = resolveColumn(a.method.column, allColumns(s))
      if (!resolved) return { ...s, status: { text: `Could not open “${a.method.name}”: the column has no column volume.`, sticky: true } }
      const customColumns = resolved.added ? [...s.customColumns, resolved.column] : s.customColumns
      return {
        ...s,
        customColumns,
        app: a.method.application,
        colId: resolved.column.id,
        phases: a.method.phases,
        sel: defaultSelection(a.method.phases),
        methodName: a.method.name,
        step: 3,
        showMethods: false,
        status: { text: a.message, sticky: false },
      }
    }
    case 'toggleMethods':
      return { ...s, showMethods: !s.showMethods }
    case 'closeMethods':
      return { ...s, showMethods: false }
    case 'setStatus':
      return { ...s, status: a.status }
  }
}

export function initialState(): State {
  const customColumns = storage.loadCustomColumns()
  const library = storage.loadMethods()
  const base: State = {
    app: 'imac',
    colId: '',
    phases: [],
    sel: 0,
    step: 1,
    methodName: '',
    customColumns,
    library,
    showMethods: false,
    status: null,
    dragDomain: null,
  }
  const current = storage.loadCurrent()
  if (current) {
    const opened = reducer(base, { type: 'openMethod', method: current.method, message: '' })
    if (opened.phases.length) return { ...opened, step: current.step, sel: clampSel(current.sel, opened.phases), status: null }
  }
  return reducer({ ...base, colId: 'histrap-hp-5-ml' }, { type: 'loadApp', app: 'imac' })
}

/** App store with persistence: custom columns and library on change, current method on every change except while dragging. */
export function useAppStore() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  useEffect(() => storage.saveCustomColumns(state.customColumns), [state.customColumns])
  useEffect(() => storage.saveMethods(state.library), [state.library])
  useEffect(() => {
    if (state.dragDomain !== null) return
    storage.saveCurrent({ method: currentMethod(state, new Date().toISOString()), step: state.step, sel: state.sel })
  }, [state])

  const status = state.status
  useEffect(() => {
    if (!status || status.sticky) return
    const t = setTimeout(() => dispatch({ type: 'setStatus', status: null }), 2500)
    return () => clearTimeout(t)
  }, [status])

  return [state, dispatch] as const
}
