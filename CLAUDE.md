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
- Keep domain logic **pure and framework-free** in `src/domain/`: calculations, templates, breakpoints, txt export/import, JSON (de)serialization. React components only render and dispatch.
- The **export format is the contract**. Any change to `toPrimeViewTxt()` must keep the golden-file tests green. When a real PrimeView sample file arrives, update the golden files first, then the code.
- Round-trip must hold: `fromJson(toJson(m))` deep-equals `m`. `fromTxt(toTxt(m))` must reproduce volumes, %B, flow, fraction, inlet and autozero at every breakpoint. Names and types may differ.
- Volumes and %B are in **ml** and **%**. Store phase length with its unit (`CV`|`ml`) and only convert for display, calculation and export.
- Validate before export:
  - flow > 0 and ≤ column max (show a warning; export stays allowed)
  - 0 ≤ %B ≤ 100
  - length > 0
  - inlet 1–8
- `localStorage` keys: `gd.customColumns`, `gd.methods`, `gd.current`. Version the stored JSON (`version: 1`) and write a migration when the shape changes. Never clear the user's storage.
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

## Domain glossary
- **CV**: column volume (ml)
- **%B**: concentration of buffer B
- **Breakpoint**: a row in the PrimeView table at a given volume
- **Inlet A**: position of the inlet valve (A1–A8; A8 is used for the sample)
- **Autozero**: zero the UV signal at that breakpoint
- **Isocratic**: constant %B; **gradient**: linear %B change over the phase

## Decisions
- ÄKTA prime and prime plus are treated as identical; no separate system variant.
- Seed column values are placeholders: the data structure is final, the numbers get verified later.
- The PrimeView txt layout stays preliminary until a real sample file is available.
- License: MIT.

## Commands
- `npm run dev`: dev server
- `npm test`: unit and golden-file tests
- `npm run build`: static build to `dist/`
- `npm run lint`: oxlint + `tsc -b` (type check)
