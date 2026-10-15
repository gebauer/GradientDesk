import { toPrimeViewTxt } from '../domain/primeview'
import { currentColumn, type State } from '../state/store'
import { downloadText } from './download'

export const txtFileName = (s: State) => `${s.methodName || 'method'}.txt`

export const methodTxt = (s: State) => toPrimeViewTxt(s.phases, currentColumn(s))

export function downloadTxt(s: State): void {
  downloadText(txtFileName(s), methodTxt(s))
}
