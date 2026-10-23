import { calcProgram, expandPhases, phaseMl, stepsBefore } from './calc'
import { SYSTEM_MAX_PRESSURE } from './columns'
import { PUMP_LOAD_MIN_ML } from './templates'
import type { Column, Phase } from './types'

export type IssueField = 'len' | 'b0' | 'b1' | 'flow' | 'frac' | 'inlet' | 'lines'

export interface Issue {
  phase: number
  field: IssueField
  /** Warnings never block export. */
  level: 'warning' | 'error'
  message: string
}

const fmt = (x: number) => String(Math.round(x * 100) / 100)

/** ÄKTA prime mixer volume in ml; gradients much shorter than this get smoothed out. */
export const MIXER_VOLUME = 4
/** Gradients over less than this volume (ml) get a warning. */
export const STEEP_GRADIENT_ML = 10

export function validatePhase(p: Phase, i: number, column: Column): Issue[] {
  const issues: Issue[] = []
  const err = (field: IssueField, message: string) => issues.push({ phase: i, field, level: 'error', message })

  if (!(p.len > 0)) err('len', 'Length must be greater than 0.')
  if (p.type === 'pumpwash') return [...issues, ...validatePumpWash(p, i)]
  if (!(p.b0 >= 0 && p.b0 <= 100)) err('b0', 'Start %B must be between 0 and 100.')
  if (p.grad && !(p.b1 >= 0 && p.b1 <= 100)) err('b1', 'End %B must be between 0 and 100.')
  if (!(p.flow > 0)) err('flow', 'Flow must be greater than 0.')
  // On Waste the flow bypasses the column, so its max flow doesn't apply.
  else if (column.flow !== null && p.inj !== 'Waste' && p.flow > column.flow) {
    issues.push({ phase: i, field: 'flow', level: 'warning', message: `Above the column maximum of ${fmt(column.flow)} ml/min.` })
  }
  if (!(p.frac >= 0)) err('frac', 'Fraction size cannot be negative.')
  const warn = (field: IssueField, message: string) => issues.push({ phase: i, field, level: 'warning', message })
  const ml = phaseMl(p, column)
  if (p.grad && p.b0 !== p.b1 && ml > 0 && ml < STEEP_GRADIENT_ML) {
    warn('len', `Steep gradient over ${fmt(ml)} ml: the ${MIXER_VOLUME} ml mixer smooths gradients shorter than ${STEEP_GRADIENT_ML} ml, so the real gradient will be shallower.`)
  }
  if (p.type === 'sample' && p.inj === 'Load' && ml > 0 && ml <= PUMP_LOAD_MIN_ML) {
    warn('len', `Loading over the system pump makes sense above ${PUMP_LOAD_MIN_ML} ml; inject smaller samples over a sample loop.`)
  }
  if (!(Number.isInteger(p.inlet) && p.inlet >= 1 && p.inlet <= 8)) err('inlet', 'Inlet must be A1–A8.')
  else if (p.inj === 'Inject' && p.inlet !== 1) {
    warn('inlet', `Inject pushes the sample loop with inlet A${p.inlet}; loop injections normally run on A1.`)
  }
  return issues
}

/** Pump wash: %B, inlet, fractions and autozero come from the lines, so only lines, volume and flow are checked. */
function validatePumpWash(p: Phase, i: number): Issue[] {
  const issues: Issue[] = []
  if (!p.lines?.length) issues.push({ phase: i, field: 'lines', level: 'error', message: 'Select at least one line to wash.' })
  if (!(p.flow > 0)) issues.push({ phase: i, field: 'flow', level: 'error', message: 'Flow must be greater than 0.' })
  return issues
}

const round1 = (x: number) => Math.round(x * 10) / 10

/**
 * Per-phase checks plus the minimum lengths the breakpoint file needs (strictly increasing volumes),
 * checked per segment so each line of a pump wash counts.
 */
export function validateProgram(phases: readonly Phase[], column: Column): Issue[] {
  const segs = expandPhases(phases)
  const calc = calcProgram(segs.map((s) => s.p), column)
  const short = new Map<number, boolean>()
  segs.forEach(({ p, src }, k) => {
    const c = calc.phases[k]
    const step = stepsBefore(calc, k)
    if (p.len > 0 && round1(c.v1) - round1(c.v0) < (step ? 0.2 : 0.1) - 1e-9) short.set(src, short.get(src) || step)
  })
  return phases.flatMap((p, i) => {
    const issues = validatePhase(p, i, column)
    const step = short.get(i)
    if (step !== undefined) {
      issues.push({
        phase: i,
        field: 'len',
        level: 'error',
        message: step
          ? 'Too short for the ÄKTA prime: a phase that starts with a %B step needs at least 0.2 ml.'
          : 'Too short for the ÄKTA prime: a phase needs at least 0.1 ml.',
      })
    }
    return issues
  })
}

export interface SettingIssue {
  field: 'stdFlow' | 'pressure'
  level: 'warning'
  message: string
}

/** Method standard flow and pressure limit against the column; warnings only (export stays allowed). */
export function validateSettings(m: { stdFlow: number | null; pressure: number | null; column: Column }): SettingIssue[] {
  const issues: SettingIssue[] = []
  const c = m.column
  if (m.stdFlow !== null && c.flow !== null && m.stdFlow > c.flow) {
    issues.push({ field: 'stdFlow', level: 'warning', message: `Standard flow is above the column maximum of ${fmt(c.flow)} ml/min.` })
  }
  if (m.pressure !== null && m.pressure > c.p) {
    issues.push({ field: 'pressure', level: 'warning', message: `Pressure limit is above the column limit of ${fmt(c.p)} MPa.` })
  }
  if (m.pressure !== null && m.pressure > SYSTEM_MAX_PRESSURE) {
    issues.push({ field: 'pressure', level: 'warning', message: `The ÄKTA prime allows at most ${fmt(SYSTEM_MAX_PRESSURE)} MPa; the export writes ${fmt(SYSTEM_MAX_PRESSURE)} MPa.` })
  }
  return issues
}
