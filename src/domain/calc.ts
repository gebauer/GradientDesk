import type { Breakpoint, Column, Inlet, LengthUnit, Phase, PumpLine } from './types'

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

/** Wash order: B first, then A8 down to A1. */
export const PUMP_LINES: readonly PumpLine[] = ['B', 'A8', 'A7', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1']

export const sortLines = (lines: readonly PumpLine[]): PumpLine[] => PUMP_LINES.filter((l) => lines.includes(l))

export function phaseMl(phase: Phase, column: Column): number {
  const ml = Math.max(0, phase.unit === 'CV' ? phase.len * column.cv : phase.len)
  return phase.type === 'pumpwash' ? ml * (phase.lines?.length ?? 0) : ml
}

/** A phase as it runs: pump washes become one single-line segment per line, everything else stays. */
export interface Segment {
  p: Phase
  /** Index of the program phase it comes from. */
  src: number
}

export function expandPhases(phases: readonly Phase[]): Segment[] {
  return phases.flatMap((p, src) => {
    if (p.type !== 'pumpwash') return [{ p, src }]
    return sortLines(p.lines ?? []).map((line, k) => {
      const b = line === 'B' ? 100 : 0
      const inlet = line === 'B' ? p.inlet : (Number(line.slice(1)) as Inlet)
      return { p: { ...p, lines: [line], b0: b, b1: b, grad: false, inlet, az: k === 0 && p.az }, src }
    })
  })
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
    // A pump wash starts at its first line's %B and ends at its last line's.
    const seg = p.type === 'pumpwash' ? expandPhases([p]).map((s) => s.p) : [p]
    const b0 = seg[0]?.b0 ?? p.b0
    const b1 = seg.length ? endB(seg[seg.length - 1]) : endB(p)
    const c: PhaseCalc = { ml, v0: v, v1: v + ml, b0, b1, min }
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
 * size to 0.1, whole %B). A breakpoint sets flow, fractions, inlet and injection valve from its volume on; %B
 * is interpolated linearly to the next breakpoint; the method ends at the last breakpoint.
 * One breakpoint per phase start, an end breakpoint where %B steps to the next phase (the next
 * start then follows at +0.1 ml, see docs/primeview-format.md), and a final end breakpoint.
 * A pump wash is written as one segment per line (expandPhases).
 */
export function breakpoints(phases: readonly Phase[], column: Column): Breakpoint[] {
  const segs = expandPhases(phases)
  const calc = calcProgram(segs.map((s) => s.p), column)
  return segs.flatMap(({ p, src }, i) => {
    const c = calc.phases[i]
    const base = { flow: round1(p.flow), frac: round1(p.frac), inlet: p.inlet, inj: p.inj, phase: src }
    const v0 = round1(round1(c.v0) + (stepsBefore(calc, i) ? STEP_OFFSET : 0))
    const start: Breakpoint = { ...base, volume: v0, conc: Math.round(c.b0), az: p.az }
    const last = i === segs.length - 1
    if (!last && !stepsBefore(calc, i + 1)) return [start]
    return [start, { ...base, volume: round1(c.v1), conc: Math.round(c.b1), az: false }]
  })
}

export function maxB(phases: readonly Phase[]): number {
  return expandPhases(phases).reduce((m, { p }) => Math.max(m, p.b0, endB(p)), 0)
}

/** The method's standard flow and pressure limit: its override, otherwise the column's value. */
export const stdFlowOf = (m: { stdFlow: number | null; column: Column }): number => m.stdFlow ?? m.column.rec
export const pressureOf = (m: { pressure: number | null; column: Column }): number => m.pressure ?? m.column.p

/** Sets every phase that runs at the standard flow to `flow`. */
export function applyStdFlow(phases: readonly Phase[], flow: number): Phase[] {
  return phases.map((p) => (p.flowStd && p.flow !== flow ? { ...p, flow } : p))
}

/**
 * On column change: clamp each phase's flow to the column's max flow. No-op when max flow is unknown.
 * Phases on Waste bypass the column and keep their flow.
 */
export function clampFlows(phases: readonly Phase[], column: Column): Phase[] {
  const max = column.flow
  if (max === null) return [...phases]
  return phases.map((p) => (p.flow > max && p.inj !== 'Waste' ? { ...p, flow: max } : p))
}

/**
 * Applies a patch to phase i and keeps connected gradients attached: when the phase's start %B
 * changes, a gradient before it that ended at the old start follows; when its end %B changes, a
 * gradient after it that started at the old end follows. Isocratic neighbours keep their level.
 */
export function updatePhaseLinked(phases: readonly Phase[], i: number, patch: Partial<Phase>): Phase[] {
  const old = phases[i]
  if (!old) return [...phases]
  const next = { ...old, ...patch }
  const out = [...phases]
  out[i] = next
  const prev = out[i - 1]
  if (prev?.grad && next.b0 !== old.b0 && prev.b1 === old.b0) out[i - 1] = { ...prev, b1: next.b0 }
  const after = out[i + 1]
  if (after?.grad && endB(next) !== endB(old) && after.b0 === endB(old)) out[i + 1] = { ...after, b0: endB(next) }
  return out
}
