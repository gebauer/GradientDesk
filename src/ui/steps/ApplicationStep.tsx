import { columnsFor } from '../../domain/columns'
import { APPLICATIONS, templateFor } from '../../domain/templates'
import { allColumns, currentColumn, type Action, type State } from '../../state/store'
import { phaseColor } from '../phaseColors'
import { StepHeader } from '../StepHeader'

export function ApplicationStep({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const all = allColumns(state)
  return (
    <>
      <StepHeader title="Choose an application" description="Loads a starting program with typical phases. Everything can be changed later.">
        <button type="button" className="btn btn-primary btn-lg" onClick={() => dispatch({ type: 'setStep', step: 2 })}>
          Continue
        </button>
      </StepHeader>
      <div className="app-grid">
        {APPLICATIONS.map((a) => {
          const cols = columnsFor(a.id, all)
          const preview = templateFor(a.id, cols[0] ?? currentColumn(state))
          const selected = a.id === state.app
          return (
            <button
              key={a.id}
              type="button"
              className={`app-card${selected ? ' selected' : ''}${a.id === 'general' ? ' wide' : ''}`}
              aria-pressed={selected}
              onClick={() => dispatch({ type: 'loadApp', app: a.id })}
            >
              <div className="app-card-head">
                <div className="app-card-name">{a.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {cols.length} columns
                </div>
              </div>
              <div className="app-card-desc">{a.description}</div>
              <div className="app-seq" aria-hidden="true">
                {preview.map((p, i) => (
                  <div key={i}>
                    <div className="app-seq-bar" style={{ background: phaseColor(p.type) }} />
                    <div className="app-seq-label">{p.name}</div>
                  </div>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
