import { useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { calcProgram, expandPhases, type ProgramCalc } from '../../domain/calc'
import type { Column, Phase } from '../../domain/types'
import type { Action } from '../../state/store'
import { fmt } from '../format'
import { phaseColor } from '../phaseColors'
import { dragPatch, geometry, keyPatch, levelPatch, PAD, tickStep } from './geometry'

const H = 240
const WARN = 'oklch(0.6 0.15 25)'

interface Props {
  phases: readonly Phase[]
  calc: ProgramCalc
  column: Column
  sel: number
  dragDomain: number | null
  dispatch: (a: Action) => void
  /** Right-click on a phase band. */
  onPhaseMenu?: (e: ReactMouseEvent<SVGElement>, index: number) => void
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(1104)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth || 1104)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.max(400, Math.floor(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export function GradientChart({ phases, calc, column, sel, dragDomain, dispatch, onPhaseMenu }: Props) {
  const [ref, W] = useWidth()
  const svgRef = useRef<SVGSVGElement>(null)
  /** End handle (length + %B) or the %B line of an isocratic phase (%B only). */
  const dragging = useRef<{ index: number; mode: 'end' | 'level' } | null>(null)
  const g = geometry(W, H, calc.total, dragDomain)

  const maxFlow = Math.max(column.flow ?? 0, ...phases.map((p) => p.flow)) * 1.15 || 1
  const yf = (f: number) => PAD.top + (1 - f / maxFlow) * g.ih

  const startDrag = (e: ReactPointerEvent<SVGElement>, i: number, mode: 'end' | 'level' = 'end') => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = { index: i, mode }
    dispatch({ type: 'dragStart', index: i, domain: calc.total })
  }

  const moveDrag = (e: ReactPointerEvent<SVGElement>) => {
    const d = dragging.current
    const svg = svgRef.current
    if (d === null || !svg) return
    const i = d.index
    const r = svg.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const py = ((e.clientY - r.top) / r.height) * H
    const patch = d.mode === 'level' ? levelPatch(g.b(py)) : dragPatch(phases[i], calc.phases[i].v0, g.ml(px), g.b(py), column.cv)
    dispatch({ type: 'updatePhase', index: i, patch })
  }

  const endDrag = () => {
    if (dragging.current === null) return
    dragging.current = null
    dispatch({ type: 'dragEnd' })
  }

  const step = tickStep(g.dom)
  const xTicks: number[] = []
  // Skip labels that would collide with the "ml" unit label at the right edge.
  for (let v = 0; v <= g.dom + 1e-6; v += step) if (g.x(v) <= W - PAD.right - 24) xTicks.push(v)

  let fracPath = ''
  let n = 0
  phases.forEach((p, i) => {
    const c = calc.phases[i]
    if (p.frac > 0) {
      for (let u = c.v0; u < c.v1 - 1e-6 && n < 600; u += p.frac, n++) fracPath += `M${g.x(u).toFixed(1)} ${H - PAD.bottom} v6 `
    }
  })

  const x1 = W - PAD.right
  // Lines follow the segments as they run, so a pump wash shows each line's %B.
  const segs = expandPhases(phases).map((s) => s.p)
  const segCalc = calcProgram(segs, column)
  const line = segCalc.phases.map((c) => `${g.x(c.v0)},${g.y(c.b0)} ${g.x(c.v1)},${g.y(c.b1)}`).join(' ')
  const flowLine = segCalc.phases.map((c, i) => `${g.x(c.v0)},${yf(segs[i].flow)} ${g.x(c.v1)},${yf(segs[i].flow)}`).join(' ')
  /** Autozero runs at the start breakpoint of its segment (a pump wash: first line only). */
  const autozeros = segCalc.phases.filter((_, i) => segs[i].az).map((c) => c.v0)
  /** Pump wash %B comes from its lines; it is edited in the form, not dragged. */
  const draggable = (p: Phase) => p.type !== 'pumpwash'

  return (
    <div className="card chart-card">
      <div className="legend" aria-hidden="true">
        <div>
          <span style={{ width: 16, height: 2, background: 'var(--ink)' }} />
          Conc %B
        </div>
        <div>
          <span style={{ width: 16, height: 0, borderTop: '1.5px dashed var(--chart-flow)' }} />
          Flow
        </div>
        <div>
          <span style={{ width: 1, height: 8, background: 'var(--text-secondary)' }} />
          Fractions
        </div>
        <div>
          <svg width={8} height={7} viewBox="0 0 8 7">
            <path d="M0 0h8L4 7z" fill="var(--ink)" />
          </svg>
          Autozero
        </div>
      </div>
      <div className="chart" ref={ref}>
        <svg
          ref={svgRef}
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="group"
          aria-label="Gradient program: %B and flow over volume"
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {calc.phases.map((c, i) => {
            const p = phases[i]
            const x = g.x(c.v0)
            const w = Math.max(1, g.x(c.v1) - x)
            const label = w > 90 ? p.name : w > 22 ? String(i + 1) : ''
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={PAD.top}
                  width={w}
                  height={g.ih}
                  fill={phaseColor(p.type, i === sel ? 0.3 : 0.12)}
                  style={{ cursor: 'pointer' }}
                  onClick={() => dispatch({ type: 'selectPhase', index: i })}
                  onContextMenu={onPhaseMenu && ((e) => onPhaseMenu(e, i))}
                />
                <rect x={x} y={PAD.top - 6} width={w} height={4} fill={phaseColor(p.type)} />
                <text x={x + 5} y={PAD.top + 14} fill="#3a3a38" fontSize={11} pointerEvents="none">
                  {label}
                </text>
              </g>
            )
          })}
          {[0, 25, 50, 75, 100].map((b) => (
            <g key={b} pointerEvents="none">
              <line x1={PAD.left} x2={x1} y1={g.y(b)} y2={g.y(b)} stroke="#000" strokeOpacity={0.08} />
              <text x={PAD.left - 6} y={g.y(b) + 3} fill="var(--text-muted)" fontSize={10} textAnchor="end">
                {b}%
              </text>
            </g>
          ))}
          {xTicks.map((v) => (
            <text key={v} x={g.x(v)} y={H - 6} fill="var(--text-muted)" fontSize={10} textAnchor="middle">
              {fmt(v)}
            </text>
          ))}
          <text x={x1} y={H - PAD.bottom + 16} fill="var(--text-muted)" fontSize={10} textAnchor="end">
            ml
          </text>
          {column.flow !== null && (
            <g pointerEvents="none">
              <line x1={PAD.left} x2={x1} y1={yf(column.flow)} y2={yf(column.flow)} stroke={WARN} strokeDasharray="2 3" strokeWidth={1} />
              <text x={x1 - 4} y={yf(column.flow) + 12} fill="oklch(0.5 0.15 25)" fontSize={10} textAnchor="end">
                column max {fmt(column.flow)} ml/min
              </text>
            </g>
          )}
          {autozeros.map((v) => (
            <g key={v} pointerEvents="none">
              <line x1={g.x(v)} x2={g.x(v)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--ink)" strokeOpacity={0.35} strokeDasharray="1 2" />
              <path d={`M${g.x(v) - 4} ${PAD.top - 16}h8l-4 7z`} fill="var(--ink)" />
            </g>
          ))}
          <path d={fracPath || 'M0 0'} stroke="var(--text-secondary)" strokeWidth={1} pointerEvents="none" />
          <polyline points={flowLine} fill="none" stroke="var(--chart-flow)" strokeDasharray="4 3" strokeWidth={1.5} pointerEvents="none" />
          <polyline points={line} fill="none" stroke="var(--ink)" strokeWidth={2} pointerEvents="none" />
          {calc.phases.map((c, i) =>
            phases[i].grad || !draggable(phases[i]) ? null : (
              <line
                key={i}
                className="level-line"
                aria-hidden="true"
                x1={g.x(c.v0)}
                x2={g.x(c.v1)}
                y1={g.y(c.b0)}
                y2={g.y(c.b0)}
                stroke="transparent"
                strokeWidth={12}
                onPointerDown={(e) => startDrag(e, i, 'level')}
                onContextMenu={onPhaseMenu && ((e) => onPhaseMenu(e, i))}
              >
                <title>Drag up or down to change %B</title>
              </line>
            ),
          )}
          {calc.phases.map((c, i) => {
            const p = phases[i]
            if (!draggable(p)) return null
            return (
              <g
                key={i}
                className="handle"
                tabIndex={0}
                role="button"
                aria-label={`End of phase ${i + 1}, ${p.name}: ${fmt(p.len)} ${p.unit}, ${fmt(c.b1)} %B. Arrow keys change length and %B, Shift for larger steps.`}
                onPointerDown={(e) => startDrag(e, i)}
                onFocus={() => dispatch({ type: 'selectPhase', index: i })}
                onKeyDown={(e) => {
                  const patch = keyPatch(p, e.key, e.shiftKey)
                  if (!patch) return
                  e.preventDefault()
                  dispatch({ type: 'updatePhase', index: i, patch })
                }}
              >
                <circle cx={g.x(c.v1)} cy={g.y(c.b1)} r={12} fill="transparent" className="handle-ring" />
                <circle
                  cx={g.x(c.v1)}
                  cy={g.y(c.b1)}
                  r={5}
                  fill={i === sel ? phaseColor(p.type) : '#fff'}
                  stroke="var(--ink)"
                  strokeWidth={1.5}
                  className="handle-dot"
                  pointerEvents="none"
                />
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
