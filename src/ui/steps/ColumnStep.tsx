import { useState, type ChangeEvent } from 'react'
import { stdFlowOf } from '../../domain/calc'
import { COLUMN_TYPES, columnsOfType, customRecFlow, defaultColumnType, filterColumns, splitRecent, vendorCounts, type ColumnType } from '../../domain/columns'
import type { Column } from '../../domain/types'
import { APPLICATIONS } from '../../domain/templates'
import { validateSettings } from '../../domain/validate'
import { allColumns, currentColumn, type Action, type State } from '../../state/store'
import { DefaultNumber } from '../form/DefaultNumber'
import { fmt } from '../format'
import { StepHeader } from '../StepHeader'

const EMPTY = { name: '', cv: '', flow: '', rec: '', p: '' }

const REC_HINT = 'Recommended flow, used by the templates: the vendor value, or the lower end of the vendor range. ≈ marks an estimate where the vendor gives none.'

export function ColumnStep({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const app = APPLICATIONS.find((a) => a.id === state.app)
  const all = allColumns(state)
  const [type, setType] = useState<ColumnType>(() => defaultColumnType(state.app))
  const [vendorPick, setVendor] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // Recent as it was when the step opened, so a clicked row doesn't jump away under the pointer.
  const [recentAtOpen] = useState(() => state.recentColumns)
  const vendors = vendorCounts(columnsOfType(all, type))
  // A vendor with no columns of the chosen type falls back to all vendors.
  const vendor = vendors.some((v) => v.vendor === vendorPick) ? vendorPick : null
  const cols = filterColumns(all, { type, vendor, query })
  const filtered = cols.length !== all.length
  const { recent, rest } = splitRecent(cols, recentAtOpen)
  // Tab stop: the selected row, or the first row when the selection is filtered out.
  const tabStop = cols.some((c) => c.id === state.colId) ? state.colId : (recent[0] ?? rest[0])?.id
  const [draft, setDraft] = useState(EMPTY)
  const set = (k: keyof typeof EMPTY) => (e: ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  const cv = parseFloat(draft.cv)
  const flow = parseFloat(draft.flow)
  const rec = parseFloat(draft.rec)
  const p = parseFloat(draft.p)
  const canAdd = draft.name.trim() !== '' && cv > 0 && flow > 0 && (draft.rec === '' || (rec > 0 && rec <= flow))

  const add = () => {
    if (!canAdd) return
    dispatch({ type: 'addCustomColumn', id: `custom-${Date.now()}`, name: draft.name.trim(), cv, flow, rec: rec > 0 ? rec : undefined, p: p > 0 ? p : 0.5 })
    setDraft(EMPTY)
  }

  const row = (c: Column) => {
    const selected = c.id === state.colId
    return (
      <div
        key={c.id}
        className={`col-grid col-row row${selected ? ' selected' : ''}`}
        role="radio"
        aria-checked={selected}
        tabIndex={c.id === tabStop ? 0 : -1}
        onClick={() => dispatch({ type: 'selectColumn', id: c.id })}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            dispatch({ type: 'selectColumn', id: c.id })
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const radios = [...(e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])]
            const next = radios[radios.indexOf(e.currentTarget) + (e.key === 'ArrowDown' ? 1 : -1)]
            if (next) {
              next.focus()
              next.click()
            }
          }
        }}
        title={c.note}
      >
        <div className="radio">{selected && <div className="radio-dot" />}</div>
        <div>
          <div className="col-name">{c.name}</div>
          {c.manufacturer && <div className="col-maker">{c.manufacturer}</div>}
        </div>
        <div className="num">{fmt(c.cv)}</div>
        <div className="num">{c.flow === null ? '–' : fmt(c.flow)}</div>
        <div className="num" title={c.recEstimated ? 'Estimated, no vendor value' : undefined}>
          {c.recEstimated ? `≈ ${fmt(c.rec)}` : fmt(c.rec)}
        </div>
        <div className="num">{fmt(c.p, 2)}</div>
        <div className="col-tag">
          {c.custom && (
            <>
              Custom
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${c.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  dispatch({ type: 'removeCustomColumn', id: c.id })
                }}
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <StepHeader title="Select a column" description={`${app?.name} · CV-based phase lengths are rescaled to the column volume.`}>
        <button type="button" className="btn btn-lg" onClick={() => dispatch({ type: 'setStep', step: 1 })}>
          Back
        </button>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => dispatch({ type: 'setStep', step: 3 })}>
          Continue
        </button>
      </StepHeader>

      <MethodSettings state={state} dispatch={dispatch} />

      <div className="col-filters">
        <div className="col-search">
          <label className="col-type">
            <span className="visually-hidden">Column type</span>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as ColumnType)}>
              {COLUMN_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <input
            type="search"
            className="input"
            aria-label="Search columns"
            placeholder="Search by name, manufacturer or size, e.g. superdex 200, 5 ml"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('')
            }}
          />
          <span className="muted" aria-live="polite">
            {filtered ? `${cols.length} of ${all.length} columns` : `${all.length} columns`}
          </span>
        </div>
        <div className="pills" role="group" aria-label="Vendor">
          <button type="button" className={`pill${vendor === null ? ' on' : ''}`} aria-pressed={vendor === null} onClick={() => setVendor(null)}>
            All vendors
          </button>
          {vendors.map((v) => (
            <button
              key={v.vendor}
              type="button"
              className={`pill${vendor === v.vendor ? ' on' : ''}`}
              aria-pressed={vendor === v.vendor}
              onClick={() => setVendor(vendor === v.vendor ? null : v.vendor)}
            >
              {v.vendor} <span className="pill-count">{v.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card col-table" role="radiogroup" aria-label="Column">
        <div className="col-grid col-head label-caps">
          <div />
          <div>Column</div>
          <div className="num">CV (ml)</div>
          <div className="num">Max flow (ml/min)</div>
          <div className="num" title={REC_HINT}>
            Rec. flow (ml/min)
          </div>
          <div className="num">Pressure limit (MPa)</div>
          <div />
        </div>
        {recent.length > 0 && (
          <>
            <div className="col-section label-caps" role="presentation">
              Recent
            </div>
            {recent.map(row)}
            {rest.length > 0 && (
              <div className="col-section label-caps" role="presentation">
                All columns
              </div>
            )}
          </>
        )}
        {rest.map(row)}
        {cols.length === 0 && <div className="col-empty">{query ? `No columns match “${query}”.` : 'No columns for this type and vendor.'}</div>}
      </div>

      <form
        className="card custom-card"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <div className="custom-head">
          <div style={{ fontSize: 14, fontWeight: 600 }}>Add custom column</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Saved in this browser only
          </div>
        </div>
        <div className="custom-grid">
          <label className="field">
            Name
            <input className="input" value={draft.name} onChange={set('name')} placeholder="e.g. Ni-NTA gravity 2 ml" required />
          </label>
          <label className="field">
            CV (ml)
            <input className="input" type="number" min="0" step="any" value={draft.cv} onChange={set('cv')} required />
          </label>
          <label className="field">
            Max flow
            <input className="input" type="number" min="0" step="any" value={draft.flow} onChange={set('flow')} required />
          </label>
          <label className="field">
            Rec. flow
            <input
              className="input"
              type="number"
              min="0"
              step="any"
              value={draft.rec}
              onChange={set('rec')}
              placeholder={flow > 0 ? fmt(customRecFlow(flow)) : '50 % of max'}
              aria-invalid={draft.rec !== '' && !(rec > 0 && (!(flow > 0) || rec <= flow)) ? true : undefined}
            />
          </label>
          <label className="field">
            Pressure (MPa)
            <input className="input" type="number" min="0" step="any" value={draft.p} onChange={set('p')} />
          </label>
          <button type="submit" className="btn btn-outline" disabled={!canAdd}>
            Add to library
          </button>
        </div>
      </form>
    </>
  )
}

/** Standard flow and pressure limit of this method: the column's values unless overridden. */
function MethodSettings({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const column = currentColumn(state)
  const issues = validateSettings({ stdFlow: state.stdFlow, pressure: state.pressure, column })
  return (
    <section className="card settings-card" aria-labelledby="settings-title">
      <div className="custom-head">
        <h2 id="settings-title" style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
          Method settings · {column.name}
        </h2>
        <div className="muted" style={{ fontSize: 12 }}>
          Column values unless you change them; reset when you pick another column
        </div>
      </div>
      <div className="settings-grid">
        <div className="field">
          <label htmlFor="std-flow">Standard flow (ml/min)</label>
          <DefaultNumber
            id="std-flow"
            value={state.stdFlow}
            fallback={stdFlowOf({ stdFlow: null, column })}
            onChange={(value) => dispatch({ type: 'setStdFlow', value })}
            checkLabel="Column value"
            checkName="Standard flow: use the column's recommended flow"
            invalid={issues.some((i) => i.field === 'stdFlow')}
            describedBy={issues.length ? 'settings-issues' : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="pressure-limit">Pressure limit (MPa)</label>
          <DefaultNumber
            id="pressure-limit"
            step="0.05"
            value={state.pressure}
            fallback={column.p}
            onChange={(value) => dispatch({ type: 'setPressure', value })}
            checkLabel="Column value"
            checkName="Pressure limit: use the column's limit"
            invalid={issues.some((i) => i.field === 'pressure')}
            describedBy={issues.length ? 'settings-issues' : undefined}
          />
        </div>
        <p className="muted settings-note">Phases with “Default” flow run at the standard flow. The pressure limit is written to the file as Max pressure.</p>
      </div>
      {issues.length > 0 && (
        <div id="settings-issues" role="status">
          {issues.map((i, k) => (
            <div key={k} className="warning">
              {i.message}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
