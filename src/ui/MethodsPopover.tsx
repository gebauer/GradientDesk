import { useEffect, useRef } from 'react'
import { MethodImportError } from '../domain/methodJson'
import { fromMethodTxt } from '../domain/methodTxt'
import { slotFromFileName } from '../domain/primeview'
import { APPLICATIONS } from '../domain/templates'
import { type Action, type State } from '../state/store'

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
      const result = fromMethodTxt(await file.text())
      const slot = slotFromFileName(file.name)
      const message = [`Imported ${file.name}`, ...result.warnings].join(' ')
      if (result.kind === 'method') {
        dispatch({ type: 'openMethod', method: result.method, message, slot, sticky: result.warnings.length > 0 })
      } else {
        const status = { text: message, sticky: result.warnings.length > 0 }
        dispatch({ type: 'importPhases', phases: result.phases, name: file.name.replace(/\.[^.]+$/, ''), slot, status })
      }
    } catch (err) {
      const reason = err instanceof MethodImportError ? err.message : 'The file could not be read.'
      dispatch({ type: 'setStatus', status: { text: `Could not import ${file.name}: ${reason}`, sticky: true } })
    }
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
          Import .txt
          <input type="file" accept=".txt,text/plain" className="visually-hidden" onChange={(e) => void importFile(e.currentTarget)} />
        </label>
      </div>
    </div>
  )
}
