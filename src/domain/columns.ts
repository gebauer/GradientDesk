import type { ApplicationId, Column } from './types'

/** ÄKTA prime / prime plus system pressure limit in MPa. */
export const SYSTEM_MAX_PRESSURE = 1.0

/**
 * Seed column library, from docs/data/columns-source.de.csv.
 * Values are unverified against vendor datasheets. The recommended flow is the vendor's typical
 * value (the lower end where only a range is given, with the range in the note); `est` marks
 * values estimated where the vendor gives none.
 */

interface Size {
  cv: number
  /** ml/min; null = vendor gives no value */
  flow: number | null
  /** Recommended flow, ml/min */
  rec: number
  /** MPa; overrides the entry's pressure for this size */
  p?: number
}

interface Entry {
  /** Product names; each one becomes its own column per size. */
  names: string[]
  manufacturer: string
  apps: ApplicationId[]
  /** MPa, lower of packed bed and hardware limit */
  p: number
  sizes: Size[]
  /** Recommended flows are estimates, not vendor values. */
  est?: boolean
  /** Size goes into the name ("HisTrap HP 1 ml"); off for columns sold in one size. */
  sizeInName?: boolean
  note?: string
}

/** 1 ml and 5 ml cartridges; recommended flow 1 CV/min unless given. */
const hitrap = (flow1: number | null, flow5: number | null, rec1 = 1, rec5 = 5): Size[] => [
  { cv: 1, flow: flow1, rec: rec1 },
  { cv: 5, flow: flow5, rec: rec5 },
]

