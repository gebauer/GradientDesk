import { breakpoints } from './calc'
import { SYSTEM_MAX_PRESSURE } from './columns'
import { MethodImportError } from './methodJson'
import { PHASE_TYPES } from './templates'
import type { Column, Inlet, Phase, PhaseType } from './types'

/**
 * ÄKTA prime "Method Dump" text file (AKTAprime V2.02, dump format V1.00), as written by PrimeView.
 * Spec: docs/primeview-format.md. Reference: tests/golden/sample-imac-gradient.txt.
 * ASCII, CRLF on every line, space-padded fields that each start with a comma.
 */

const CRLF = '\r\n'

export const APP_URL = 'gradientdesk.xcience.net'
export const REPO_URL = 'github.com/gebauer/GradientDesk'

export interface ExportInfo {
  /** GradientDesk version, e.g. "0.1.0" */
  version: string
  /** Author name; empty keeps the line as a spot to fill in by hand. */
  author: string
}

/** Comment lines (`**`) are ignored by PrimeView, so the credit lines live inside the comment header. */
function header(info: ExportInfo): string[] {
  return [
    '',
    '*****************************************************************',
    '** Method Dump',
    '**',
    '** AKTAprime   Ver  , V2.02               ',
    '**',
    '** Dump Format Ver  , V1.00               ',
    '**',
    `** Created with     , GradientDesk v${toAscii(info.version)} (${APP_URL}, ${REPO_URL})`,
    `** Created by       , ${toAscii(info.author)}`.trimEnd(),
    '**',
    '*****************************************************************',
    '',
    '',
  ]
}

const TRANSLIT: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' }

/** The file must be ASCII: transliterate German umlauts, drop other accents, replace the rest with "?". */
export function toAscii(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[äöüÄÖÜß]/g, (c) => TRANSLIT[c])
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '?')
    .trim()
}

/** Field widths including the leading comma; the last field (Eventmark) is not padded. */
const WIDTHS = [5, 9, 5, 6, 7, 5, 7, 7, 9]
const COLUMNS = ['Brkp', 'Volume', 'Conc', 'Flow', 'Frac', 'Buff', 'Inj', 'Peak', 'Autozero', 'Eventmark']

const setting = (key: string, value: string) => `${key.padEnd(19)},${value}`

function row(fields: string[]): string {
  return fields.map((f, i) => (i < WIDTHS.length ? `,${f}`.padEnd(WIDTHS[i]) : `,${f}`)).join('')
}

/** Max pressure alarm in kPa: the column limit, capped by the system limit. */
/** PrimeView method slots: PrimeMeth_001.txt … PrimeMeth_099.txt in C:\UNICORN\Bin\Prime\. */
export const MAX_SLOT = 99

export function primeFileName(slot: number): string {
  return `PrimeMeth_${String(slot).padStart(3, '0')}.txt`
}

/** Slot number from a PrimeView file name, or null. */
export function slotFromFileName(name: string): number | null {
  const m = /^PrimeMeth_(\d{3})\.txt$/i.exec(name)
  const n = m ? Number(m[1]) : NaN
  return n >= 1 && n <= MAX_SLOT ? n : null
}

export function maxPressureKpa(column: Column): number {
  return Math.round(Math.min(column.p, SYSTEM_MAX_PRESSURE) * 1000)
}

export function toPrimeViewTxt(phases: readonly Phase[], column: Column, info: ExportInfo = { version: '0.0.0', author: '' }): string {
  const bps = breakpoints(phases, column)
  const lines = [
    ...header(info),
    '******************',
    '** Method Settings',
    '******************',
    setting('Method Type', '-'),
    setting('Method', '-'),
    setting('Method base', 'ml'),
    setting('Frac base', 'ml'),
    setting('Max pressure (kPa)', String(maxPressureKpa(column))),
    setting('Alarm (min/ml)', '0.0'),
    '',
    '*********************',
    '** Method Breakpoints',
    '*********************',
    ' '.repeat(21),
    COLUMNS.map((c, i) => (i < WIDTHS.length ? c.padEnd(WIDTHS[i]) : c)).join(''),
    `${' '.repeat(42)}(mAu/min)`,
    '',
    ...bps.map((b, i) =>
      row([
        String(i + 1),
        b.volume.toFixed(1),
        String(Math.round(b.conc)),
        b.flow.toFixed(1),
        b.frac.toFixed(1),
        String(b.inlet),
        'Load',
        '0',
        b.az ? 'Y' : 'N',
        'N',
      ]),
    ),
  ]
  return lines.join(CRLF) + CRLF
}

export interface PrimeViewImport {
  phases: Phase[]
  /** Things in the file that GradientDesk can't represent and dropped. */
  warnings: string[]
}

interface Row {
  v: number
  conc: number
  flow: number
  frac: number
  inlet: Inlet
  inject: boolean
  peak: number
  az: boolean
  mark: boolean
}

