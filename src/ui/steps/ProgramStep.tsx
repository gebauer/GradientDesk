import { useCallback, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { calcProgram, sortLines } from '../../domain/calc'
import { APPLICATIONS, INJECT_VALVES, PHASE_TYPES, retypePatch } from '../../domain/templates'
import type { Inlet, InjectValve, Phase, PhaseType, PumpLine } from '../../domain/types'
import { validateProgram } from '../../domain/validate'
import { currentColumn, type Action, type State } from '../../state/store'
import { GradientChart } from '../chart/GradientChart'
import { NumberInput } from '../form/NumberInput'
import { Segmented } from '../form/Segmented'
import { Toggle } from '../form/Toggle'
import { fmt } from '../format'
import { phaseColor } from '../phaseColors'
import { menuAnchor, type MenuAnchor } from '../menuAnchor'
import { PhaseMenu } from '../PhaseMenu'
import { StepHeader } from '../StepHeader'

const INLETS: Inlet[] = [1, 2, 3, 4, 5, 6, 7, 8]
/** Checkbox order; the wash itself runs B, A8 … A1. */
const LINE_CHOICES: PumpLine[] = ['B', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8']

/** Phase list meta: "5 CV · 5→100 %B", for a pump wash "2 × 40 ml · B, A1". */
function phaseMeta(q: Phase): string {
  if (q.type === 'pumpwash') return `${q.lines?.length ?? 0} × ${fmt(q.len)} ml · ${q.lines?.join(', ') || 'no lines'}`
  return `${fmt(q.len)} ${q.unit} · ${q.grad ? `${fmt(q.b0)}→${fmt(q.b1)}` : fmt(q.b0)} %B`
}

export function ProgramStep({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const column = currentColumn(state)
  const calc = calcProgram(state.phases, column)
  const n = state.phases.length
  const sel = Math.min(state.sel, n - 1)
  const p = state.phases[sel]
  const pc = calc.phases[sel]
  const app = APPLICATIONS.find((a) => a.id === state.app)
  const upd = (patch: Partial<Phase>) => dispatch({ type: 'updatePhase', index: sel, patch })
  const issues = validateProgram(state.phases, column).filter((i) => i.phase === sel)
  const issue = (field: string) => issues.find((i) => i.field === field)
  const id = (k: string) => `phase-${k}`
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const openMenu = (e: ReactMouseEvent<Element>, index: number) => {
    e.preventDefault()
    dispatch({ type: 'selectPhase', index })
    setMenu(menuAnchor(e, index))
  }

  return (
    <>
      <StepHeader title="Program" description={`${app?.name} on ${column.name} · drag a handle to change length and %B, drag a flat line to move it up or down, right-click a phase for more`}>
        <button type="button" className="btn btn-lg" onClick={() => dispatch({ type: 'setStep', step: 2 })}>
          Back
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => dispatch({ type: 'setStep', step: 4 })}>
          Review export
        </button>
      </StepHeader>

      <GradientChart phases={state.phases} calc={calc} column={column} sel={sel} dragDomain={state.dragDomain} dispatch={dispatch} onPhaseMenu={openMenu} />

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
                  aria-haspopup="menu"
                  onClick={() => dispatch({ type: 'selectPhase', index: i })}
                  onContextMenu={(e) => openMenu(e, i)}
                >
                  <span className="phase-num">{i + 1}</span>
                  <span className="swatch" style={{ background: phaseColor(q.type) }} />
                  <span className="phase-name">{q.name}</span>
                  <span className="phase-meta">{phaseMeta(q)}</span>
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
              <select className="input" value={p.type} onChange={(e) => upd(retypePatch(p, e.target.value as PhaseType))}>
                {PHASE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {p.type === 'pumpwash' ? (
              <>
                <fieldset className="field span-4 line-set" aria-invalid={!!issue('lines') || undefined}>
                  <legend>Lines to wash · runs B, A8 … A1</legend>
                  <div className="line-choices">
                    {LINE_CHOICES.map((l) => (
                      <label key={l} className="line-choice">
                        <input
                          type="checkbox"
                          checked={p.lines?.includes(l) ?? false}
                          onChange={(e) => {
                            const rest = (p.lines ?? []).filter((x) => x !== l)
                            upd({ lines: sortLines(e.target.checked ? [...rest, l] : rest) })
                          }}
                        />
                        {l}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="field">
                  <label htmlFor={id('len')}>Volume per line (ml)</label>
                  <NumberInput id={id('len')} step="5" min="0" value={p.len} onValue={(len) => upd({ len })} invalid={!!issue('len')} />
                </div>
                <div className="field">
                  <label htmlFor={id('flow')}>Flow (ml/min)</label>
                  <NumberInput id={id('flow')} step="0.5" min="0" value={p.flow} onValue={(flow) => upd({ flow })} invalid={!!issue('flow')} />
                </div>
                <div className="field">
                  Injection valve
                  <div className="input input-static">Waste</div>
                </div>
              </>
            ) : (
              <>
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
                <label className="field">
                  Injection valve
                  <select className="input" value={p.inj} onChange={(e) => upd({ inj: e.target.value as InjectValve })}>
                    {INJECT_VALVES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field">
                  <label htmlFor={id('az')}>Autozero at start</label>
                  <Toggle id={id('az')} on={p.az} onChange={(az) => upd({ az })} labelOn="On" labelOff="Off" />
                </div>
              </>
            )}
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

      {menu && state.phases[menu.index] && (
        <PhaseMenu
          anchor={menu}
          phaseName={state.phases[menu.index].name}
          canDelete={n > 1}
          onAdd={() => {
            dispatch({ type: 'selectPhase', index: menu.index })
            dispatch({ type: 'addPhase' })
          }}
          onDelete={() => {
            dispatch({ type: 'selectPhase', index: menu.index })
            dispatch({ type: 'deletePhase' })
          }}
          onClose={closeMenu}
        />
      )}
    </>
  )
}