const ENTRIES: Entry[] = [
  // IMAC
  { names: ['HisTrap HP', 'HisTrap FF', 'HisTrap FF crude', 'HisTrap excel'], manufacturer: 'Cytiva', apps: ['imac'], p: 0.5, sizes: hitrap(4, 20) },
  { names: ['EconoFit Profinity IMAC'], manufacturer: 'Bio-Rad', apps: ['imac'], p: 0.5, sizes: hitrap(6, 20), note: 'Recommended 1–2 ml/min (1 ml) or 5–10 ml/min (5 ml).' },
  { names: ['EconoFit Nuvia IMAC'], manufacturer: 'Bio-Rad', apps: ['imac'], p: 0.5, sizes: hitrap(null, null), est: true },
  { names: ['Bio-Scale Mini Profinity IMAC', 'Bio-Scale Mini Nuvia IMAC'], manufacturer: 'Bio-Rad', apps: ['imac'], p: 0.31, sizes: hitrap(null, null), est: true, note: 'Being replaced by EconoFit.' },
  { names: ['HisPur Ni-NTA Chromatography Cartridge'], manufacturer: 'Thermo Fisher', apps: ['imac'], p: 0.3, sizes: hitrap(4, 10), note: 'Recommended 1–2 ml/min (1 ml) or 5 ml/min (5 ml); load at 0.5–1 or 1–2 ml/min.' },
  { names: ['Ni-NTA Superflow Cartridge'], manufacturer: 'Qiagen', apps: ['imac'], p: 0.5, sizes: hitrap(null, null), est: true, note: 'No cartridge pressure limit given (resin 1.0 MPa); 0.5 MPa assumed to be safe.' },
  { names: ['His60 Ni Superflow Cartridge'], manufacturer: 'Takara Bio', apps: ['imac'], p: 0.5, sizes: hitrap(10, 40), est: true },

  // Affinity (step elution)
  { names: ['GSTrap HP', 'GSTrap FF'], manufacturer: 'Cytiva', apps: ['affinity'], p: 0.5, sizes: hitrap(4, 20, 0.5, 2.5), note: 'Slow binding kinetics: load at 0.2–1 ml/min (1 ml) or 0.5–5 ml/min (5 ml), wash at 1–2 or 5–10 ml/min.' },
  { names: ['GSTrap 4B'], manufacturer: 'Cytiva', apps: ['affinity'], p: 0.5, sizes: hitrap(1, 5, 0.5, 2.5), note: 'Max flow is the recommended upper value; no separate maximum given.' },
  { names: ['StrepTrap HP', 'StrepTrap XT'], manufacturer: 'Cytiva', apps: ['affinity'], p: 0.5, sizes: hitrap(4, 20) },
  { names: ['MBPTrap HP'], manufacturer: 'Cytiva', apps: ['affinity'], p: 0.5, sizes: hitrap(4, 20), note: 'Load at 0.5 ml/min (1 ml) or 2.5 ml/min (5 ml) if needed.' },
  { names: ['HiTrap Protein A HP', 'HiTrap Protein G HP'], manufacturer: 'Cytiva', apps: ['affinity'], p: 0.3, sizes: hitrap(4, 20) },
  { names: ['HiTrap Heparin HP'], manufacturer: 'Cytiva', apps: ['affinity', 'iex'], p: 0.5, sizes: hitrap(4, 20) },
  { names: ['Bio-Scale Mini Profinity GST'], manufacturer: 'Bio-Rad', apps: ['affinity'], p: 0.31, sizes: hitrap(null, null, 0.5, 2.5), est: true, note: 'Slow binding kinetics, as with GSTrap.' },
  { names: ['Bio-Scale Mini Profinity eXact'], manufacturer: 'Bio-Rad', apps: ['affinity'], p: 0.31, sizes: [{ cv: 5, flow: null, rec: 2 }], est: true },
  { names: ['Bio-Scale Mini UNOsphere SUPrA'], manufacturer: 'Bio-Rad', apps: ['affinity'], p: 0.31, sizes: hitrap(3, 15), note: 'Recommended 1–2 ml/min (1 ml) or 5–10 ml/min (5 ml).' },
  { names: ['Strep-Tactin XT 4Flow Cartridge'], manufacturer: 'IBA Lifesciences', apps: ['affinity'], p: 0.35, sizes: hitrap(1, 3, 0.5, 1), note: 'Recommended 0.5–1 ml/min (1 ml) or 1–3 ml/min (5 ml); max flow is the upper end of the vendor range.' },

  // IEX
  { names: ['HiTrap Q HP', 'HiTrap SP HP', 'HiTrap Q FF', 'HiTrap SP FF', 'HiTrap DEAE FF', 'HiTrap CM FF'], manufacturer: 'Cytiva', apps: ['iex'], p: 0.5, sizes: hitrap(4, 20) },
  { names: ['HiPrep Q FF 16/10', 'HiPrep SP FF 16/10', 'HiPrep DEAE FF 16/10', 'HiPrep CM FF 16/10'], manufacturer: 'Cytiva', apps: ['iex'], p: 0.15, sizes: [{ cv: 20, flow: 10, rec: 5 }], sizeInName: false, note: 'Recommended 2–10 ml/min.' },
  { names: ['Mono Q 5/50 GL', 'Mono S 5/50 GL'], manufacturer: 'Cytiva', apps: ['iex'], p: 4, sizes: [{ cv: 1, flow: 3, rec: 1 }], sizeInName: false, note: 'Recommended 0.5–3 ml/min. Limited to 1 MPa by the system.' },
  { names: ['EconoFit UNOsphere Q', 'EconoFit UNOsphere S'], manufacturer: 'Bio-Rad', apps: ['iex'], p: 0.5, sizes: hitrap(null, null), est: true },
  { names: ['Bio-Scale Mini UNOsphere Q', 'Bio-Scale Mini UNOsphere S', 'Bio-Scale Mini Macro-Prep High Q', 'Bio-Scale Mini Macro-Prep High S'], manufacturer: 'Bio-Rad', apps: ['iex'], p: 0.31, sizes: hitrap(null, null), est: true },
  { names: ['Bio-Scale Mini CHT'], manufacturer: 'Bio-Rad', apps: ['iex'], p: 0.31, sizes: [{ cv: 5, flow: null, rec: 2 }], est: true, note: 'Hydroxyapatite (mixed mode); phosphate gradient.' },

  // HIC
  { names: ['HiTrap Phenyl HP', 'HiTrap Butyl HP', 'HiTrap Octyl FF'], manufacturer: 'Cytiva', apps: ['hic'], p: 0.5, sizes: hitrap(4, 20) },
  { names: ['HiPrep Phenyl FF 16/10', 'HiPrep Butyl FF 16/10', 'HiPrep Octyl FF 16/10'], manufacturer: 'Cytiva', apps: ['hic'], p: 0.15, sizes: [{ cv: 20, flow: 10, rec: 5 }], sizeInName: false, note: 'Recommended 2–10 ml/min.' },

  // SEC and desalting
  { names: ['HiTrap Desalting'], manufacturer: 'Cytiva', apps: ['sec'], p: 0.3, sizes: [{ cv: 5, flow: 15, rec: 5 }], note: 'Recommended 1–10 ml/min.' },
  { names: ['HiPrep 26/10 Desalting'], manufacturer: 'Cytiva', apps: ['sec'], p: 0.15, sizes: [{ cv: 53, flow: 31, rec: 10 }], est: true, sizeInName: false, note: 'Up to 15 ml sample.' },
  { names: ['Bio-Scale Mini Bio-Gel P-6 Desalting'], manufacturer: 'Bio-Rad', apps: ['sec'], p: 0.31, sizes: [{ cv: 5, flow: null, rec: 2 }, { cv: 10, flow: null, rec: 2 }, { cv: 50, flow: null, rec: 5, p: 0.28 }], est: true },
  { names: ['HiLoad 16/600 Superdex 75 pg', 'HiLoad 16/600 Superdex 200 pg'], manufacturer: 'Cytiva', apps: ['sec'], p: 0.3, sizes: [{ cv: 120, flow: 1.6, rec: 1 }], sizeInName: false, note: 'Recommended 0.3–1.6 ml/min. Max flow for water at room temperature; halve it at 4 °C or in 20 % ethanol.' },
  { names: ['HiLoad 26/600 Superdex 75 pg', 'HiLoad 26/600 Superdex 200 pg'], manufacturer: 'Cytiva', apps: ['sec'], p: 0.3, sizes: [{ cv: 320, flow: 4.4, rec: 2.6 }], sizeInName: false, note: 'Recommended 0.9–4.4 ml/min. Max flow for water at room temperature; halve it at 4 °C or in 20 % ethanol.' },
  { names: ['Superdex 75 10/300 GL'], manufacturer: 'Cytiva', apps: ['sec'], p: 1.8, sizes: [{ cv: 24, flow: 1.5, rec: 0.5 }], sizeInName: false, note: 'Recommended 0.5–1.0 ml/min. Max flow for water at room temperature. Limited to 1 MPa by the system.' },
  { names: ['Superdex 200 10/300 GL'], manufacturer: 'Cytiva', apps: ['sec'], p: 1.5, sizes: [{ cv: 24, flow: 1.0, rec: 0.5 }], sizeInName: false, note: 'Recommended 0.25–0.75 ml/min. Max flow for water at room temperature. Limited to 1 MPa by the system.' },
  { names: ['Superdex 200 Increase 10/300 GL'], manufacturer: 'Cytiva', apps: ['sec'], p: 3, sizes: [{ cv: 24, flow: 1.8, rec: 0.25 }], est: true, sizeInName: false, note: 'The vendor recommends 0.75 ml/min; on the ÄKTA prime the 1 MPa system limit allows only about 0.2–0.3 ml/min. Max flow for water at room temperature.' },
  { names: ['ENrich SEC 70 10 x 300'], manufacturer: 'Bio-Rad', apps: ['sec'], p: 4.1, sizes: [{ cv: 24, flow: 1.5, rec: 0.5 }], sizeInName: false, note: '0.5–70 kDa. Recommended 0.5–1.5 ml/min. Limited to 1 MPa by the system.' },
  { names: ['ENrich SEC 650 10 x 300'], manufacturer: 'Bio-Rad', apps: ['sec'], p: 4.1, sizes: [{ cv: 24, flow: 2.0, rec: 0.75 }], sizeInName: false, note: '5–650 kDa. Recommended 0.75–2.0 ml/min. Limited to 1 MPa by the system.' },
]