const typeName = (t: PhaseType) => PHASE_TYPES.find((x) => x.id === t)?.name ?? t
const round1 = (x: number) => Math.round(x * 10) / 10

function guessType(r: Row, b1: number, first: boolean): PhaseType {
  if (r.inlet === 8 || r.inject) return 'sample'
  if (r.conc !== b1) return 'elution'
  if (r.conc >= 99) return 'strip'
  return first ? 'equil' : 'wash'
}

/** Parses a method dump into phases (lengths in ml). Throws MethodImportError with a user-facing message. */
export function fromPrimeViewTxt(text: string): PrimeViewImport {
  const lines = text.split(/\r?\n/)
  const base = lines.find((l) => /^Method base\s*,/.test(l))
  if (base && base.split(',')[1]?.trim().toLowerCase() !== 'ml') {
    throw new MethodImportError('Only volume-based methods (Method base ml) are supported.')
  }

  const hi = lines.findIndex((l) => /^\s*Brkp\b/.test(l))
  if (hi < 0) throw new MethodImportError('No breakpoint table found.')
  const names = lines[hi].trim().split(/\s+/).map((n) => n.toLowerCase())
  const col = (name: string) => names.indexOf(name)
  const idx = { v: col('volume'), conc: col('conc'), flow: col('flow'), frac: col('frac'), buff: col('buff'), inj: col('inj'), peak: col('peak'), az: col('autozero'), mark: col('eventmark') }
  if (idx.v < 0 || idx.conc < 0 || idx.flow < 0) throw new MethodImportError('The breakpoint table needs Volume, Conc and Flow columns.')

  const rows: Row[] = lines
    .slice(hi + 1)
    .filter((l) => l.trimStart().startsWith(','))
    .map((l, n) => {
      const f = l.trimStart().slice(1).split(',').map((x) => x.trim())
      const get = (i: number) => (i >= 0 ? (f[i] ?? '') : '')
      const num = (i: number, fallback: number) => {
        const s = get(i)
        if (s === '') return fallback
        const x = Number(s)
        if (!Number.isFinite(x)) throw new MethodImportError(`Breakpoint ${n + 1}: "${s}" is not a number.`)
        return x
      }
      const inlet = Math.round(num(idx.buff, 1))
      return {
        v: num(idx.v, NaN),
        conc: num(idx.conc, 0),
        flow: num(idx.flow, 1),
        frac: num(idx.frac, 0),
        inlet: Math.min(8, Math.max(1, inlet)) as Inlet,
        inject: /^inj/i.test(get(idx.inj)),
        peak: num(idx.peak, 0),
        az: /^y/i.test(get(idx.az)),
        mark: /^y/i.test(get(idx.mark)),
      }
    })

  if (rows.length < 2) throw new MethodImportError('The method needs at least two breakpoints.')
  rows.forEach((r, i) => {
    if (!Number.isFinite(r.v)) throw new MethodImportError(`Breakpoint ${i + 1} has no volume.`)
    if (i === 0 && r.v !== 0) throw new MethodImportError('The first breakpoint must be at 0.0 ml.')
    if (i > 0 && r.v <= rows[i - 1].v) throw new MethodImportError(`Breakpoint ${i + 1}: volumes must increase.`)
  })

  const phases: Phase[] = []
  /** Start volume carried over from a folded %B step segment. */
  let carry: number | null = null
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]
    const b = rows[i + 1]
    const prev = phases.at(-1)
    // A %B step is written as A's end breakpoint followed by B's start at +0.1 ml (docs/primeview-format.md §10).
    const isStep =
      prev !== undefined &&
      i < rows.length - 2 &&
      b.v - a.v <= 0.1 + 1e-9 &&
      a.conc !== b.conc &&
      !a.az &&
      !a.inject &&
      a.conc === prev.b1 &&
      a.flow === prev.flow &&
      a.frac === prev.frac &&
      a.inlet === prev.inlet
    if (isStep) {
      carry = a.v
      continue
    }
    const type = guessType(a, b.conc, phases.length === 0)
    phases.push({
      name: typeName(type),
      type,
      len: round1(b.v - (carry ?? a.v)),
      unit: 'ml',
      b0: a.conc,
      b1: b.conc,
      grad: a.conc !== b.conc,
      flow: a.flow,
      frac: a.frac,
      inlet: a.inlet,
      az: a.az,
    })
    carry = null
  }

  const warnings: string[] = []
  if (rows.some((r) => r.inject)) warnings.push('Injection valve positions (Inj) were not imported.')
  if (rows.some((r) => r.peak !== 0)) warnings.push('Peak fractionation settings were not imported.')
  if (rows.some((r) => r.mark)) warnings.push('Event marks were not imported.')
  return { phases, warnings }
}
