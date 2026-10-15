import type { MouseEvent as ReactMouseEvent } from 'react'

export interface MenuAnchor {
  x: number
  y: number
  index: number
}

/** Position for a context menu: the pointer, or the element when opened from the keyboard (menu key / Shift+F10). */
export function menuAnchor(e: ReactMouseEvent<Element>, index: number): MenuAnchor {
  if (e.clientX === 0 && e.clientY === 0) {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: r.left + 16, y: r.top + r.height / 2, index }
  }
  return { x: e.clientX, y: e.clientY, index }
}
