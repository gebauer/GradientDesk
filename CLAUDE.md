# CLAUDE.md – GradientDesk

## What this is
A static web app for planning ÄKTA prime chromatography methods graphically and exporting them as a PrimeView breakpoint `.txt`. There is no backend and everything runs in the browser. The UI language is **English**.

The design and behavior are specified in `docs/SPEC.md` (source of truth) and `docs/prototype/GradientDesk.dc.html` (layout **1a** only, prototype). Ignore layout 1b.

## Repository layout
- `docs/SPEC.md`: design handoff spec (screens, behavior, data model, tokens)
- `docs/BUILD.md`: stack, project structure, milestones, acceptance checks, hosting
- `docs/prototype/`: HTML prototype (open `GradientDesk.dc.html` in a browser; needs `support.js` next to it)
- `src/`, `tests/`: the app (see `docs/BUILD.md` for the structure)

## Stack
Vite + React 19 (latest stable) + TypeScript (strict). Node 24 LTS (`.nvmrc`). Plain CSS modules or a single tokens CSS file. No UI framework, no chart library: the chart is a hand-written SVG component. Vitest for tests. See `docs/BUILD.md`.

## Rules
- Keep domain logic **pure and framework-free** in `src/domain/`: calculations, templates, breakpoints, txt export/import (incl. the method block), method data (de)serialization for localStorage. React components only render and dispatch.
- The **export format is the contract**. Any change to `toPrimeViewTxt()` must keep the golden-file tests green. In `tests/golden/`, `sample-*.txt` are real PrimeView dumps, `gradientdesk-*.txt` GradientDesk's reference output and `legacy-*.txt` older output that must still import (all CRLF with trailing spaces; `.gitattributes` keeps them byte-exact). When a new sample arrives, add it as a golden file first, then change the code.
- PrimeView rejects any line over 100 characters including CRLF (98 visible) and anything but empty lines after the last breakpoint row (comments included). Keep every written line ≤ 96 (`MAX_LINE`) and all comments in the header.
- There is no JSON file export/import. In the `.txt` the breakpoint table is the source of truth; a compact `**` comment block in the header adds only what the table can't hold (names, types, units, CV lengths, column, …) and a checksum of the table, so an import notices a table edited elsewhere (INI style, `docs/primeview-format.md` §11). JSON is only the localStorage format.
- Round-trip must hold: `fromJson(toJson(m))` deep-equals `m`; `fromMethodTxt(toMethodTxt(m))` deep-equals `m` (apart from `modified`; a pump wash's unused %B comes back as written), and exporting that again gives a byte-identical file. The breakpoint table alone (`fromPrimeViewTxt(toPrimeViewTxt(m))`) must reproduce volumes, %B, flow, fraction, inlet, injection valve and autozero at every breakpoint. Names and types may differ.
- Volumes and %B are in **ml** and **%**. Store phase length with its unit (`CV`|`ml`) and only convert for display, calculation and export.
- Accept only what the system can run: whole %B, flow and fraction size in 0.1 steps, ml lengths in 0.1 ml (CV lengths 0.01 CV), pressure in whole kPa. Values snap on entry (`snapPhase` in `src/domain/calc.ts`); stored and imported methods snap on open.
- Validate before export:
  - flow > 0 and ≤ column max (show a warning; export stays allowed)
  - each phase ≥ 0.1 ml after rounding, ≥ 0.2 ml after a %B step (errors block export)
  - 0 ≤ %B ≤ 100
  - length > 0
  - inlet 1–8
- `localStorage` keys: `gd.customColumns`, `gd.methods`, `gd.current`, `gd.author`, `gd.recentColumns`. Version the stored JSON (`version: 1`) and write a migration when the shape changes. Never clear the user's storage.
- Use the colors, sizes and spacing exactly as listed under *Design Tokens* in `docs/SPEC.md`. Phase colors come from one map keyed by phase type.
- Use tabular numbers for all numeric UI.
- Accessibility:
  - all inputs labelled
  - handles keyboard-operable (arrow keys: ±0.1 length / ±1 %B, Shift for ×10)
  - focus rings visible
- Do not add features, sections or copy that aren't in `docs/SPEC.md` without asking.

## Repo & deployment
- Public GitHub repo; everything committed is public. No secrets, no internal lab data, no real sample files without permission.
- Deployed on Coolify from `main` via the `Dockerfile` (nginx, static). Keep `Dockerfile`, `nginx.conf` and CI working; any PR must pass `lint`, `test`, `build`.
- Keep the "not affiliated with Cytiva" disclaimer (README and app footer); never use Cytiva logos or other Cytiva material.
- Conventional commits (`feat:`, `fix:`, `chore:`…).
- Every commit bumps the version in `package.json` (and `package-lock.json`, e.g. `npm version <x.y.z> --no-git-tag-version`): minor (`0.1.0` → `0.2.0`) by default, patch (`0.2.0` → `0.2.1`) for very small changes. For big changes, suggest a major bump to the owner instead of doing it.

## Domain glossary
- **CV**: column volume (ml)
- **%B**: concentration of buffer B
- **Breakpoint**: a row in the PrimeView table at a given volume
- **Inlet A**: position of the inlet valve (A1–A8). Sample loop injections (Inject) run on A1; only loading over the system pump (> 50 ml, valve Load) draws the sample through A8
- **Injection valve**: Load (pump → column), Inject (pump → loop → column), Waste (pump → waste, column bypassed; used by the pump wash phase)
- **Pump wash**: one phase with checked lines (B, A1–A8) and a volume per line (default 40 ml at 10 ml/min, Waste); runs and exports as one segment per line in the order B, A8 … A1
- **Autozero**: zero the UV signal at that breakpoint
- **Isocratic**: constant %B; **gradient**: linear %B change over the phase

## Decisions
- ÄKTA prime and prime plus are treated as identical; no separate system variant.
- Seed column library comes from `docs/data/columns-source.de.csv`; values are unverified until checked against datasheets. Unknown max flow is `null`, never a guess.
- Applications: General (default, all columns), Elute pre-loaded column (all columns, no sample phase), Load & elute over system pump (all columns, sample > 50 ml on A8 with Load), IMAC, affinity, IEX, HIC, SEC (incl. desalting), column equilibration. The affinity and HIC templates are proposals pending review.
- PrimeView export is the ÄKTA prime method dump format, spec in `docs/primeview-format.md`. Breakpoints: one per phase start, final end; on a %B step the phase ends at its volume and the next start follows at +0.1 ml (same-volume breakpoints don't work on the instrument). Files are `PrimeMeth_NNN.txt` (1–99).
- The ÄKTA prime has a 4 ml mixer: gradients over less than 10 ml get a warning.
- License: MIT.

## Commands
- `npm run dev`: dev server
- `npm test`: unit and golden-file tests
- `npm run build`: static build to `dist/`
- `npm run lint`: oxlint + `tsc -b` (type check)
