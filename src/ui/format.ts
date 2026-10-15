/** Rounds to `d` decimals and drops trailing zeros: fmt(2.50) → "2.5". */
export const fmt = (n: number, d = 1): string => String(Math.round(n * 10 ** d) / 10 ** d)

/** Fixed decimals for tables: fixed(2) → "2.0". */
export const fixed = (n: number, d = 1): string => n.toFixed(d)

export function formatRunTime(minutes: number): string {
  const total = Math.round(minutes)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h} h ${String(m).padStart(2, '0')} min`
}
