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

const round1 = (x: number) => Math.round(x * 10) / 10

/** Volume offset of the start breakpoint after a %B step (two breakpoints at one volume don't work). */
export const STEP_OFFSET = 0.1

/** True when phase i starts with a %B step from phase i-1 (compared as exported: whole %B). */
export function stepsBefore(calc: ProgramCalc, i: number): boolean {
  return i > 0 && Math.round(calc.phases[i - 1].b1) !== Math.round(calc.phases[i].b0)
}

/**
 * ÄKTA prime breakpoints, with the values as written to the file (volume, flow and fraction
 * size to 0.1, whole %B). A breakpoint sets flow, fractions and inlet from its volume on; %B
 * is interpolated linearly to the next breakpoint; the method ends at the last breakpoint.
 * One breakpoint per phase start, an end breakpoint where %B steps to the next phase (the next
 * start then follows at +0.1 ml, see docs/primeview-format.md), and a final end breakpoint.
 */
export function breakpoints(phases: readonly Phase[], column: Column): Breakpoint[] {
  const calc = calcProgram(phases, column)
  return phases.flatMap((p, i) => {
    const c = calc.phases[i]
    const base = { flow: round1(p.flow), frac: round1(p.frac), inlet: p.inlet, phase: i }
    const v0 = round1(round1(c.v0) + (stepsBefore(calc, i) ? STEP_OFFSET : 0))
    const start: Breakpoint = { ...base, volume: v0, conc: Math.round(c.b0), az: p.az }
    const last = i === phases.length - 1
    if (!last && !stepsBefore(calc, i + 1)) return [start]
    return [start, { ...base, volume: round1(c.v1), conc: Math.round(c.b1), az: false }]
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
