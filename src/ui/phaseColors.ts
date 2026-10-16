import type { PhaseType } from '../domain/types'

/** [chroma, hue]; pump wash is neutral grey because it bypasses the column. */
const COLOR: Record<PhaseType, [number, number]> = {
  equil: [0.12, 240],
  sample: [0.12, 300],
  wash: [0.12, 190],
  elution: [0.12, 40],
  strip: [0.12, 95],
  pumpwash: [0, 0],
}

/** Phase color oklch(0.72 C H), optionally with alpha. */
export function phaseColor(type: PhaseType, alpha?: number): string {
  const [c, h] = COLOR[type]
  return `oklch(0.72 ${c} ${h}${alpha === undefined ? '' : ` / ${alpha}`})`
}
