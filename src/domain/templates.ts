import type { ApplicationId, Column, Inlet, InjectValve, LengthUnit, Phase, PhaseType, PumpLine } from './types'

export interface Application {
  id: ApplicationId
  name: string
  /** Used in default method names. */
  short: string
  description: string
}

export const APPLICATIONS: readonly Application[] = [
  { id: 'general', name: 'General', short: 'General', description: 'Any column. Equilibration, sample load, wash, linear gradient elution and re-equilibration as a starting point.' },
  { id: 'preloaded', name: 'Elute pre-loaded column', short: 'Elute', description: 'Any column, loaded off the system. Wash, linear gradient elution, strip and re-equilibration. No sample phase.' },
  { id: 'imac', name: 'Affinity · IMAC', short: 'IMAC', description: 'His-tagged proteins on Ni columns. Imidazole step wash and linear gradient elution.' },
  { id: 'affinity', name: 'Affinity · tags and ligands', short: 'Affinity', description: 'GST, Strep, MBP, Protein A/G and heparin. Step elution with the elution buffer.' },
  { id: 'iex', name: 'Ion exchange', short: 'IEX', description: 'Anion or cation exchange. Salt gradient elution, high-salt strip, re-equilibration.' },
  { id: 'hic', name: 'Hydrophobic interaction', short: 'HIC', description: 'Bind in high salt, elute with a decreasing salt gradient, strip without salt.' },
  { id: 'sec', name: 'Size exclusion', short: 'SEC', description: 'Isocratic run on a gel filtration or desalting column with fraction collection over 1.2 CV.' },
  { id: 'equil', name: 'Column equilibration', short: 'Equilibrate', description: 'Water rinse followed by buffer equilibration. No sample, no fractions.' },
]

export const PHASE_TYPES: readonly { id: PhaseType; name: string }[] = [
  { id: 'equil', name: 'Equilibration' },
  { id: 'sample', name: 'Sample application' },
  { id: 'wash', name: 'Wash' },
  { id: 'elution', name: 'Elution' },
  { id: 'strip', name: 'Strip / CIP' },
  { id: 'pumpwash', name: 'Pump wash' },
]

export const INJECT_VALVES: readonly InjectValve[] = ['Load', 'Inject', 'Waste']

/** Injection valve position a phase type starts with: sample through the loop, pump wash to waste, everything else straight to the column. */
export function defaultInj(type: PhaseType): InjectValve {
  return type === 'sample' ? 'Inject' : type === 'pumpwash' ? 'Waste' : 'Load'
}

/** Pump wash defaults: 40 ml per line at 10 ml/min to waste. */
export const PUMP_WASH_ML = 40
export const PUMP_WASH_FLOW = 10
export const PUMP_WASH_LINES: readonly PumpLine[] = ['B', 'A1']

/**
 * Patch for changing a phase's type: the injection valve follows the type; a pump wash gets its
 * defaults (lines, 40 ml per line, 10 ml/min, no fractions, no autozero), other types drop the lines.
 * %B stays, so connected gradients are not moved.
 */
export function retypePatch(p: Phase, type: PhaseType): Partial<Phase> {
  const patch: Partial<Phase> = { type, inj: defaultInj(type) }
  if (type === 'pumpwash' && p.type !== 'pumpwash') {
    return { ...patch, lines: [...PUMP_WASH_LINES], len: PUMP_WASH_ML, unit: 'ml', flow: PUMP_WASH_FLOW, frac: 0, az: false }
  }
  if (type !== 'pumpwash') return { ...patch, lines: undefined }
  return patch
}

const P = (
  name: string,
  type: PhaseType,
  len: number,
  unit: LengthUnit,
  b0: number,
  b1: number,
  flow: number,
  frac: number,
  inlet: Inlet,
  az: boolean,
): Phase => ({ name, type, len, unit, b0, b1, grad: b0 !== b1, flow, frac, inlet, inj: defaultInj(type), az })

/** Fraction size for gradient/step elutions: 2 ml, or 1 ml for columns below 5 ml. */
const elutionFrac = (c: Column) => (c.cv >= 5 ? 2 : 1)

/** Slow sample load used by IEX, HIC and affinity. */
const slowLoad = (c: Column) => Math.max(0.5, c.rec / 5)

