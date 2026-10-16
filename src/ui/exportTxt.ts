import { toMethodTxt } from '../domain/methodTxt'
import { primeFileName } from '../domain/primeview'
import { validateProgram } from '../domain/validate'
import { currentColumn, currentMethod, type State } from '../state/store'
import { downloadText } from './download'

export const txtFileName = (s: State) => primeFileName(s.slot)

/** The file needs no timestamp, so the same method always gives the same file. */
export const methodTxt = (s: State) => toMethodTxt(currentMethod(s, new Date(0).toISOString()), { version: __APP_VERSION__, author: s.author })

/** Why the .txt can't be exported, or null. Warnings never block. */
export function exportBlocker(s: State): string | null {
  const errors = validateProgram(s.phases, currentColumn(s)).filter((i) => i.level === 'error')
  if (!errors.length) return null
  const phases = [...new Set(errors.map((e) => e.phase + 1))]
  return `Fix the errors in phase ${phases.join(', ')} before exporting.`
}

export function downloadTxt(s: State): void {
  if (exportBlocker(s)) return
  downloadText(txtFileName(s), methodTxt(s))
}
