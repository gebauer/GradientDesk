import { breakpoints } from '../domain/calc'
import { programTotals } from '../domain/totals'
import type { Column, Phase } from '../domain/types'
import { fmt, formatRunTime } from './format'

/** Live totals under the phase form: run, fractions and buffer use. Recomputed on every change. */
export function ProgramTotals({ phases, column }: { phases: readonly Phase[]; column: Column }) {
  const t = programTotals(phases, column)
  const bufferSum = t.buffers.reduce((s, b) => s + b.ml, 0)
  return (
    <section className="card totals-card" aria-labelledby="totals-title">
      <h2 id="totals-title" className="label-caps totals-title">
        Program totals
      </h2>
      <div className="totals-grid">
        <dl className="totals-group" aria-label="Run">
          <dt>Total volume</dt>
          <dd>{fmt(t.volume)} ml</dd>
          <dt>Run time</dt>
          <dd>{formatRunTime(t.time)}</dd>
          <dt>Phases</dt>
          <dd>{phases.length}</dd>
          <dt>Breakpoints</dt>
          <dd>{breakpoints(phases, column).length}</dd>
        </dl>
        <dl className="totals-group" aria-label="Fractions">
          <dt>Fractions</dt>
          <dd>{t.fractions || '–'}</dd>
          <dt>Collected</dt>
          <dd>{t.fractions ? `${fmt(t.fractionMl)} ml` : '–'}</dd>
          <dt>Fraction size</dt>
          <dd>{t.fractionSizes.length ? `${t.fractionSizes.map((s) => fmt(s)).join(', ')} ml` : '–'}</dd>
        </dl>
        <div className="totals-group-wrap">
          <dl className="totals-group totals-buffers" aria-label="Buffer use">
            {t.buffers.map((b) => (
              <div key={b.line} className="totals-row">
                <dt>{b.line === 'B' ? 'Buffer B' : `Inlet ${b.line}`}</dt>
                <dd>{fmt(b.ml)} ml</dd>
              </div>
            ))}
            <div className="totals-row totals-sum">
              <dt>All lines</dt>
              <dd>{fmt(bufferSum)} ml</dd>
            </div>
          </dl>
          <p className="muted totals-note">Pumped by the program, rounded. Add volume for priming, tubing and the bottle dead volume.</p>
        </div>
      </div>
    </section>
  )
}