const TEMPLATES: Record<ApplicationId, (c: Column) => Phase[]> = {
  general: (c) => [
    P('Equilibration', 'equil', 5, 'CV', 0, 0, c.rec, 0, 1, true),
    P('Sample load', 'sample', 10, 'ml', 0, 0, slowLoad(c), 0, 8, false),
    P('Wash', 'wash', 5, 'CV', 0, 0, c.rec, 0, 1, false),
    P('Elution', 'elution', 20, 'CV', 0, 100, c.rec, elutionFrac(c), 1, true),
    P('Re-equilibration', 'equil', 5, 'CV', 0, 0, c.rec, 0, 1, false),
  ],
  preloaded: (c) => [
    P('Wash', 'wash', 5, 'CV', 0, 0, c.rec, 0, 1, true),
    P('Elution', 'elution', 20, 'CV', 0, 100, c.rec, elutionFrac(c), 1, true),
    P('Strip', 'strip', 5, 'CV', 100, 100, c.rec, 0, 1, false),
    P('Re-equilibration', 'equil', 5, 'CV', 0, 0, c.rec, 0, 1, false),
  ],
  imac: (c) => [
    P('Equilibration', 'equil', 5, 'CV', 0, 0, c.rec, 0, 1, true),
    P('Sample load', 'sample', 25, 'ml', 0, 0, c.cv >= 5 ? 1 : 0.5, 0, 8, false),
    P('Wash', 'wash', 10, 'CV', 5, 5, c.rec, 0, 1, false),
    P('Elution', 'elution', 20, 'CV', 5, 100, c.rec, elutionFrac(c), 1, true),
    P('Strip', 'strip', 5, 'CV', 100, 100, c.rec, 0, 1, false),
    P('Re-equilibration', 'equil', 5, 'CV', 0, 0, c.rec, 0, 1, false),
  ],
  affinity: (c) => [
    P('Equilibration', 'equil', 5, 'CV', 0, 0, c.rec, 0, 1, true),
    P('Sample load', 'sample', 20, 'ml', 0, 0, slowLoad(c), 0, 8, false),
    P('Wash', 'wash', 10, 'CV', 0, 0, c.rec, 0, 1, false),
    P('Elution', 'elution', 10, 'CV', 100, 100, c.rec, elutionFrac(c), 1, true),
    P('Re-equilibration', 'equil', 5, 'CV', 0, 0, c.rec, 0, 1, false),
  ],
  iex: (c) => [
    P('Equilibration', 'equil', 5, 'CV', 0, 0, c.rec, 0, 1, true),
    P('Sample load', 'sample', 20, 'ml', 0, 0, slowLoad(c), 0, 8, false),
    P('Wash', 'wash', 5, 'CV', 0, 0, c.rec, 0, 1, false),
    P('Elution', 'elution', 20, 'CV', 0, 50, c.rec, elutionFrac(c), 1, true),
    P('High-salt strip', 'strip', 5, 'CV', 100, 100, c.rec, 0, 1, false),
    P('Re-equilibration', 'equil', 5, 'CV', 0, 0, c.rec, 0, 1, false),
  ],
  hic: (c) => [
    P('Equilibration', 'equil', 5, 'CV', 0, 0, c.rec, 0, 1, true),
    P('Sample load', 'sample', 20, 'ml', 0, 0, slowLoad(c), 0, 8, false),
    P('Wash', 'wash', 5, 'CV', 0, 0, c.rec, 0, 1, false),
    P('Elution', 'elution', 20, 'CV', 0, 100, c.rec, elutionFrac(c), 1, true),
    P('Strip', 'strip', 5, 'CV', 100, 100, c.rec, 0, 1, false),
    P('Re-equilibration', 'equil', 5, 'CV', 0, 0, c.rec, 0, 1, false),
  ],
  sec: (c) => [
    P('Equilibration', 'equil', 1, 'CV', 0, 0, c.rec, 0, 1, true),
    P('Sample injection', 'sample', 2, 'ml', 0, 0, c.rec, 0, 1, false),
    P('Isocratic elution', 'elution', 1.2, 'CV', 0, 0, c.rec, 2, 1, true),
  ],
  equil: (c) => [
    P('Water rinse', 'wash', 3, 'CV', 0, 0, c.rec, 0, 2, true),
    P('Equilibration', 'equil', 5, 'CV', 0, 0, c.rec, 0, 1, true),
  ],
}

export function templateFor(app: ApplicationId, column: Column): Phase[] {
  return TEMPLATES[app](column)
}

/** Phase selected after loading a template: the first elution, otherwise the first phase. */
export function defaultSelection(phases: readonly Phase[]): number {
  return Math.max(0, phases.findIndex((p) => p.type === 'elution'))
}

export function defaultMethodName(app: ApplicationId, column: Column): string {
  const short = APPLICATIONS.find((a) => a.id === app)?.short ?? app
  return `${short}_${column.name.replace(/[^A-Za-z0-9]+/g, '')}`
}

/** Phase inserted by "Add phase after selected". */
export function newPhaseAfter(selected: Phase): Phase {
  return P('New phase', 'wash', 5, 'CV', selected.b1, selected.b1, selected.flow, 0, selected.inlet, false)
}

/** Phase inserted by "Add phase before": runs at the selected phase's start %B, so no %B step appears. */
export function newPhaseBefore(selected: Phase): Phase {
  return P('New phase', 'wash', 5, 'CV', selected.b0, selected.b0, selected.flow, 0, selected.inlet, false)
}
