import type { Breakpoint, Column, LengthUnit, Phase } from './types'

export interface PhaseCalc {
  /** Phase volume in ml. */
  ml: number
  /** Start and end volume in ml. */
  v0: number
  v1: number
  /** %B at start and end; b1 equals b0 when isocratic. */
  b0: number
  b1: number
  /** Run time in minutes; 0 when flow is not positive (validation reports it). */
  min: number
}

export interface ProgramCalc {
  phases: PhaseCalc[]
  /** ml */
  total: number
  /** minutes */
  time: number
}

export function phaseMl(phase: Phase, column: Column): number {
  return Math.max(0, phase.unit === 'CV' ? phase.len * column.cv : phase.len)
}

/** Converts a length between CV and ml, rounded to 0.1 (CV to 0.01). */
export function convertLength(len: number, from: LengthUnit, to: LengthUnit, cv: number): number {
  if (from === to) return len
  return to === 'ml' ? Math.round(len * cv * 10) / 10 : Math.round((len / cv) * 100) / 100
}

/** End %B as used for calculation and export. */
export function endB(phase: Phase): number {
  return phase.grad ? phase.b1 : phase.b0
}

export function calcProgram(phases: readonly Phase[], column: Column): ProgramCalc {
  let v = 0
  let time = 0
  const out = phases.map((p) => {
    const ml = phaseMl(p, column)
    const min = p.flow > 0 ? ml / p.flow : 0
    const c: PhaseCalc = { ml, v0: v, v1: v + ml, b0: p.b0, b1: endB(p), min }
    v += ml
    time += min
    return c
  })
  return { phases: out, total: v, time }
}

/** Two breakpoints per phase: start (autozero = phase setting) and end (autozero off). */
export function breakpoints(phases: readonly Phase[], column: Column): Breakpoint[] {
  const calc = calcProgram(phases, column)
  return phases.flatMap((p, i) => {
    const c = calc.phases[i]
    const base = { flow: p.flow, frac: p.frac, inlet: p.inlet, phase: i }
    return [
      { ...base, volume: c.v0, conc: c.b0, az: p.az },
      { ...base, volume: c.v1, conc: c.b1, az: false },
    ]
  })
}

export function maxB(phases: readonly Phase[]): number {
  return phases.reduce((m, p) => Math.max(m, p.b0, endB(p)), 0)
}

/** On column change: clamp each phase's flow to the column's max flow. No-op when max flow is unknown. */
export function clampFlows(phases: readonly Phase[], column: Column): Phase[] {
  const max = column.flow
  if (max === null) return [...phases]
  return phases.map((p) => (p.flow > max ? { ...p, flow: max } : p))
}
