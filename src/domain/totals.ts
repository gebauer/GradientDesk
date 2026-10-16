import { calcProgram, expandPhases } from './calc'
import type { Column, Phase, PumpLine } from './types'

export interface ProgramTotals {
  /** ml */
  volume: number
  /** minutes */
  time: number
  /** Number of fractions (each fractionating phase counted separately, a last partial fraction included). */
  fractions: number
  /** ml collected in fractions */
  fractionMl: number
  /** Distinct fraction sizes in ml, ascending. */
  fractionSizes: number[]
  /** Volume pumped per line in ml (A1 … A8, then B), lines that are not used left out. */
  buffers: { line: PumpLine; ml: number }[]
}

/** Display order of the buffer lines. */
const BUFFER_ORDER: readonly PumpLine[] = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'B']

/**
 * Live totals of a program. Buffer use follows the pump: a segment from b0 to b1 %B (linear)
 * draws its mean %B share from line B and the rest from its inlet An. Pump wash lines count too.
 */
export function programTotals(phases: readonly Phase[], column: Column): ProgramTotals {
  const segs = expandPhases(phases).map((s) => s.p)
  const calc = calcProgram(segs, column)
  const use = new Map<PumpLine, number>()
  const add = (line: PumpLine, ml: number) => use.set(line, (use.get(line) ?? 0) + ml)
  segs.forEach((p, i) => {
    const c = calc.phases[i]
    const b = Math.min(1, Math.max(0, (c.b0 + c.b1) / 200))
    if (b > 0) add('B', c.ml * b)
    if (b < 1) add(`A${p.inlet}` as PumpLine, c.ml * (1 - b))
  })

  const whole = calcProgram(phases, column)
  let fractions = 0
  let fractionMl = 0
  const sizes = new Set<number>()
  phases.forEach((p, i) => {
    const ml = whole.phases[i].ml
    if (!(p.frac > 0) || !(ml > 0)) return
    fractions += Math.ceil(ml / p.frac - 1e-9)
    fractionMl += ml
    sizes.add(p.frac)
  })

  return {
    volume: whole.total,
    time: whole.time,
    fractions,
    fractionMl,
    fractionSizes: [...sizes].sort((a, b) => a - b),
    buffers: BUFFER_ORDER.filter((l) => (use.get(l) ?? 0) > 1e-9).map((line) => ({ line, ml: use.get(line) ?? 0 })),
  }
}
