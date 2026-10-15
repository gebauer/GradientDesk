import { useCallback } from 'react'
import type { Action, State } from '../state/store'
import { MethodsPopover } from './MethodsPopover'
import { downloadTxt, exportBlocker } from './exportTxt'

export function TopBar({ state, dispatch }: { state: State; dispatch: (a: Action) => void }) {
  const blocker = exportBlocker(state)
  const close = useCallback(() => dispatch({ type: 'closeMethods' }), [dispatch])
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" />
        GradientDesk
      </div>
      <div className="divider-v" />
      <input
        className="method-name"
        aria-label="Method name"
        value={state.methodName}
        onChange={(e) => dispatch({ type: 'setMethodName', name: e.target.value })}
      />
      <div className="spacer" />
      {state.status && (
        <div className={`status${state.status.sticky ? ' status-error' : ''}`} role="status">
          {state.status.text}
        </div>
      )}
      <button type="button" className="btn" onClick={() => dispatch({ type: 'save', now: new Date().toISOString() })}>
        Save
      </button>
      <div className="popover-anchor">
        <button type="button" className="btn" aria-expanded={state.showMethods} onClick={() => dispatch({ type: 'toggleMethods' })}>
          Methods ({state.library.length}) ▾
        </button>
        {state.showMethods && <MethodsPopover state={state} dispatch={dispatch} onClose={close} />}
      </div>
      <button type="button" className="btn btn-primary" disabled={!!blocker} title={blocker ?? undefined} onClick={() => downloadTxt(state)}>
        Export .txt
      </button>
    </header>
  )
}
