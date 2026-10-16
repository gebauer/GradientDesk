import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { breakpoints } from '../src/domain/calc'
import { columnsFor, SEED_COLUMNS } from '../src/domain/columns'
import { fromPrimeViewTxt, MAX_LINE, maxPressureKpa, primeFileName, slotFromFileName, toAscii, toPrimeViewTxt } from '../src/domain/primeview'
import { validateProgram } from '../src/domain/validate'
import { APPLICATIONS, templateFor } from '../src/domain/templates'
import type { Column, Phase } from '../src/domain/types'

const golden = (name: string) => readFileSync(resolve(process.cwd(), 'tests/golden', name), 'utf8')

const P = (o: Partial<Phase>): Phase => ({
  name: 'P', type: 'wash', len: 1, unit: 'ml', b0: 0, b1: 0, grad: false, flow: 1, flowStd: false, frac: 0, inlet: 1, inj: 'Load', az: false, ...o,
})

/** The method behind tests/golden/sample-imac-gradient.txt. */
const samplePhases: Phase[] = [
  P({ name: 'Equilibration', type: 'equil', len: 2 }),
  P({ name: 'Sample application', type: 'sample', len: 15, inlet: 8, inj: 'Load', az: true }),
  P({ name: 'Wash', type: 'wash', len: 14 }),
  P({ name: 'Elution', type: 'elution', len: 70, b1: 100, grad: true, frac: 1.5 }),
]
const lowPressureColumn: Column = { id: 'x', name: 'X', manufacturer: '', cv: 1, flow: 4, rec: 1, p: 0.1, apps: [] }

