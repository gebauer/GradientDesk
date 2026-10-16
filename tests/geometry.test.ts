import { expect, test } from 'vitest'
import { dragPatch, geometry, keyPatch, levelPatch, tickStep } from '../src/ui/chart/geometry'
import type { Phase } from '../src/domain/types'

const phase = (o: Partial<Phase> = {}): Phase => ({
  name: 'P', type: 'elution', len: 20, unit: 'CV', b0: 5, b1: 100, grad: true, flow: 5, flowStd: false, frac: 2, inlet: 1, inj: 'Load', az: true, ...o,
})

test('geometry maps both ways and keeps a frozen domain', () => {
  const g = geometry(1104, 240, 250, null)
  expect(g.x(0)).toBe(36)
  expect(g.x(250)).toBe(1096)
  expect(g.ml(g.x(100))).toBeCloseTo(100)
  expect(g.b(g.y(40))).toBeCloseTo(40)
  expect(geometry(1104, 240, 200, 250).dom).toBe(250)
  expect(geometry(1104, 240, 300, 250).dom).toBe(300)
})

test('tick step gives at most 12 ticks', () => {
  expect(tickStep(5)).toBe(0.5)
  expect(tickStep(250)).toBe(25)
  expect(tickStep(266)).toBe(25)
  expect(tickStep(1000)).toBe(100)
})

test('dragging a gradient handle sets length and end %B', () => {
  expect(dragPatch(phase(), 50, 150, 80.4, 5)).toEqual({ len: 20, b1: 80 })
})

test('dragging an isocratic handle sets both %B values, clamped', () => {
  expect(dragPatch(phase({ grad: false, unit: 'ml' }), 10, 22.34, 130, 5)).toEqual({ len: 12.3, b0: 100, b1: 100 })
  expect(dragPatch(phase({ unit: 'ml' }), 10, 5, -3, 5)).toEqual({ len: 0.1, b1: 0 })
})

test('keyboard steps', () => {
  expect(keyPatch(phase(), 'ArrowRight', false)).toEqual({ len: 20.1 })
  expect(keyPatch(phase(), 'ArrowLeft', true)).toEqual({ len: 19 })
  expect(keyPatch(phase(), 'ArrowUp', false)).toEqual({ b1: 100 })
  expect(keyPatch(phase(), 'ArrowDown', true)).toEqual({ b1: 90 })
  expect(keyPatch(phase({ grad: false, b0: 5, b1: 5 }), 'ArrowUp', false)).toEqual({ b0: 6, b1: 6 })
  expect(keyPatch(phase({ len: 0.1 }), 'ArrowLeft', false)).toEqual({ len: 0.1 })
  expect(keyPatch(phase(), 'Enter', false)).toBeNull()
})

test('dragging an isocratic %B line moves both values and keeps the length', () => {
  expect(levelPatch(42.4)).toEqual({ b0: 42, b1: 42 })
  expect(levelPatch(120)).toEqual({ b0: 100, b1: 100 })
  expect(levelPatch(-5)).toEqual({ b0: 0, b1: 0 })
})
