import { breakpoints } from './calc'
import { SYSTEM_MAX_PRESSURE } from './columns'
import { MethodImportError } from './methodJson'
import { PHASE_TYPES } from './templates'
import type { Column, Inlet, Phase, PhaseType } from './types'

/**
 * ÄKTA prime "Method Dump" text file (AKTAprime V2.02, dump format V1.00), as written by PrimeView.
 * Reference: tests/golden/sample-imac-gradient.txt. CRLF line endings, space-padded columns
 * where every field starts with a comma, trailing spaces are part of the format.
 */

const CRLF = '\r\n'

const HEADER = [
  '*****************************************************************',
  '** Method Dump',
  '**',
  '** AKTAprime   Ver  , V2.02               ',
  '**',
  '** Dump Format Ver  , V1.00               ',
  '**',
  '*****************************************************************',
  '',
  '',
]

/** Field widths including the leading comma; the last field (Eventmark) is not padded. */
const WIDTHS = [5, 9, 5, 6, 7, 5, 7, 7, 9]
const COLUMNS = ['Brkp', 'Volume', 'Conc', 'Flow', 'Frac', 'Buff', 'Inj', 'Peak', 'Autozero', 'Eventmark']

const setting = (key: string, value: string) => `${key.padEnd(19)},${value}`

function row(fields: string[]): string {
  return fields.map((f, i) => (i < WIDTHS.length ? `,${f}`.padEnd(WIDTHS[i]) : `,${f}`)).join('')
}

/** Max pressure alarm in kPa: the column limit, capped by the system limit. */
export function maxPressureKpa(column: Column): number {
  return Math.round(Math.min(column.p, SYSTEM_MAX_PRESSURE) * 1000)
}

export function toPrimeViewTxt(phases: readonly Phase[], column: Column): string {
  const bps = breakpoints(phases, column)
  const lines = [
    ...HEADER,
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
    if (i > 0 && r.v < rows[i - 1].v) throw new MethodImportError(`Breakpoint ${i + 1}: volumes must not decrease.`)
  })

  const phases: Phase[] = []
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]
    const b = rows[i + 1]
    if (b.v - a.v <= 1e-9) continue
    const type = guessType(a, b.conc, phases.length === 0)
    phases.push({
      name: typeName(type),
      type,
      len: round1(b.v - a.v),
      unit: 'ml',
      b0: a.conc,
      b1: b.conc,
      grad: a.conc !== b.conc,
      flow: a.flow,
      frac: a.frac,
      inlet: a.inlet,
      az: a.az,
    })
  }
  if (phases.length === 0) throw new MethodImportError('All breakpoints are at the same volume.')

  const warnings: string[] = []
  if (rows.some((r) => r.inject)) warnings.push('Injection valve positions (Inj) were not imported.')
  if (rows.some((r) => r.peak !== 0)) warnings.push('Peak fractionation settings were not imported.')
  if (rows.some((r) => r.mark)) warnings.push('Event marks were not imported.')
  return { phases, warnings }
}
