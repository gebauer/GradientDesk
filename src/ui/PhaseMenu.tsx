import { useEffect, useRef } from 'react'
import type { MenuAnchor } from './menuAnchor'

interface Props {
  anchor: MenuAnchor
  phaseName: string
  canDelete: boolean
  onAdd: () => void
  onDelete: () => void
  onClose: () => void
}

export function PhaseMenu({ anchor, phaseName, canDelete, onAdd, onDelete, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      aria-label={`Phase ${anchor.index + 1}, ${phaseName}`}
      style={{ left: Math.min(anchor.x, window.innerWidth - 200), top: Math.min(anchor.y, window.innerHeight - 96) }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
        e.preventDefault()
        const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
        const i = items.indexOf(document.activeElement as HTMLButtonElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
      }}
    >
      <button type="button" role="menuitem" onClick={run(onAdd)}>
        Add phase after
      </button>
      <button type="button" role="menuitem" className="danger" disabled={!canDelete} onClick={run(onDelete)}>
        Delete phase
      </button>
    </div>
  )
}
