export type ApplicationId = 'general' | 'preloaded' | 'imac' | 'affinity' | 'iex' | 'hic' | 'sec' | 'equil'

export type PhaseType = 'equil' | 'sample' | 'wash' | 'elution' | 'strip' | 'pumpwash'

export type LengthUnit = 'CV' | 'ml'

export type Inlet = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** Injection valve position: Load (pump → column), Inject (pump → loop → column), Waste (pump → waste, column bypassed). */
export type InjectValve = 'Load' | 'Inject' | 'Waste'

/** Pump lines a pump wash can rinse: buffer B and inlets A1–A8. */
export type PumpLine = 'B' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7' | 'A8'

export interface Phase {
  name: string
  type: PhaseType
  /** Length in `unit`; converted to ml only for display, calculation and export. */
  len: number
  unit: LengthUnit
  /** %B at phase start and end (0–100). Equal when isocratic. */
  b0: number
  b1: number
  grad: boolean
  /** ml/min */
  flow: number
  /** Fraction size in ml; 0 = no fractions. */
  frac: number
  inlet: Inlet
  inj: InjectValve
  /** Autozero at phase start. */
  az: boolean
  /**
   * Pump wash only: the lines to rinse, in wash order (B, A8 … A1). The phase runs `len` ml per line;
   * %B and inlet come from the line (B: 100 %B on `inlet`, An: 0 %B on inlet n).
   */
  lines?: PumpLine[]
}

export interface Column {
  id: string
  name: string
  manufacturer: string
  /** Column volume in ml. */
  cv: number
  /** Max flow in ml/min; null when the vendor gives no value (no clamping, no warning). */
  flow: number | null
  /** Recommended flow in ml/min, used by templates. */
  rec: number
  /** rec is an estimate, not a vendor value. */
  recEstimated?: boolean
  /** Column pressure limit in MPa (lower of packed bed and hardware limit). */
  p: number
  /** Applications this column is listed under. "general", "preloaded" and "equil" list every column regardless. */
  apps: ApplicationId[]
  note?: string
  custom?: boolean
}

export interface Breakpoint {
  /** ml */
  volume: number
  /** %B */
  conc: number
  /** ml/min */
  flow: number
  /** ml; 0 = no fractions */
  frac: number
  inlet: Inlet
  inj: InjectValve
  az: boolean
  /** Index of the phase this breakpoint belongs to. */
  phase: number
}

export interface Method {
  format: 'gradientdesk'
  version: 2
  name: string
  application: ApplicationId
  system: 'AKTAprime'
  column: Column
  phases: Phase[]
  /** ISO timestamp */
  modified: string
}
