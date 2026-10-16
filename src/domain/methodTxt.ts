import { fromMethodFile, toMethodFile } from './methodJson'
import { fromPrimeViewTxt, toPrimeViewTxt, type ExportInfo } from './primeview'
import type { Method, Phase } from './types'

/**
 * The .txt file GradientDesk writes: the PrimeView method dump followed by a comment block in INI
 * style that holds the whole method (name, application, column, phases), so a re-import restores
 * it completely. Every line is a comment line (docs/primeview-format.md §2). Spec: §11.
 */

const CRLF = '\r\n'
const RULE = '*'.repeat(65)
const MARKER = '** GradientDesk method'
const BOOL_KEYS = new Set(['gradient', 'autozero', 'custom', 'recEstimated'])

/** Values must be ASCII: backslash and non-ASCII become \\ and \uXXXX; leading/trailing spaces are kept as  . */
export function escapeValue(s: string): string {
  return s
    .replace(/\\|[^\x20-\x7e]/g, (c) => (c === '\\' ? '\\\\' : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`))
    .replace(/^ +| +$/g, (m) => '\\u0020'.repeat(m.length))
}

export function unescapeValue(s: string): string {
  return s.replace(/\\(\\|u[0-9a-fA-F]{4})/g, (_, x: string) => (x === '\\' ? '\\' : String.fromCharCode(parseInt(x.slice(1), 16))))
}

type Value = string | number | boolean | null | readonly string[] | undefined

function format(v: Exclude<Value, undefined>): string {
  if (v === null) return 'none'
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return escapeValue(v)
  return v.map(escapeValue).join(', ')
}

function section(name: string, entries: Record<string, Value>): string[] {
  const lines = Object.entries(entries)
    .filter((e): e is [string, Exclude<Value, undefined>] => e[1] !== undefined)
    .map(([k, v]) => `** ${k} = ${format(v)}`.trimEnd())
  return [`** [${name}]`, ...lines, '**']
}

/** The method block, one line per entry (CRLF added by the caller). */
export function methodBlock(m: Method): string[] {
  const f = toMethodFile(m)
  const c = f.column
  return [
    RULE,
    MARKER,
    '** Everything GradientDesk needs to restore this method on import.',
    RULE,
    ...section('method', { format: f.format, version: f.version, name: f.name, application: f.application }),
    ...section('column', {
      id: c.id,
      name: c.name,
      manufacturer: c.manufacturer,
      cv: c.cv,
      flow: c.flow,
      rec: c.rec,
      recEstimated: c.recEstimated ? true : undefined,
      p: c.p,
      apps: c.apps,
      note: c.note,
      custom: c.custom ? true : undefined,
    }),
    ...f.phases.flatMap((p, i) => section(`phase ${i + 1}`, p)),
    RULE,
  ]
}

/** PrimeView dump plus the method block. */
export function toMethodTxt(m: Method, info?: ExportInfo): string {
  return toPrimeViewTxt(m.phases, m.column, info) + ['', ...methodBlock(m)].join(CRLF) + CRLF
}

/** Reads the method block into a method file object, or null when the file has none. */
export function readMethodBlock(text: string): Record<string, unknown> | null {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => l.trimEnd() === MARKER)
  if (start < 0) return null
  const data: Record<string, unknown> = {}
  const phases: Record<string, unknown>[] = []
  let current: Record<string, unknown> | null = null
  let name = ''
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('**')) continue
    const body = line.slice(2).trim()
    const head = /^\[(.+)\]$/.exec(body)
    if (head) {
      name = head[1].trim().toLowerCase()
      current = name === 'method' ? data : name === 'column' ? {} : /^phase \d+$/.test(name) ? {} : null
      if (name === 'column') data.column = current
      else if (current && name !== 'method') phases.push(current)
      continue
    }
    const eq = body.indexOf('=')
    if (!current || eq < 0) continue
    const key = body.slice(0, eq).trim()
    const raw = body.slice(eq + 1).trim()
    if (BOOL_KEYS.has(key)) current[key] = raw === 'yes'
    else if (key === 'apps' || key === 'lines') current[key] = raw.split(',').map((a) => unescapeValue(a.trim())).filter(Boolean)
    else if (name === 'column' && key === 'flow' && raw === 'none') current[key] = null
    else current[key] = unescapeValue(raw)
  }
  data.phases = phases
  return data
}

export type TxtImport =
  /** The method block was read and matches the breakpoint table. */
  | { kind: 'method'; method: Method; warnings: string[] }
  /** Only the breakpoint table: no block, an unreadable one, or one the table no longer matches. */
  | { kind: 'phases'; phases: Phase[]; warnings: string[] }

const tableRows = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((l) => l.trimStart().startsWith(','))
    .map((l) => l.replace(/\s+/g, ''))

/** Imports a .txt: the full method from the block when it matches the table, otherwise the table. Throws MethodImportError. */
export function fromMethodTxt(text: string): TxtImport {
  const table = fromPrimeViewTxt(text)
  const block = readMethodBlock(text)
  if (!block) return { kind: 'phases', ...table }
  let method: Method
  try {
    method = fromMethodFile(block)
  } catch {
    return { kind: 'phases', phases: table.phases, warnings: ['The GradientDesk block could not be read; the breakpoint table was imported.', ...table.warnings] }
  }
  const expected = tableRows(toPrimeViewTxt(method.phases, method.column))
  const actual = tableRows(text)
  if (expected.length !== actual.length || expected.some((r, i) => r !== actual[i])) {
    return {
      kind: 'phases',
      phases: table.phases,
      warnings: ['The breakpoint table was changed outside GradientDesk; it was imported without the GradientDesk block.', ...table.warnings],
    }
  }
  return { kind: 'method', method, warnings: [] }
}
