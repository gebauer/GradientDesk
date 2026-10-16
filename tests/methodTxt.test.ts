import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { columnsFor, SEED_COLUMNS } from '../src/domain/columns'
import { escapeValue, fromMethodTxt, methodBlock, toMethodTxt, unescapeValue } from '../src/domain/methodTxt'
import { toPrimeViewTxt } from '../src/domain/primeview'
import { APPLICATIONS, retypePatch, templateFor } from '../src/domain/templates'
import type { Column, Method } from '../src/domain/types'

const golden = (name: string) => readFileSync(resolve(process.cwd(), 'tests/golden', name), 'utf8')
const histrap5 = SEED_COLUMNS.find((c) => c.id === 'histrap-hp-5-ml') as Column
const info = { version: '0.1.0', author: 'Jan Gebauer' }

/** The file has no timestamp, so imported methods carry the epoch. */
const method = (o: Partial<Method> = {}): Method => ({
  format: 'gradientdesk',
  version: 2,
  name: 'IMAC_HisTrapHP5ml',
  application: 'imac',
  system: 'AKTAprime',
  column: histrap5,
  phases: templateFor('imac', histrap5),
  modified: new Date(0).toISOString(),
  ...o,
})

const imported = (txt: string) => {
  const r = fromMethodTxt(txt)
  if (r.kind !== 'method') throw new Error(`expected the method block: ${r.warnings.join(' ')}`)
  return r.method
}

describe('method block', () => {
  test('matches the GradientDesk reference file byte for byte', () => {
    expect(toMethodTxt(method(), info)).toBe(golden('gradientdesk-imac-method.txt'))
  })

  test('comes after the breakpoint table, which stays the plain PrimeView dump', () => {
    const txt = toMethodTxt(method(), info)
    const dump = toPrimeViewTxt(method().phases, histrap5, info)
    expect(txt.startsWith(dump)).toBe(true)
    expect(txt.slice(dump.length).split('\r\n').filter(Boolean).every((l) => l.startsWith('**'))).toBe(true)
  })

  test('is ASCII with CRLF on every line', () => {
    const txt = toMethodTxt(method({ name: 'Jürgen 李 \\ test' }), info)
    expect([...txt].every((ch) => ch.charCodeAt(0) < 128)).toBe(true)
    expect(txt.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    expect(txt.endsWith('*\r\n')).toBe(true)
  })

  test('escapes backslash, non-ASCII and outer spaces losslessly', () => {
    for (const s of ['plain', 'Jürgen Müßig', 'a\\b', ' padded ', '李 🧪', 'x = y', '']) {
      expect(unescapeValue(escapeValue(s))).toBe(s)
    }
    expect(escapeValue('Ä\\')).toBe('\\u00c4\\\\')
  })

  test('one section per phase', () => {
    expect(methodBlock(method()).filter((l) => /^\*\* \[phase \d+\]$/.test(l))).toHaveLength(6)
  })
})

describe('re-import from the method block', () => {
  test('every template on every listed column restores the method exactly', () => {
    for (const app of APPLICATIONS) {
      for (const c of columnsFor(app.id, SEED_COLUMNS)) {
        const m = method({ application: app.id, column: c, phases: templateFor(app.id, c), name: `${app.id} ${c.name}` })
        expect(imported(toMethodTxt(m)), `${app.id} / ${c.name}`).toEqual(m)
      }
    }
  })

  test('custom column without max flow, odd names, every injection valve', () => {
    const c: Column = { id: 'my-col', name: 'Säule = 2 ml', manufacturer: '', cv: 2, flow: null, rec: 1, p: 0.3, apps: [], note: 'from the lab, see µ notes', custom: true }
    const phases = templateFor('general', c).map((p, i) => ({ ...p, name: ` ${p.name} ✓`, inj: (['Load', 'Inject', 'Waste'] as const)[i % 3] }))
    const m = method({ name: 'Méthode 1', application: 'general', column: c, phases })
    expect(imported(toMethodTxt(m, info))).toEqual(m)
  })

  test('a pump wash keeps its lines', () => {
    const wash = { ...templateFor('general', histrap5)[0], ...retypePatch(templateFor('general', histrap5)[0], 'pumpwash'), name: 'Pump wash', lines: ['B' as const, 'A8' as const, 'A2' as const] }
    const m = method({ phases: [wash, ...templateFor('imac', histrap5)] })
    expect(methodBlock(m)).toContain('** lines = B, A8, A2')
    expect(imported(toMethodTxt(m))).toEqual(m)
  })

  test('without the block, the table is imported as before', () => {
    const r = fromMethodTxt(golden('sample-imac-gradient.txt'))
    expect(r.kind).toBe('phases')
    expect(r.warnings).toEqual([])
  })

  test('accepts LF line endings and unpadded rows', () => {
    const txt = toMethodTxt(method()).replace(/\r\n/g, '\n').replace(/^(,.*)$/gm, (l) => l.replace(/ +/g, ''))
    expect(imported(txt)).toEqual(method())
  })

  test('a table edited outside GradientDesk wins over the block, with a message', () => {
    const txt = toMethodTxt(method()).replace(',2   ,25.0    ,0   ,1.0  ', ',2   ,25.0    ,0   ,2.0  ')
    const r = fromMethodTxt(txt)
    expect(r.kind).toBe('phases')
    expect(r.warnings[0]).toContain('changed outside GradientDesk')
  })

  test('an unreadable block falls back to the table, with a message', () => {
    const txt = toMethodTxt(method()).replace('** format = gradientdesk', '** format = other')
    const r = fromMethodTxt(txt)
    expect(r.kind).toBe('phases')
    expect(r.warnings[0]).toContain('could not be read')
  })
})
