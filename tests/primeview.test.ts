import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { breakpoints } from '../src/domain/calc'
import { SEED_COLUMNS } from '../src/domain/columns'
import { fromPrimeViewTxt, maxPressureKpa, toPrimeViewTxt } from '../src/domain/primeview'
import { APPLICATIONS, templateFor } from '../src/domain/templates'
import type { Column, Phase } from '../src/domain/types'

const golden = (name: string) => readFileSync(resolve(process.cwd(), 'tests/golden', name), 'utf8')

const P = (o: Partial<Phase>): Phase => ({
  name: 'P', type: 'wash', len: 1, unit: 'ml', b0: 0, b1: 0, grad: false, flow: 1, frac: 0, inlet: 1, az: false, ...o,
})

/** The method behind tests/golden/sample-imac-gradient.txt. */
const samplePhases: Phase[] = [
  P({ name: 'Equilibration', type: 'equil', len: 2 }),
  P({ name: 'Sample application', type: 'sample', len: 15, inlet: 8, az: true }),
  P({ name: 'Wash', type: 'wash', len: 14 }),
  P({ name: 'Elution', type: 'elution', len: 70, b1: 100, grad: true, frac: 1.5 }),
]
const lowPressureColumn: Column = { id: 'x', name: 'X', manufacturer: '', cv: 1, flow: 4, rec: 1, p: 0.1, apps: [] }

describe('export', () => {
  test('matches the PrimeView sample byte for byte', () => {
    expect(toPrimeViewTxt(samplePhases, lowPressureColumn)).toBe(golden('sample-imac-gradient.txt'))
  })

  test('uses CRLF, no tabs', () => {
    const txt = toPrimeViewTxt(samplePhases, lowPressureColumn)
    expect(txt).not.toContain('\t')
    expect(txt.split('\r\n').every((l) => !l.includes('\n'))).toBe(true)
  })

  test('max pressure is the column limit in kPa, capped at the system limit', () => {
    expect(maxPressureKpa({ ...lowPressureColumn, p: 0.5 })).toBe(500)
    expect(maxPressureKpa({ ...lowPressureColumn, p: 4 })).toBe(1000)
  })

  test('rounds %B to whole numbers and flow to 0.1', () => {
    const txt = toPrimeViewTxt([P({ len: 10, b0: 12.6, b1: 12.6, flow: 0.25 })], lowPressureColumn)
    expect(txt).toContain(',1   ,0.0     ,13  ,0.3  ,0.0   ,1   ,Load  ,0     ,N       ,N')
  })
})

describe('breakpoints', () => {
  test('a %B step adds an end breakpoint at the same volume', () => {
    const bps = breakpoints([P({ len: 5, b0: 100, b1: 100 }), P({ len: 5 })], lowPressureColumn)
    expect(bps.map((b) => [b.volume, b.conc])).toEqual([[0, 100], [5, 100], [5, 0], [10, 0]])
  })

  test('continuous %B needs no end breakpoint', () => {
    expect(breakpoints(samplePhases, lowPressureColumn)).toHaveLength(5)
  })
})

describe('import', () => {
  test('reads the PrimeView sample into phases', () => {
    const { phases, warnings } = fromPrimeViewTxt(golden('sample-imac-gradient.txt'))
    expect(phases).toEqual(samplePhases)
    expect(warnings).toEqual([])
  })

  test('accepts LF line endings', () => {
    expect(fromPrimeViewTxt(golden('sample-imac-gradient.txt').replace(/\r\n/g, '\n')).phases).toHaveLength(4)
  })

  test('every template on every listed column survives export → import → export', () => {
    for (const app of APPLICATIONS) {
      for (const c of SEED_COLUMNS.filter((x) => app.id === 'equil' || x.apps.includes(app.id))) {
        const txt = toPrimeViewTxt(templateFor(app.id, c), c)
        const back = fromPrimeViewTxt(txt)
        expect(toPrimeViewTxt(back.phases, c), `${app.id} / ${c.name}`).toBe(txt)
      }
    }
  })

  test('reports what it drops', () => {
    const txt = golden('sample-imac-gradient.txt').replace(',8   ,Load  ,0     ,Y       ,N', ',8   ,Inject,5     ,Y       ,Y')
    expect(fromPrimeViewTxt(txt).warnings).toHaveLength(3)
  })

  test('rejects files it cannot read', () => {
    expect(() => fromPrimeViewTxt('hello')).toThrow('No breakpoint table')
    expect(() => fromPrimeViewTxt(golden('sample-imac-gradient.txt').replace('Method base        ,ml', 'Method base        ,min'))).toThrow('volume-based')
    expect(() => fromPrimeViewTxt(golden('sample-imac-gradient.txt').replace(',17.0 ', ',1.0  '))).toThrow('must not decrease')
  })
})
