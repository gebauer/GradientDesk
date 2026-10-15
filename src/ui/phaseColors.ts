import type { PhaseType } from '../domain/types'

const HUE: Record<PhaseType, number> = { equil: 240, sample: 300, wash: 190, elution: 40, strip: 95 }

/** Phase color oklch(0.72 0.12 H), optionally with alpha. */
export function phaseColor(type: PhaseType, alpha?: number): string {
  return `oklch(0.72 0.12 ${HUE[type]}${alpha === undefined ? '' : ` / ${alpha}`})`
}