const round1 = (x: number) => Math.round(x * 10) / 10

export function columnId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function expand(e: Entry): Column[] {
  return e.names.flatMap((base) =>
    e.sizes.map((s) => {
      const name = e.sizeInName === false ? base : `${base} ${s.cv} ml`
      const col: Column = {
        id: columnId(name),
        name,
        manufacturer: e.manufacturer,
        cv: s.cv,
        flow: s.flow,
        rec: s.rec,
        p: s.p ?? e.p,
        apps: e.apps,
      }
      if (e.est) col.recEstimated = true
      if (e.note) col.note = e.note
      return col
    }),
  )
}

export const SEED_COLUMNS: readonly Column[] = ENTRIES.flatMap(expand)

/** Applications that list every column. */
export const LISTS_ALL_COLUMNS: readonly ApplicationId[] = ['general', 'preloaded', 'pumpload', 'equil']

/** Columns listed for an application. General, pre-loaded elution, pump load and equilibration list all; custom columns appear everywhere. */
export function columnsFor(app: ApplicationId, columns: readonly Column[]): Column[] {
  return columns.filter((c) => LISTS_ALL_COLUMNS.includes(app) || c.custom || c.apps.includes(app))
}

/**
 * Column search: every word of the query must appear in the name, manufacturer or size
 * ("superdex 200", "bio-rad imac", "5 ml"). Case-insensitive; an empty query matches all.
 */
