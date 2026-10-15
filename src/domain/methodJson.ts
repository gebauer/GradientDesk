import { columnId, customRecFlow } from './columns'
import { endB } from './calc'
import type { ApplicationId, Column, Inlet, Method, Phase, PhaseType } from './types'

/** Method file format, version 1 (docs/SPEC.md "Method JSON"). */
export interface MethodFileV1 {
  format: 'gradientdesk'
  version: 1
  name: string
  application: ApplicationId
  system: 'AKTAprime'
  column: Column
  phases: {
    name: string
    type: PhaseType
    length: number
    unit: 'CV' | 'ml'
    startB: number
    endB: number
    gradient: boolean
    flow: number
    fraction: number
    inletA: number
    autozero: boolean
  }[]
  modified: string
}

export const CURRENT_VERSION = 1

const APP_IDS: readonly ApplicationId[] = ['general', 'preloaded', 'imac', 'affinity', 'iex', 'hic', 'sec', 'equil']
const PHASE_TYPES: readonly PhaseType[] = ['equil', 'sample', 'wash', 'elution', 'strip']

export class MethodImportError extends Error {}

export function toMethodFile(m: Method): MethodFileV1 {
  return {
    format: 'gradientdesk',
    version: 1,
    name: m.name,
    application: m.application,
    system: 'AKTAprime',
    column: m.column,
    phases: m.phases.map((p) => ({
      name: p.name,
      type: p.type,
      length: p.len,
      unit: p.unit,
      startB: p.b0,
      endB: endB(p),
      gradient: p.grad,
      flow: p.flow,
      fraction: p.frac,
      inletA: p.inlet,
      autozero: p.az,
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
  if (typeof x.note === 'string') col.note = x.note
  if (x.custom === true) col.custom = true
  return col
}

function readPhase(x: unknown, i: number): Phase {
  if (!isObj(x)) throw new MethodImportError(`Phase ${i + 1} is not valid.`)
  const b0 = num(x.startB)
  const b1 = num(x.endB, b0)
  const inlet = Math.round(num(x.inletA, 1))
  return {
    name: str(x.name, 'Phase'),
    type: PHASE_TYPES.includes(x.type as PhaseType) ? (x.type as PhaseType) : 'wash',
    len: num(x.length),
    unit: x.unit === 'CV' ? 'CV' : 'ml',
    b0,
    b1,
    grad: typeof x.gradient === 'boolean' ? x.gradient : b0 !== b1,
    flow: num(x.flow) || 1,
    frac: num(x.fraction),
    inlet: Math.min(8, Math.max(1, inlet)) as Inlet,
    az: x.autozero === true,
  }
}

/** Parses a method file. Throws MethodImportError with a user-facing message. */
export function fromJson(text: string): Method {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new MethodImportError('The file is not valid JSON.')
  }
  if (!isObj(data) || data.format !== 'gradientdesk') throw new MethodImportError('This is not a GradientDesk method file.')
  const version = num(data.version)
  if (version > CURRENT_VERSION) throw new MethodImportError(`The file was made by a newer version of GradientDesk (format version ${version}).`)
  if (version !== 1) throw new MethodImportError(`Unknown format version ${String(data.version)}.`)
  if (!Array.isArray(data.phases) || data.phases.length === 0) throw new MethodImportError('The file has no phases.')

  return {
    format: 'gradientdesk',
    version: 1,
    name: str(data.name, 'Imported method'),
    application: APP_IDS.includes(data.application as ApplicationId) ? (data.application as ApplicationId) : 'general',
    system: 'AKTAprime',
    column: readColumn(data.column),
    phases: data.phases.map(readPhase),
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
