import type { Column, Phase } from './types'

export type IssueField = 'len' | 'b0' | 'b1' | 'flow' | 'frac' | 'inlet'

export interface Issue {
  phase: number
  field: IssueField
  /** Warnings never block export. */
  level: 'warning' | 'error'
  message: string
}

const fmt = (x: number) => String(Math.round(x * 100) / 100)

export function validatePhase(p: Phase, i: number, column: Column): Issue[] {
  const issues: Issue[] = []
  const err = (field: IssueField, message: string) => issues.push({ phase: i, field, level: 'error', message })

  if (!(p.len > 0)) err('len', 'Length must be greater than 0.')
  if (!(p.b0 >= 0 && p.b0 <= 100)) err('b0', 'Start %B must be between 0 and 100.')
  if (p.grad && !(p.b1 >= 0 && p.b1 <= 100)) err('b1', 'End %B must be between 0 and 100.')
  if (!(p.flow > 0)) err('flow', 'Flow must be greater than 0.')
  else if (column.flow !== null && p.flow > column.flow) {
    issues.push({ phase: i, field: 'flow', level: 'warning', message: `Above the column maximum of ${fmt(column.flow)} ml/min.` })
  }
  if (!(p.frac >= 0)) err('frac', 'Fraction size cannot be negative.')
  if (!(Number.isInteger(p.inlet) && p.inlet >= 1 && p.inlet <= 8)) err('inlet', 'Inlet must be A1–A8.')
  return issues
}

export function validateProgram(phases: readonly Phase[], column: Column): Issue[] {
  return phases.flatMap((p, i) => validatePhase(p, i, column))
}
