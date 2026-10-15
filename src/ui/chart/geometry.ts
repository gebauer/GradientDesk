import type { Phase } from '../../domain/types'

export const PAD = { left: 36, right: 8, top: 24, bottom: 26 } as const
const TICK_STEPS = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500]

export interface Geom {
  W: number
  H: number
  iw: number
  ih: number
  /** x-axis maximum in ml */
  dom: number
  x: (ml: number) => number
  y: (b: number) => number
  /** inverse of x and y */
  ml: (px: number) => number
  b: (py: number) => number
}

export function geometry(W: number, H: number, total: number, dragDomain: number | null): Geom {
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const dom = Math.max(dragDomain ?? 0, total) || 1
  return {
    W,
    H,
    iw,
    ih,
    dom,
    x: (ml) => PAD.left + (ml / dom) * iw,
    y: (b) => PAD.top + (1 - b / 100) * ih,
    ml: (px) => ((px - PAD.left) / iw) * dom,
    b: (py) => (1 - (py - PAD.top) / ih) * 100,
  }
}

/** x tick step so there are at most 12 ticks. */
export function tickStep(dom: number): number {
  return TICK_STEPS.find((s) => dom / s <= 12) ?? 1000
}

const round1 = (x: number) => Math.round(x * 10) / 10
const clampB = (b: number) => Math.max(0, Math.min(100, Math.round(b)))

/**
 * Patch for dragging a phase's end handle to (endMl, b).
 * x → length in the phase's unit (0.1 steps, min 0.1 ml); y → End %B (gradient) or Start and End %B (isocratic).
 */
export function dragPatch(p: Phase, v0: number, endMl: number, b: number, cv: number): Partial<Phase> {
  const ml = Math.max(0.1, endMl - v0)
  const len = p.unit === 'CV' ? round1(ml / cv) : round1(ml)
  const nb = clampB(b)
  return p.grad ? { len: Math.max(0.1, len), b1: nb } : { len: Math.max(0.1, len), b0: nb, b1: nb }
}

/** Patch for dragging an isocratic phase's %B line up or down: both %B values, length unchanged. */
export function levelPatch(b: number): Partial<Phase> {
  const nb = clampB(b)
  return { b0: nb, b1: nb }
}

/** Keyboard: arrows change length by ±0.1 (Shift ×10) and %B by ±1 (Shift ×10). */
export function keyPatch(p: Phase, key: string, shift: boolean): Partial<Phase> | null {
  const k = shift ? 10 : 1
  const endB = p.grad ? p.b1 : p.b0
  const setB = (b: number) => (p.grad ? { b1: clampB(b) } : { b0: clampB(b), b1: clampB(b) })
  switch (key) {
    case 'ArrowRight':
      return { len: round1(p.len + 0.1 * k) }
    case 'ArrowLeft':
      return { len: Math.max(0.1, round1(p.len - 0.1 * k)) }
    case 'ArrowUp':
      return setB(endB + k)
    case 'ArrowDown':
      return setB(endB - k)
    default:
      return null
  }
}
