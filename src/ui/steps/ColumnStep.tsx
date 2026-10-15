import { useState, type ChangeEvent } from 'react'
import { columnsFor, searchColumns } from '../../domain/columns'
import { APPLICATIONS } from '../../domain/templates'
import { allColumns, type Action, type State } from '../../state/store'
import { fmt } from '../format'
import { StepHeader } from '../StepHeader'

const EMPTY = { name: '', cv: '', flow: '', p: '' }

export function ColumnStep({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const app = APPLICATIONS.find((a) => a.id === state.app)
  const listed = columnsFor(state.app, allColumns(state))
  const [query, setQuery] = useState('')
  const cols = searchColumns(listed, query)
  const [draft, setDraft] = useState(EMPTY)
  const set = (k: keyof typeof EMPTY) => (e: ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }))

  const cv = parseFloat(draft.cv)
  const flow = parseFloat(draft.flow)
  const p = parseFloat(draft.p)
  const canAdd = draft.name.trim() !== '' && cv > 0 && flow > 0

  const add = () => {
    if (!canAdd) return
    dispatch({ type: 'addCustomColumn', id: `custom-${Date.now()}`, name: draft.name.trim(), cv, flow, p: p > 0 ? p : 0.5 })
    setDraft(EMPTY)
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

      <div className="col-search">
        <input
          type="search"
          className="input"
          aria-label="Search columns"
          placeholder="Search by name, manufacturer or size, e.g. superdex 200, bio-rad, 5 ml"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('')
          }}
        />
        <span className="muted" aria-live="polite">
          {query ? `${cols.length} of ${listed.length} columns` : `${listed.length} columns`}
        </span>
      </div>

      <div className="card col-table" role="radiogroup" aria-label="Column">
        <div className="col-grid col-head label-caps">
          <div />
          <div>Column</div>
          <div className="num">CV (ml)</div>
          <div className="num">Max flow (ml/min)</div>
          <div className="num">Pressure limit (MPa)</div>
          <div />
        </div>
        {cols.map((c) => {
          const selected = c.id === state.colId
          return (
            <div
              key={c.id}
              className={`col-grid col-row row${selected ? ' selected' : ''}`}
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => dispatch({ type: 'selectColumn', id: c.id })}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  dispatch({ type: 'selectColumn', id: c.id })
                }
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  const sib = e.key === 'ArrowDown' ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling
                  if (sib instanceof HTMLElement && sib.getAttribute('role') === 'radio') {
                    sib.focus()
                    sib.click()
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
        })}
        {cols.length === 0 && <div className="col-empty">No columns match “{query}”.</div>}
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