export function searchColumns(columns: readonly Column[], query: string): Column[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return [...columns]
  return columns.filter((c) => {
    const text = `${c.name} ${c.manufacturer} ${c.cv} ml ${c.custom ? 'custom' : ''}`.toLowerCase()
    return words.every((w) => text.includes(w))
  })
}

/** Default flow for a custom column: 50 % of its max flow. */
export function customRecFlow(maxFlow: number): number {
  return round1(maxFlow * 0.5)
}

/** Column type filter on the column step; preset from the application. */
export type ColumnType = 'all' | 'imac' | 'affinity' | 'iex' | 'hic' | 'sec'

export const COLUMN_TYPES: readonly { id: ColumnType; label: string }[] = [
  { id: 'all', label: 'All types' },
  { id: 'imac', label: 'IMAC' },
  { id: 'affinity', label: 'Affinity' },
  { id: 'iex', label: 'Ion exchange' },
  { id: 'hic', label: 'HIC' },
  { id: 'sec', label: 'SEC / desalting' },
]

/** Type preset for an application: its own type, or all types for General and Column equilibration. */
export function defaultColumnType(app: ApplicationId): ColumnType {
  return COLUMN_TYPES.some((t) => t.id === app) ? (app as ColumnType) : 'all'
}

/** Vendor filter value for custom columns. */
export const CUSTOM_VENDOR = 'Custom'

const vendorOf = (c: Column) => (c.custom ? CUSTOM_VENDOR : c.manufacturer)

/** Columns of a type; custom columns belong to every type. */
export function columnsOfType(columns: readonly Column[], type: ColumnType): Column[] {
  return columns.filter((c) => type === 'all' || c.custom || c.apps.includes(type))
}

/** Vendors with their column counts, most columns first; custom columns last. */
export function vendorCounts(columns: readonly Column[]): { vendor: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const c of columns) counts.set(vendorOf(c), (counts.get(vendorOf(c)) ?? 0) + 1)
  return [...counts]
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => Number(a.vendor === CUSTOM_VENDOR) - Number(b.vendor === CUSTOM_VENDOR) || b.count - a.count || a.vendor.localeCompare(b.vendor))
}

export interface ColumnFilter {
  type: ColumnType
  /** null = all vendors */
  vendor: string | null
  query: string
}

export function filterColumns(columns: readonly Column[], f: ColumnFilter): Column[] {
  const byVendor = columnsOfType(columns, f.type).filter((c) => f.vendor === null || vendorOf(c) === f.vendor)
  return searchColumns(byVendor, f.query)
}

/** How many recently used columns are kept. */
export const RECENT_LIMIT = 5

/** Moves a column to the front of the recent list. */
export function touchRecent(recent: readonly string[], id: string): string[] {
  return [id, ...recent.filter((x) => x !== id)].slice(0, RECENT_LIMIT)
}

/**
 * Splits a (filtered) column list into the "Recent" section (recently used, newest first,
 * then custom columns) and the rest, keeping the rest in library order.
 */
export function splitRecent(columns: readonly Column[], recent: readonly string[]): { recent: Column[]; rest: Column[] } {
  const byId = new Map(columns.map((c) => [c.id, c]))
  const used = recent.map((id) => byId.get(id)).filter((c): c is Column => c !== undefined)
  const custom = columns.filter((c) => c.custom && !recent.includes(c.id))
  const top = [...used, ...custom]
  const ids = new Set(top.map((c) => c.id))
  return { recent: top, rest: columns.filter((c) => !ids.has(c.id)) }
}
