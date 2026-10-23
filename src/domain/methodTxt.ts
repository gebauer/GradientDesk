import { pressureOf, sortLines, stdFlowOf } from './calc'
import { fromMethodFile, MethodImportError, readLines, readMethodHead } from './methodJson'
import { fromPrimeViewTxt, MAX_LINE, maxPressureKpa, toPrimeViewTxt, type ExportInfo } from './primeview'
import { PHASE_TYPES } from './templates'
import type { Method, Phase, PhaseType } from './types'

/**
 * The .txt file GradientDesk writes: the PrimeView method dump with a method block in its comment
 * header. The breakpoint table is the source of truth; the block adds only what the table can't
 * hold (method name, application, column, phase names, types, units, CV lengths, Default flow,
 * pump wash lines) and a checksum of the table, so a re-import notices a table edited elsewhere.
 * PrimeView allows comments only before the breakpoint table and no line over 100 characters,
 * so the block is compact and wraps at MAX_LINE. Spec: docs/primeview-format.md §11.
 */

const MARKER = '** GradientDesk method'
/** Block format: version 4 holds what the table can't; versions 1–3 held the whole method file. */
const BLOCK_VERSION = 4
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

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

/** CRC-32 (IEEE) of an ASCII string as 8 hex digits. */
export function crc32(s: string): string {
  let c = 0xffffffff
  for (let i = 0; i < s.length; i++) c = CRC_TABLE[(c ^ s.charCodeAt(i)) & 0xff] ^ (c >>> 8)
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')
}

const tableRows = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((l) => l.trimStart().startsWith(','))
    .map((l) => l.replace(/\s+/g, ''))

const pressureLine = (text: string) => text.split(/\r?\n/).find((l) => /^Max pressure\b/.test(l))

/** Checksum of what the method block relies on: the Max pressure line and the breakpoint rows, without spaces. */
export function tableChecksum(text: string): string {
  return crc32([(pressureLine(text) ?? '').replace(/\s+/g, ''), ...tableRows(text)].join('\n'))
}

/** The method block for the header, every line at most MAX_LINE characters. `table`: the table's checksum. */
export function methodBlock(m: Method, table: string): string[] {
  const c = m.column
  return [
    MARKER,
    ...section('method', { format: 'gradientdesk', version: BLOCK_VERSION, name: m.name, application: m.application, standardFlow: m.stdFlow, pressureLimit: m.pressure, table }),
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
    ...m.phases.flatMap((p, i) =>
      section(`phase ${i + 1}`, {
        name: p.name,
        type: p.type,
        unit: p.unit,
        // The table has the length in ml, rounded to 0.1; a CV length keeps the planned value.
        length: p.unit === 'CV' ? p.len : undefined,
        flowDefault: p.flowStd,
        lines: p.type === 'pumpwash' ? sortLines(p.lines ?? []) : undefined,
      }),
    ),
  ]
}

/** PrimeView dump with the method block in the header. */
export function toMethodTxt(m: Method, info?: ExportInfo): string {
  // Max pressure in the file is the method's pressure limit.
  const column = { ...m.column, p: pressureOf(m) }
  const table = tableChecksum(toPrimeViewTxt(m.phases, column))
  return toPrimeViewTxt(m.phases, column, info, methodBlock(m, table))
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
  /**
   * The block was read: the full method when the table is unchanged, otherwise the table's phases
   * with name, application and column from the block (and a warning).
   */
  | { kind: 'method'; method: Method; warnings: string[] }
  /** Only the breakpoint table: no block, or one that can't be read. */
  | { kind: 'phases'; phases: Phase[]; warnings: string[] }

const CHANGED =
  'The breakpoint table was changed outside GradientDesk: the phases were read from the table, name, application and column from the GradientDesk block.'

const num = (x: unknown): number => (typeof x === 'string' ? parseFloat(x) : NaN)

/**
 * Lays the block's phase data over the phases read from the table, in order; a pump wash takes one
 * table phase per line. Null when they don't line up.
 */
function overlay(head: Omit<Method, 'phases'>, metas: readonly Record<string, unknown>[], rows: readonly Phase[]): Phase[] | null {
  const out: Phase[] = []
  let k = 0
  for (const meta of metas) {
    const type: PhaseType = PHASE_TYPES.some((t) => t.id === meta.type) ? (meta.type as PhaseType) : 'wash'
    const lines = type === 'pumpwash' ? readLines(meta.lines) : undefined
    const n = lines ? lines.length : 1
    const segs = rows.slice(k, k + n)
    if (n === 0 || segs.length < n) return null
    k += n
    // The table import guesses a pump wash line from Waste at 0 / 100 %B; the block's type decides.
    const { lines: _guessed, ...first } = segs[0]
    const unit = meta.unit === 'CV' ? 'CV' : 'ml'
    const cv = num(meta.length)
    const flowStd = meta.flowDefault === true
    const phase: Phase = {
      ...first,
      name: typeof meta.name === 'string' && meta.name.trim() ? meta.name : first.name,
      type,
      len: unit === 'CV' ? (cv > 0 ? cv : first.len / head.column.cv) : first.len,
      unit,
      flow: flowStd ? stdFlowOf(head) : first.flow,
      flowStd,
    }
    // A pump wash runs its lines at 100 / 0 %B; line B carries the phase's inlet.
    out.push(lines ? { ...phase, b1: first.b0, grad: false, inlet: lines[0] === 'B' ? first.inlet : 1, lines } : phase)
  }
  return k === rows.length ? out : null
}

/** The table's Max pressure as a pressure limit: null when it is the column's value or missing. */
function tablePressure(text: string, head: Omit<Method, 'phases'>): number | null {
  const kpa = parseFloat(pressureLine(text)?.split(',')[1] ?? '')
  if (!Number.isFinite(kpa)) return head.pressure
  return kpa === maxPressureKpa(head.column) ? null : kpa / 1000
}

/**
 * Imports a .txt. With a GradientDesk block and an unchanged table, the full method; with a changed
 * table, the table's phases and the block's name, application and column. Throws MethodImportError.
 */
export function fromMethodTxt(text: string): TxtImport {
  const table = fromPrimeViewTxt(text)
  const block = readMethodBlock(text)
  if (!block) return { kind: 'phases', ...table }
  let head: Omit<Method, 'phases'>
  let method: Method | null
  try {
    head = readMethodHead(block, BLOCK_VERSION)
    const metas = block.phases as Record<string, unknown>[]
    if (num(block.version) < BLOCK_VERSION) method = fromMethodFile(block)
    else {
      if (metas.length === 0) throw new MethodImportError('The block has no phases.')
      const phases = block.table === tableChecksum(text) ? overlay(head, metas, table.phases) : null
      method = phases && { ...head, phases }
    }
  } catch {
    return { kind: 'phases', phases: table.phases, warnings: ['The GradientDesk block could not be read; the breakpoint table was imported.', ...table.warnings] }
  }
  // The block must give back exactly the file's breakpoints (older blocks have no checksum).
  const expected = method && tableRows(toPrimeViewTxt(method.phases, { ...method.column, p: pressureOf(method) }))
  const actual = tableRows(text)
  if (method && expected && expected.length === actual.length && expected.every((r, i) => r === actual[i])) {
    return { kind: 'method', method, warnings: [] }
  }
  const fallback: Method = { ...head, pressure: tablePressure(text, head), phases: table.phases }
  return { kind: 'method', method: fallback, warnings: [CHANGED, ...table.warnings] }
}
