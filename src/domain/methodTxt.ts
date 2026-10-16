import { fromMethodFile, toMethodFile } from './methodJson'
import { fromPrimeViewTxt, MAX_LINE, toPrimeViewTxt, type ExportInfo } from './primeview'
import { pressureOf } from './calc'
import type { Method, Phase } from './types'

/**
 * The .txt file GradientDesk writes: the PrimeView method dump with the whole method (name,
 * application, column, phases) in its comment header, so a re-import restores it completely.
 * PrimeView allows comments only before the breakpoint table and no line over 100 characters,
 * so the block is compact and wraps at MAX_LINE. Spec: docs/primeview-format.md §11.
 */

const MARKER = '** GradientDesk method'
const BOOL_KEYS = new Set(['gradient', 'autozero', 'custom', 'recEstimated', 'flowDefault'])
const LIST_KEYS = new Set(['apps', 'lines'])
/** Prefix of a wrapped line. */
const CONT = '**   '

/**
 * Values must be ASCII and must not contain the entry separator: backslash, `;` and non-ASCII
 * become \\ and \uXXXX; leading/trailing spaces are kept as  .
 */
export function escapeValue(s: string): string {
  return s
    .replace(/\\|;|[^\x20-\x7e]/g, (c) => (c === '\\' ? '\\\\' : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`))
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

/** `key=value`, or for a value too long for one line `key=…` followed by `key+=…` pieces. */
function tokens(key: string, value: string): string[] {
  const room = MAX_LINE - CONT.length - key.length - 2
  if (value.length <= room) return [`${key}=${value}`]
  // Split between escapes, never inside one; spaces at a piece's ends are escaped so trimming keeps them.
  const atoms = value.match(/\\u[0-9a-fA-F]{4}|\\\\|[\s\S]/g) ?? []
  const pieces: string[] = []
  let piece = ''
  for (const a of atoms) {
    if (piece.length + a.length > room - 12) {
      pieces.push(piece)
      piece = ''
    }
    piece += a
  }
  pieces.push(piece)
  return pieces.map((p, i) => `${key}${i ? '+=' : '='}${p.replace(/^ | $/g, '\\u0020')}`)
}

/** `** [name] key=value; key=value; …`, wrapped onto `**   …` lines at MAX_LINE. */
function section(name: string, entries: Record<string, Value>): string[] {
  const out: string[] = []
  let line = `** [${name}]`
  let first = true
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined) continue
    for (const t of tokens(k, format(v))) {
      const next = `${line}${first ? ' ' : '; '}${t}`
      if (next.length <= MAX_LINE) line = next
      else {
        out.push(line)
        line = CONT + t
      }
      first = false
    }
  }
  return [...out, line]
}

/** The method block for the header, every line at most MAX_LINE characters. */
export function methodBlock(m: Method): string[] {
  const f = toMethodFile(m)
  const c = f.column
  return [
    MARKER,
    ...section('method', { format: f.format, version: f.version, name: f.name, application: f.application, standardFlow: f.standardFlow, pressureLimit: f.pressureLimit }),
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
  ]
}

/** PrimeView dump with the method block in the header. */
export function toMethodTxt(m: Method, info?: ExportInfo): string {
  // Max pressure in the file is the method's pressure limit.
  return toPrimeViewTxt(m.phases, { ...m.column, p: pressureOf(m) }, info, methodBlock(m))
}

function convert(section: string, key: string, raw: string): unknown {
  if (BOOL_KEYS.has(key)) return raw === 'yes'
  if (LIST_KEYS.has(key)) return raw.split(',').map((a) => unescapeValue(a.trim())).filter(Boolean)
  if (raw === 'none' && ((section === 'column' && key === 'flow') || key === 'standardFlow' || key === 'pressureLimit')) return null
  return unescapeValue(raw)
}

/**
 * Reads the method block into a method file object, or null when the file has none. Also reads
 * the older layout with one `** key = value` line per entry after the breakpoint table.
 */
export function readMethodBlock(text: string): Record<string, unknown> | null {
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => l.trimEnd() === MARKER)
  if (start < 0) return null
  const sections: { name: string; raw: Map<string, string> }[] = []
  let cur: (typeof sections)[number] | null = null
  for (const line of lines.slice(start + 1)) {
    // The header's closing rule ends the block (the older layout had a rule before its sections too).
    if (line.startsWith('***')) {
      if (sections.length) break
      continue
    }
    if (!line.startsWith('**')) continue
    let body = line.slice(2).trim()
    const head = /^\[([^\]]+)\]\s*(.*)$/.exec(body)
    if (head) {
      cur = { name: head[1].trim().toLowerCase(), raw: new Map() }
      sections.push(cur)
      body = head[2]
    }
    if (!cur) continue
    for (const entry of body.split(';')) {
      const eq = entry.indexOf('=')
      if (eq <= 0) continue
      const append = entry[eq - 1] === '+'
      const key = entry.slice(0, append ? eq - 1 : eq).trim()
      const raw = entry.slice(eq + 1).trim()
      if (key) cur.raw.set(key, append ? (cur.raw.get(key) ?? '') + raw : raw)
    }
  }
  const obj = (s: (typeof sections)[number]) => Object.fromEntries([...s.raw].map(([k, v]) => [k, convert(s.name, k, v)]))
  const data: Record<string, unknown> = {}
  const phases: Record<string, unknown>[] = []
  for (const s of sections) {
    if (s.name === 'method') Object.assign(data, obj(s))
    else if (s.name === 'column') data.column = obj(s)
    else if (/^phase \d+$/.test(s.name)) phases.push(obj(s))
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
