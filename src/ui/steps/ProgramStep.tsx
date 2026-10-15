import { calcProgram } from '../../domain/calc'
import { APPLICATIONS, PHASE_TYPES } from '../../domain/templates'
import type { Inlet, Phase, PhaseType } from '../../domain/types'
import { validatePhase } from '../../domain/validate'
import { currentColumn, type Action, type State } from '../../state/store'
import { GradientChart } from '../chart/GradientChart'
import { NumberInput } from '../form/NumberInput'
import { Segmented } from '../form/Segmented'
import { Toggle } from '../form/Toggle'
import { fmt } from '../format'
import { phaseColor } from '../phaseColors'
import { StepHeader } from '../StepHeader'

const INLETS: Inlet[] = [1, 2, 3, 4, 5, 6, 7, 8]

export function ProgramStep({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const column = currentColumn(state)
  const calc = calcProgram(state.phases, column)
  const n = state.phases.length
  const sel = Math.min(state.sel, n - 1)
  const p = state.phases[sel]
  const pc = calc.phases[sel]
  const app = APPLICATIONS.find((a) => a.id === state.app)
  const upd = (patch: Partial<Phase>) => dispatch({ type: 'updatePhase', index: sel, patch })
  const issues = validatePhase(p, sel, column)
  const issue = (field: string) => issues.find((i) => i.field === field)
  const id = (k: string) => `phase-${k}`

  return (
    <>
      <StepHeader title="Program" description={`${app?.name} on ${column.name} · drag a handle to change phase length and %B`}>
        <button type="button" className="btn btn-lg" onClick={() => dispatch({ type: 'setStep', step: 2 })}>
          Back
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => dispatch({ type: 'setStep', step: 4 })}>
          Review export
        </button>
      </StepHeader>

      <GradientChart phases={state.phases} calc={calc} column={column} sel={sel} dragDomain={state.dragDomain} dispatch={dispatch} />

      <div className="program-grid">
        <div className="card phase-list">
          <div className="phase-list-head label-caps">
            <div>Phases</div>
            <div>
              {n} · {fmt(calc.total)} ml
            </div>
          </div>
          <ul className="phase-list-body">
            {state.phases.map((q, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={`phase-row row${i === sel ? ' selected' : ''}`}
                  aria-current={i === sel || undefined}
                  onClick={() => dispatch({ type: 'selectPhase', index: i })}
                >
                  <span className="phase-num">{i + 1}</span>
                  <span className="swatch" style={{ background: phaseColor(q.type) }} />
                  <span className="phase-name">{q.name}</span>
                  <span className="phase-meta">
                    {fmt(q.len)} {q.unit} · {q.grad ? `${fmt(q.b0)}→${fmt(q.b1)}` : fmt(q.b0)} %B
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="add-phase" onClick={() => dispatch({ type: 'addPhase' })}>
            + Add phase after selected
          </button>
        </div>

        <section className="card phase-form" aria-labelledby="phase-form-title">
          <div className="phase-form-head">
            <span className="swatch" style={{ background: phaseColor(p.type) }} />
            <h2 id="phase-form-title" className="phase-form-title" style={{ margin: 0 }}>
              {p.name}
            </h2>
            <span className="muted" style={{ fontSize: 13 }}>
              Phase {sel + 1} of {n}
            </span>
            <span className="spacer" />
            <span className="phase-form-info">
              {fmt(pc.ml)} ml · {fmt(pc.ml / column.cv, 2)} CV · {fmt(pc.min)} min
            </span>
          </div>

          <div className="form-grid">
            <label className="field span-2">
              Name
              <input className="input" value={p.name} onChange={(e) => upd({ name: e.target.value })} />
            </label>
            <label className="field span-2">
              Phase type
              <select className="input" value={p.type} onChange={(e) => upd({ type: e.target.value as PhaseType })}>
                {PHASE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <label htmlFor={id('len')}>Length</label>
              <div className="len-row">
                <NumberInput id={id('len')} step="0.5" min="0" value={p.len} onValue={(len) => upd({ len })} invalid={!!issue('len')} />
                <Segmented label="Length unit" value={p.unit} options={['CV', 'ml'] as const} onChange={(unit) => dispatch({ type: 'setUnit', index: sel, unit })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor={id('b0')}>Start %B</label>
              <NumberInput
                id={id('b0')}
                min="0"
                max="100"
                value={p.b0}
                onValue={(b0) => upd(p.grad ? { b0 } : { b0, b1: b0 })}
                invalid={!!issue('b0')}
              />
            </div>
            <div className="field">
              <label htmlFor={id('b1')}>End %B</label>
              <NumberInput
                id={id('b1')}
                min="0"
                max="100"
                value={p.grad ? p.b1 : p.b0}
                disabled={!p.grad}
                onValue={(b1) => upd({ b1 })}
                invalid={!!issue('b1')}
              />
            </div>
            <div className="field">
              <label htmlFor={id('grad')}>Gradient</label>
              <Toggle id={id('grad')} on={p.grad} onChange={(grad) => upd({ grad, b1: p.b0 })} labelOn="Linear gradient" labelOff="Isocratic" />
            </div>
            <div className="field">
              <label htmlFor={id('flow')}>Flow (ml/min)</label>
              <NumberInput
                id={id('flow')}
                step="0.5"
                min="0"
                value={p.flow}
                onValue={(flow) => upd({ flow })}
                invalid={!!issue('flow')}
                aria-describedby={issue('flow') ? id('issues') : undefined}
              />
            </div>
            <div className="field">
              <label htmlFor={id('frac')}>Fraction size (ml)</label>
              <NumberInput id={id('frac')} step="0.5" min="0" value={p.frac} onValue={(frac) => upd({ frac })} invalid={!!issue('frac')} />
            </div>
            <label className="field">
              Inlet A
              <select className="input" value={p.inlet} onChange={(e) => upd({ inlet: Number(e.target.value) as Inlet })}>
                {INLETS.map((i) => (
                  <option key={i} value={i}>
                    A{i}
                    {i === 8 ? ' (sample)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <label htmlFor={id('az')}>Autozero at start</label>
              <Toggle id={id('az')} on={p.az} onChange={(az) => upd({ az })} labelOn="On" labelOff="Off" />
            </div>
          </div>

          {issues.length > 0 && (
            <div id={id('issues')} role="status">
              {issues.map((i, k) => (
                <div key={k} className="warning">
                  {i.message}
                </div>
              ))}
            </div>
          )}

          <div className="phase-form-foot">
            <button type="button" className="btn btn-muted" disabled={n <= 1} onClick={() => dispatch({ type: 'deletePhase' })}>
              Delete phase
            </button>
            <span className="spacer" />
            <button type="button" className="btn" disabled={sel === 0} onClick={() => dispatch({ type: 'selectPhase', index: sel - 1 })}>
              ← Previous phase
            </button>
            <button type="button" className="btn btn-primary" disabled={sel === n - 1} onClick={() => dispatch({ type: 'selectPhase', index: sel + 1 })}>
              Next phase →
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
