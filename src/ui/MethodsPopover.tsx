import { useEffect, useRef } from 'react'
import { fromJson, MethodImportError, toJson } from '../domain/methodJson'
import { APPLICATIONS } from '../domain/templates'
import { currentMethod, type Action, type State } from '../state/store'
import { downloadText } from './download'

export function MethodsPopover({ state, dispatch, onClose }: { state: State; dispatch: (a: Action) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const importFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const method = fromJson(await file.text())
      dispatch({ type: 'openMethod', method, message: `Imported ${file.name}` })
    } catch (err) {
      const reason = err instanceof MethodImportError ? err.message : 'The file could not be read.'
      dispatch({ type: 'setStatus', status: { text: `Could not import ${file.name}: ${reason}`, sticky: true } })
    }
  }

  const exportJson = () => {
    const m = currentMethod(state, new Date().toISOString())
    downloadText(`${m.name || 'method'}.json`, toJson(m), 'application/json')
  }

  return (
    <div className="popover" ref={ref} role="dialog" aria-label="Saved methods">
      <div className="popover-head">
        <div className="popover-title">Saved methods</div>
        <div className="muted" style={{ fontSize: 12 }}>
          Stored in this browser
        </div>
      </div>
      <div className="popover-list">
        {state.library.length === 0 && <div className="popover-empty">No saved methods yet. Use Save, or import a file.</div>}
        {state.library.map((m, i) => {
          const short = APPLICATIONS.find((a) => a.id === m.application)?.short ?? '–'
          return (
            <div key={`${m.name}-${i}`} className="popover-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {short} · {m.column.name} · {m.phases.length} phases · {new Date(m.modified).toLocaleDateString()}
                </div>
              </div>
              <button type="button" className="btn btn-outline" onClick={() => dispatch({ type: 'openMethod', method: m, message: `Opened “${m.name}”` })}>
                Open
              </button>
              <button type="button" className="icon-btn" style={{ fontSize: 16 }} aria-label={`Delete ${m.name}`} onClick={() => dispatch({ type: 'deleteMethod', index: i })}>
                ×
              </button>
            </div>
          )
        })}
      </div>
      <div className="popover-foot">
        <label className="btn file-btn">
          Import .json
          <input type="file" accept=".json,application/json" className="visually-hidden" onChange={(e) => void importFile(e.currentTarget)} />
        </label>
        <span className="spacer" />
        <button type="button" className="btn" onClick={exportJson}>
          Export .json
        </button>
      </div>
    </div>
  )
}
