import { breakpoints } from '../../domain/calc'
import { currentColumn, type Action, type State } from '../../state/store'
import { MAX_SLOT } from '../../domain/primeview'
import { NumberInput } from '../form/NumberInput'
import { downloadTxt, exportBlocker, methodTxt, txtFileName } from '../exportTxt'
import { fixed } from '../format'
import { phaseColor } from '../phaseColors'
import { StepHeader } from '../StepHeader'

export function ExportStep({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const column = currentColumn(state)
  const rows = breakpoints(state.phases, column)
  const blocker = exportBlocker(state)

  return (
    <>
      <StepHeader title="Export for PrimeView" description="ÄKTA prime method file for PrimeView. Save it to C:\UNICORN\Bin\Prime\.">
        <button type="button" className="btn btn-lg" onClick={() => dispatch({ type: 'setStep', step: 3 })}>
          Back
        </button>
        <button type="button" className="btn btn-primary btn-lg" disabled={!!blocker} title={blocker ?? undefined} onClick={() => downloadTxt(state)}>
          Download {txtFileName(state)}
        </button>
      </StepHeader>
      <div className="export-fields">
        <label className="slot-field">
          Method no.
          <NumberInput className="slot-input" min="1" max={MAX_SLOT} step="1" value={state.slot} onValue={(slot) => dispatch({ type: 'setSlot', slot })} />
        </label>
        <label className="slot-field">
          Created by
          <input
            className="input author-input"
            value={state.author}
            placeholder="Your name (optional)"
            autoComplete="name"
            onChange={(e) => dispatch({ type: 'setAuthor', author: e.target.value })}
          />
        </label>
        <span className="muted">Written into the file header, saved in this browser.</span>
      </div>
      {blocker && (
        <div className="warning" role="alert">
          {blocker}
        </div>
      )}
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
              <div role="cell" className="num">{r.conc}</div>
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
