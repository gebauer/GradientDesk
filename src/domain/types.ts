export type ApplicationId = 'general' | 'preloaded' | 'imac' | 'affinity' | 'iex' | 'hic' | 'sec' | 'equil'

export type PhaseType = 'equil' | 'sample' | 'wash' | 'elution' | 'strip'

export type LengthUnit = 'CV' | 'ml'

export type Inlet = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

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
  /** Autozero at phase start. */
  az: boolean
}

export interface Column {
  id: string
  name: string
  manufacturer: string
  /** Column volume in ml. */
  cv: number
  /** Max flow in ml/min; null when the vendor gives no value (no clamping, no warning). */
  flow: number | null
  /** Default flow in ml/min used by templates. */
  rec: number
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
  az: boolean
  /** Index of the phase this breakpoint belongs to. */
  phase: number
}

export interface Method {
  format: 'gradientdesk'
  version: 1
  name: string
  application: ApplicationId
  system: 'AKTAprime'
  column: Column
  phases: Phase[]
  /** ISO timestamp */
  modified: string
}
