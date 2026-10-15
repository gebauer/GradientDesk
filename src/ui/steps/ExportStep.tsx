import { breakpoints } from '../../domain/calc'
import { currentColumn, type Action, type State } from '../../state/store'
import { downloadTxt, methodTxt, txtFileName } from '../exportTxt'
import { fixed } from '../format'
import { phaseColor } from '../phaseColors'
import { StepHeader } from '../StepHeader'

export function ExportStep({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const column = currentColumn(state)
  const rows = breakpoints(state.phases, column)

  return (
    <>
      <StepHeader title="Export for PrimeView" description="ÄKTA prime method dump with the breakpoint table, ready to load with PrimeView.">
        <button type="button" className="btn btn-lg" onClick={() => dispatch({ type: 'setStep', step: 3 })}>
          Back
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => downloadTxt(state)}>
          Download {txtFileName(state)}
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
        <pre className="code" aria-label="File preview">
          {methodTxt(state).replace(/\r\n/g, '\n')}
        </pre>
      </div>
    </>
  )
}
