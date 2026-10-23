import { columnId, customRecFlow } from './columns'
import { endB, PUMP_LINES, sortLines } from './calc'
import { defaultInj, INJECT_VALVES, PUMP_WASH_LINES } from './templates'
import type { ApplicationId, Column, Inlet, InjectValve, Method, Phase, PhaseType, PumpLine } from './types'

/**
 * Method file format, version 3 (docs/SPEC.md "Method data"): stored in localStorage as JSON and
 * written into the .txt method block. Migrations on import:
 * - version 1 had no `injection`: each phase gets its type's default.
 * - versions 1–2 had no standard flow: `standardFlow` and `pressureLimit` are null (the column's
 *   values), and phases at the column's recommended flow get `flowDefault`.
 */
export interface MethodFile {
  format: 'gradientdesk'
  version: 3
  name: string
  application: ApplicationId
  system: 'AKTAprime'
  column: Column
  /** ml/min; null = the column's recommended flow */
  standardFlow: number | null
  /** MPa; null = the column's pressure limit */
  pressureLimit: number | null
  phases: {
    name: string
    type: PhaseType
    length: number
    unit: 'CV' | 'ml'
    startB: number
    endB: number
    gradient: boolean
    flow: number
    flowDefault: boolean
    fraction: number
    inletA: number
    injection: InjectValve
    autozero: boolean
    /** Pump wash only. */
    lines?: PumpLine[]
  }[]
  modified: string
}

export const CURRENT_VERSION = 3

const APP_IDS: readonly ApplicationId[] = ['general', 'preloaded', 'pumpload', 'imac', 'affinity', 'iex', 'hic', 'sec', 'equil']
const PHASE_TYPES: readonly PhaseType[] = ['equil', 'sample', 'wash', 'elution', 'strip', 'pumpwash']

export class MethodImportError extends Error {}

export function toMethodFile(m: Method): MethodFile {
  return {
    format: 'gradientdesk',
    version: 3,
    name: m.name,
    application: m.application,
    system: 'AKTAprime',
    column: m.column,
    standardFlow: m.stdFlow,
    pressureLimit: m.pressure,
    phases: m.phases.map((p) => ({
      name: p.name,
      type: p.type,
      length: p.len,
      unit: p.unit,
      startB: p.b0,
      endB: endB(p),
      gradient: p.grad,
      flow: p.flow,
      flowDefault: p.flowStd,
      fraction: p.frac,
      inletA: p.inlet,
      injection: p.inj,
      autozero: p.az,
      ...(p.type === 'pumpwash' ? { lines: sortLines(p.lines ?? []) } : {}),
    })),
    modified: m.modified,
  }
}

export function toJson(m: Method): string {
  return JSON.stringify(toMethodFile(m), null, 2)
}

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const num = (x: unknown, fallback = 0): number => {
  const n = typeof x === 'number' ? x : typeof x === 'string' ? parseFloat(x) : NaN
  return Number.isFinite(n) ? n : fallback
}
const str = (x: unknown, fallback: string): string => (typeof x === 'string' && x.trim() ? x : fallback)

function readColumn(x: unknown): Column {
  if (!isObj(x)) throw new MethodImportError('The file has no column.')
  const name = str(x.name, 'Imported column')
  const flow = x.flow === null || x.flow === undefined ? null : num(x.flow)
  const col: Column = {
    id: str(x.id, columnId(name)),
    name,
    manufacturer: str(x.manufacturer, ''),
    cv: num(x.cv),
    flow,
    rec: num(x.rec) || (flow ? customRecFlow(flow) : 1),
    p: num(x.p) || 0.5,
    apps: Array.isArray(x.apps) ? x.apps.filter((a): a is ApplicationId => APP_IDS.includes(a as ApplicationId)) : [],
  }
  if (x.recEstimated === true) col.recEstimated = true
  if (typeof x.note === 'string') col.note = x.note
  if (x.custom === true) col.custom = true
  return col
}

/** `recFlow`: the column's recommended flow, for files from before `flowDefault`. */
function readPhase(x: unknown, i: number, recFlow: number): Phase {
  if (!isObj(x)) throw new MethodImportError(`Phase ${i + 1} is not valid.`)
  const flow = num(x.flow) || 1
  const b0 = num(x.startB)
  const b1 = num(x.endB, b0)
  const inlet = Math.round(num(x.inletA, 1))
  const type = PHASE_TYPES.includes(x.type as PhaseType) ? (x.type as PhaseType) : 'wash'
  return {
    name: str(x.name, 'Phase'),
    type,
    len: num(x.length),
    unit: x.unit === 'CV' ? 'CV' : 'ml',
    b0,
    b1,
    grad: typeof x.gradient === 'boolean' ? x.gradient : b0 !== b1,
    flow,
    flowStd: typeof x.flowDefault === 'boolean' ? x.flowDefault : flow === recFlow,
    frac: num(x.fraction),
    inlet: Math.min(8, Math.max(1, inlet)) as Inlet,
    inj: INJECT_VALVES.includes(x.injection as InjectValve) ? (x.injection as InjectValve) : defaultInj(type),
    az: x.autozero === true,
    ...(type === 'pumpwash' ? { lines: readLines(x.lines) } : {}),
  }
}

function readLines(x: unknown): PumpLine[] {
  if (!Array.isArray(x)) return [...PUMP_WASH_LINES]
  return sortLines(x.filter((l): l is PumpLine => PUMP_LINES.includes(l as PumpLine)))
}

/** Parses a method file. Throws MethodImportError with a user-facing message. */
export function fromJson(text: string): Method {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new MethodImportError('The file is not valid JSON.')
  }
  return fromMethodFile(data)
}

/** Reads a parsed method file (from JSON or the .txt method block), migrating older versions. */
export function fromMethodFile(data: unknown): Method {
  if (!isObj(data) || data.format !== 'gradientdesk') throw new MethodImportError('This is not a GradientDesk method file.')
  const version = num(data.version)
  if (version > CURRENT_VERSION) throw new MethodImportError(`The file was made by a newer version of GradientDesk (format version ${version}).`)
  // Older versions: missing fields get their defaults in readPhase and below (see MethodFile).
  if (![1, 2, 3].includes(version)) throw new MethodImportError(`Unknown format version ${String(data.version)}.`)
  if (!Array.isArray(data.phases) || data.phases.length === 0) throw new MethodImportError('The file has no phases.')
  const column = readColumn(data.column)
  const positive = (x: unknown) => (x === null || x === undefined || x === 'none' ? null : num(x) > 0 ? num(x) : null)

  return {
    format: 'gradientdesk',
    version: 3,
    name: str(data.name, 'Imported method'),
    application: APP_IDS.includes(data.application as ApplicationId) ? (data.application as ApplicationId) : 'general',
    system: 'AKTAprime',
    column,
    stdFlow: positive(data.standardFlow),
    pressure: positive(data.pressureLimit),
    phases: data.phases.map((p, i) => readPhase(p, i, column.rec)),
    modified: str(data.modified, new Date(0).toISOString()),
  }
}

/**
 * Finds the imported column in the library: by id, then by name. Otherwise it becomes a new
 * custom column (needs a CV). Returns null when the column can't be matched or created.
 */
export function resolveColumn(col: Column, library: readonly Column[]): { column: Column; added: boolean } | null {
  const found = library.find((c) => c.id === col.id) ?? library.find((c) => c.name === col.name)
  if (found) return { column: found, added: false }
  if (!(col.cv > 0)) return null
  return { column: { ...col, apps: [], custom: true }, added: true }
}
