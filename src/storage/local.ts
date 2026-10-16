import { fromJson, toMethodFile, type MethodFile } from '../domain/methodJson'
import type { Column, Method } from '../domain/types'

/** localStorage keys (docs/SPEC.md). Values are wrapped as { version, ... } for migrations. */
export const KEYS = { customColumns: 'gd.customColumns', methods: 'gd.methods', current: 'gd.current', author: 'gd.author', recentColumns: 'gd.recentColumns' } as const

export interface CurrentDoc {
  method: Method
  step: 1 | 2 | 3 | 4
  sel: number
  /** PrimeView method number 1–99 */
  slot: number
}

interface Stored<T> {
  version: 1
  data: T
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && 'version' in parsed && 'data' in parsed && parsed.version === 1) {
      return (parsed as Stored<unknown>).data
    }
    // Unversioned arrays from the prototype.
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function write<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ version: 1, data } satisfies Stored<T>))
  } catch {
    // Storage full or blocked: the app keeps working in memory.
  }
}

const parseMethod = (x: unknown): Method | null => {
  try {
    return fromJson(JSON.stringify(x))
  } catch {
    return null
  }
}

export function loadCustomColumns(): Column[] {
  const data = read(KEYS.customColumns)
  if (!Array.isArray(data)) return []
  return data
    .filter((c): c is Column => typeof c === 'object' && c !== null && typeof c.id === 'string' && typeof c.name === 'string' && c.cv > 0)
    .map((c) => ({ ...c, manufacturer: c.manufacturer ?? '', flow: c.flow ?? null, apps: [], custom: true }))
}

export function saveCustomColumns(columns: readonly Column[]): void {
  write(KEYS.customColumns, columns)
}

export function loadMethods(): Method[] {
  const data = read(KEYS.methods)
  if (!Array.isArray(data)) return []
  return data.map(parseMethod).filter((m): m is Method => m !== null)
}

export function saveMethods(methods: readonly Method[]): void {
  write<MethodFile[]>(KEYS.methods, methods.map(toMethodFile))
}

export function loadCurrent(): CurrentDoc | null {
  const data = read(KEYS.current)
  if (typeof data !== 'object' || data === null || !('method' in data)) return null
  const d = data as { method: unknown; step?: unknown; sel?: unknown; slot?: unknown }
  const method = parseMethod(d.method)
  if (!method) return null
  const step = [1, 2, 3, 4].includes(d.step as number) ? (d.step as CurrentDoc['step']) : 3
  const sel = typeof d.sel === 'number' ? d.sel : 0
  const slot = typeof d.slot === 'number' && d.slot >= 1 && d.slot <= 99 ? Math.round(d.slot) : 1
  return { method, step, sel, slot }
}

export function saveCurrent(doc: CurrentDoc): void {
  write(KEYS.current, { method: toMethodFile(doc.method), step: doc.step, sel: doc.sel, slot: doc.slot })
}

/** The user's name for the "Created by" line in exported files; per browser. */
export function loadAuthor(): string {
  const data = read(KEYS.author)
  return typeof data === 'string' ? data : ''
}

export function saveAuthor(author: string): void {
  write(KEYS.author, author)
}

/** Recently used column ids, newest first; per browser. */
export function loadRecentColumns(): string[] {
  const data = read(KEYS.recentColumns)
  return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : []
}

export function saveRecentColumns(ids: readonly string[]): void {
  write(KEYS.recentColumns, ids)
}