describe('export', () => {
  const info = { version: '0.1.0', author: 'Jan Gebauer' }
  const fromSettings = (txt: string) => txt.slice(txt.indexOf('******************\r\n** Method Settings'))

  test('from the settings on, matches the PrimeView sample byte for byte', () => {
    expect(fromSettings(toPrimeViewTxt(samplePhases, lowPressureColumn, info))).toBe(fromSettings(golden('sample-imac-gradient.txt')))
  })

  test('the header keeps the PrimeView lines, without the spacer lines', () => {
    const head = (txt: string) => txt.slice(0, txt.indexOf('******************\r\n** Method Settings')).split('\r\n')
    const ours = head(toPrimeViewTxt(samplePhases, lowPressureColumn, info))
    expect(ours.filter((l) => !/^\*\* (Created|Source)/.test(l))).toEqual(head(golden('sample-imac-gradient.txt')).filter((l) => l !== '**'))
  })

  test('no line is longer than PrimeView allows, for every template and a long author name', () => {
    for (const app of APPLICATIONS) {
      for (const c of columnsFor(app.id, SEED_COLUMNS)) {
        const txt = toPrimeViewTxt(templateFor(app.id, c), c, { version: '10.20.30-beta.4', author: 'x'.repeat(200) })
        expect(Math.max(...txt.split('\r\n').map((l) => l.length)), `${app.id} / ${c.name}`).toBeLessThanOrEqual(MAX_LINE)
      }
    }
  })

  test('matches the GradientDesk reference file byte for byte', () => {
    expect(toPrimeViewTxt(samplePhases, lowPressureColumn, info)).toBe(golden('gradientdesk-imac-gradient.txt'))
  })

  test('credit lines: version, project, author; empty author keeps the spot', () => {
    const lines = toPrimeViewTxt(samplePhases, lowPressureColumn, info).split('\r\n')
    expect(lines).toContain('** Created with     , GradientDesk v0.1.0 (gradientdesk.xcience.net)')
    expect(lines).toContain('** Source           , github.com/gebauer/GradientDesk')
    expect(lines).toContain('** Created by       , Jan Gebauer')
    expect(toPrimeViewTxt(samplePhases, lowPressureColumn, { ...info, author: '' }).split('\r\n')).toContain('** Created by       ,')
  })

  test('names are written as ASCII', () => {
    expect(toAscii('Jürgen Müßig')).toBe('Juergen Muessig')
    expect(toAscii('José Ångström')).toBe('Jose Angstroem')
    expect(toAscii(' Li\nWei 李 ')).toBe('Li Wei ?')
    const txt = toPrimeViewTxt(samplePhases, lowPressureColumn, { ...info, author: 'Zoë 李' })
    expect([...txt].every((ch) => ch.charCodeAt(0) < 128)).toBe(true)
  })

  test('the credit lines don\'t change what is imported', () => {
    expect(fromPrimeViewTxt(toPrimeViewTxt(samplePhases, lowPressureColumn, info)).phases).toEqual(samplePhases)
  })

  test('ASCII, CRLF on every line, starts with an empty line, no tabs', () => {
    const txt = toPrimeViewTxt(samplePhases, lowPressureColumn)
    expect(txt).not.toContain('\t')
    expect(txt.startsWith('\r\n*****')).toBe(true)
    expect(txt.endsWith('\r\n')).toBe(true)
    expect(txt.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    expect([...txt].every((ch) => ch.charCodeAt(0) < 128)).toBe(true)
  })

  test('breakpoint rows are 62 characters and volumes strictly increase, for every template', () => {
    for (const app of APPLICATIONS) {
      for (const c of columnsFor(app.id, SEED_COLUMNS)) {
        const rows = toPrimeViewTxt(templateFor(app.id, c), c).split('\r\n').filter((l) => l.startsWith(','))
        expect(rows.every((l) => l.length === 62), `${app.id} / ${c.name}`).toBe(true)
        const vols = rows.map((l) => Number(l.split(',')[2]))
        expect(vols[0]).toBe(0)
        expect(vols.every((v, i) => i === 0 || v > vols[i - 1]), `${app.id} / ${c.name}`).toBe(true)
        expect(rows.map((l) => Number(l.split(',')[1]))).toEqual(rows.map((_, i) => i + 1))
      }
    }
  })

  test('file name is PrimeMeth_NNN.txt', () => {
    expect(primeFileName(2)).toBe('PrimeMeth_002.txt')
    expect(slotFromFileName('PrimeMeth_017.txt')).toBe(17)
    expect(slotFromFileName('PrimeMeth_000.txt')).toBeNull()
    expect(slotFromFileName('method.txt')).toBeNull()
  })

  test('max pressure is the column limit in kPa, capped at the system limit', () => {
    expect(maxPressureKpa({ ...lowPressureColumn, p: 0.5 })).toBe(500)
    expect(maxPressureKpa({ ...lowPressureColumn, p: 4 })).toBe(1000)
  })

  test('writes the injection valve of each breakpoint', () => {
    const rows = toPrimeViewTxt([P({ type: 'pumpwash', inj: 'Waste', lines: ['A1'] }), P({ type: 'sample', inj: 'Inject' }), P({})], lowPressureColumn)
      .split('\r\n')
      .filter((l) => l.startsWith(','))
    expect(rows.map((l) => l.split(',')[7].trim())).toEqual(['Waste', 'Inject', 'Load', 'Load'])
    expect(rows.every((l) => l.length === 62)).toBe(true)
  })

  test('rounds %B to whole numbers and flow to 0.1', () => {
    const txt = toPrimeViewTxt([P({ len: 10, b0: 12.6, b1: 12.6, flow: 0.25 })], lowPressureColumn)
    expect(txt).toContain(',1   ,0.0     ,13  ,0.3  ,0.0   ,1   ,Load  ,0     ,N       ,N')
  })
})

describe('breakpoints', () => {
  test('a %B step ends the phase at its volume and starts the next at +0.1 ml', () => {
    const bps = breakpoints([P({ len: 5, b0: 100, b1: 100 }), P({ len: 5, inlet: 2 })], lowPressureColumn)
    expect(bps.map((b) => [b.volume, b.conc, b.inlet])).toEqual([[0, 100, 1], [5, 100, 1], [5.1, 0, 2], [10, 0, 2]])
  })

  test('IMAC template: strip → re-equilibration step', () => {
    const c = SEED_COLUMNS.find((x) => x.id === 'histrap-hp-5-ml') as Column
    const bps = breakpoints(templateFor('imac', c), c)
    expect(bps.map((b) => [b.volume, b.conc])).toEqual([[0, 0], [25, 0], [50, 0], [50.1, 5], [100, 5], [200, 100], [225, 100], [225.1, 0], [250, 0]])
  })

  test('phases too short for the file are errors', () => {
    const issues = validateProgram([P({ len: 5, b0: 100, b1: 100 }), P({ len: 0.1 }), P({ len: 0.04 })], lowPressureColumn)
    expect(issues.filter((i) => i.level === 'error').map((i) => i.phase)).toEqual([1, 2])
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

  test('accepts unpadded fields and missing empty lines', () => {
    const loose = golden('sample-imac-gradient.txt')
      .split('\r\n')
      .filter((l) => l.trim() !== '')
      .map((l) => (l.startsWith(',') ? l.replace(/ +/g, '').replace(/,/g, ' , ') : l))
      .join('\r\n')
    expect(loose).toContain(' , 2 , 2.0 , 0 , 1.0 , 0.0 , 8 , Load , 0 , Y , N')
    expect(fromPrimeViewTxt(loose).phases).toEqual(samplePhases)
    const tight = golden('sample-imac-gradient.txt').replace(/^(,.*)$/gm, (l) => l.replace(/ +/g, ''))
    expect(fromPrimeViewTxt(tight).phases).toEqual(samplePhases)
  })

  test('accepts LF line endings', () => {
    expect(fromPrimeViewTxt(golden('sample-imac-gradient.txt').replace(/\r\n/g, '\n')).phases).toHaveLength(4)
  })

  test('folds %B step segments back into the following phase', () => {
    const c = SEED_COLUMNS.find((x) => x.id === 'histrap-hp-5-ml') as Column
    const { phases } = fromPrimeViewTxt(toPrimeViewTxt(templateFor('imac', c), c))
    expect(phases.map((p) => [p.len, p.b0, p.b1])).toEqual([[25, 0, 0], [25, 0, 0], [50, 5, 5], [100, 5, 100], [25, 100, 100], [25, 0, 0]])
  })

  test('a pump wash survives export → import → export, one phase per line', () => {
    const wash = P({ name: 'Pump wash', type: 'pumpwash', len: 40, flow: 10, inj: 'Waste', lines: ['B', 'A8', 'A1'] })
    const txt = toPrimeViewTxt([wash, ...samplePhases], lowPressureColumn)
    const back = fromPrimeViewTxt(txt).phases
    expect(back.slice(0, 3).map((p) => [p.type, p.lines, p.len])).toEqual([['pumpwash', ['B'], 40], ['pumpwash', ['A8'], 40], ['pumpwash', ['A1'], 40]])
    expect(toPrimeViewTxt(back, lowPressureColumn)).toBe(txt)
  })

  test('every template on every listed column survives export → import → export', () => {
    for (const app of APPLICATIONS) {
      for (const c of columnsFor(app.id, SEED_COLUMNS)) {
        const txt = toPrimeViewTxt(templateFor(app.id, c), c)
        const back = fromPrimeViewTxt(txt)
        expect(toPrimeViewTxt(back.phases, c), `${app.id} / ${c.name}`).toBe(txt)
      }
    }
  })

  test('reports what it drops', () => {
    const txt = golden('sample-imac-gradient.txt').replace(',8   ,Load  ,0     ,Y       ,N', ',8   ,Inject,5     ,Y       ,Y')
    expect(fromPrimeViewTxt(txt).warnings).toHaveLength(2)
  })

  test('reads the injection valve and guesses pump wash from Waste', () => {
    const txt = golden('sample-imac-gradient.txt')
      .replace(',1   ,0.0     ,0   ,1.0  ,0.0   ,1   ,Load  ', ',1   ,0.0     ,0   ,1.0  ,0.0   ,1   ,Waste ')
      .replace(',8   ,Load  ', ',8   ,Inject')
    const { phases, warnings } = fromPrimeViewTxt(txt)
    expect(phases.map((p) => [p.type, p.inj])).toEqual([['pumpwash', 'Waste'], ['sample', 'Inject'], ['wash', 'Load'], ['elution', 'Load']])
    expect(warnings).toEqual([])
  })

  test('rejects files it cannot read', () => {
    expect(() => fromPrimeViewTxt('hello')).toThrow('No breakpoint table')
    expect(() => fromPrimeViewTxt(golden('sample-imac-gradient.txt').replace('Method base        ,ml', 'Method base        ,min'))).toThrow('volume-based')
    expect(() => fromPrimeViewTxt(golden('sample-imac-gradient.txt').replace(',17.0 ', ',2.0  '))).toThrow('must increase')
    expect(() => fromPrimeViewTxt(golden('sample-imac-gradient.txt').replace(',1   ,0.0 ', ',1   ,0.5 '))).toThrow('0.0 ml')
  })
})
