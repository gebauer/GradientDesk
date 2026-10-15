import { breakpoints, calcProgram, maxB } from '../domain/calc'
import { APPLICATIONS } from '../domain/templates'
import { currentColumn, type Action, type State, type Step } from '../state/store'
import { fmt, formatRunTime } from './format'

export function StepRail({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const column = currentColumn(state)
  const calc = calcProgram(state.phases, column)
  const bps = breakpoints(state.phases, column).length
  const steps: [string, string][] = [
    ['Application', APPLICATIONS.find((a) => a.id === state.app)?.name ?? ''],
    ['Column', column.name],
    ['Program', `${state.phases.length} phases`],
    ['Export', `${bps} breakpoints`],
  ]

  return (
    <nav className="rail" aria-label="Steps">
      {steps.map(([title, sub], i) => {
        const n = (i + 1) as Step
        const active = state.step === n
        return (
          <button
            key={title}
            type="button"
            className={`step-item${active ? ' active' : ''}${state.step > n ? ' done' : ''}`}
            aria-current={active ? 'step' : undefined}
            onClick={() => dispatch({ type: 'setStep', step: n })}
          >
            <span className="step-num">{n}</span>
            <span className="step-text">
              <span className="step-title">{title}</span>
              <span className="step-sub" title={sub}>
                {sub}
              </span>
            </span>
          </button>
        )
      })}
      <dl className="stats">
        <dt>Total volume</dt>
        <dd>{fmt(calc.total)} ml</dd>
        <dt>Run time</dt>
        <dd>{formatRunTime(calc.time)}</dd>
        <dt>Breakpoints</dt>
        <dd>{bps}</dd>
        <dt>Buffer B max</dt>
        <dd>{fmt(maxB(state.phases))} %</dd>
      </dl>
    </nav>
  )
}
