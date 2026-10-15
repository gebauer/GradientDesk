import { breakpoints } from '../../domain/calc'
import { currentColumn, type Action, type State } from '../../state/store'
import { fixed } from '../format'
import { phaseColor } from '../phaseColors'
import { StepHeader } from '../StepHeader'

/** PrimeView .txt export is on hold until a real sample file is available (CLAUDE.md). */
export const TXT_EXPORT_AVAILABLE = false
export const TXT_PENDING = 'PrimeView .txt export follows once a PrimeView sample file is available.'

export function ExportStep({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const column = currentColumn(state)
  const rows = breakpoints(state.phases, column)
  const fileName = `${state.methodName || 'method'}.txt`

  return (
    <>
      <StepHeader title="Export for PrimeView" description="Tab-separated breakpoint table. Column layout will be matched to your PrimeView sample file.">
        <button type="button" className="btn btn-lg" onClick={() => dispatch({ type: 'setStep', step: 3 })}>
          Back
        </button>
        <button type="button" className="btn btn-primary btn-lg" disabled={!TXT_EXPORT_AVAILABLE} title={TXT_PENDING}>
          Download {fileName}
        </button>
      </StepHeader>
      <div className="export-grid">
        <div className="card bp-table" role="table" aria-label="Breakpoints">
          <div className="bp-grid bp-head label-caps" role="row">
            <div role="columnheader">BP</div>
            <div role="columnheader" className="num">Volume ml</div>
            <div role="columnheader" className="num">%B</div>
            <div role="columnheader" className="num">Flow</div>
            <div role="columnheader" className="num">Fraction</div>
            <div role="columnheader" className="num">Inlet A</div>
            <div role="columnheader" className="num">Autozero</div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="bp-grid bp-row" role="row">
              <div role="cell" className="bp-num">
                <span className="bp-dot" style={{ background: phaseColor(state.phases[r.phase].type) }} />
                {i + 1}
              </div>
              <div role="cell" className="num">{fixed(r.volume)}</div>
              <div role="cell" className="num">{fixed(r.conc)}</div>
              <div role="cell" className="num">{fixed(r.flow)}</div>
              <div role="cell" className="num">{fixed(r.frac)}</div>
              <div role="cell" className="num">A{r.inlet}</div>
              <div role="cell" className="num">{r.az ? 'Yes' : 'No'}</div>
            </div>
          ))}
        </div>
        <pre className="code" style={{ whiteSpace: 'pre-wrap' }}>
          {TXT_PENDING}
        </pre>
      </div>
    </>
  )
}
