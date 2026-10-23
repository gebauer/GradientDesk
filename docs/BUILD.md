# BUILD.md – GradientDesk

## Setup
```bash
# already scaffolded (create-vite react-ts template, oxlint for linting)
nvm use
npm install
```
Node 24 LTS (pinned in `.nvmrc`; use `nvm use`). The output is a fully static site (`dist/`), deployed via Docker/nginx on Coolify (see below).

## Project structure
```
src/
  domain/
    types.ts          Phase, Column, Method, Breakpoint
    columns.ts        seed column library
    templates.ts      application templates (imac, iex, sec, equil)
    calc.ts           phaseVolumes(), totals(), breakpoints()
    primeview.ts      toPrimeViewTxt(), fromPrimeViewTxt()
    methodTxt.ts      toMethodTxt(), fromMethodTxt(): dump + method block (table checksum), re-import
    methodJson.ts     method data (localStorage JSON) + version migration
    validate.ts       per-phase warnings and errors
  storage/
    local.ts          load/save for gd.customColumns, gd.methods, gd.current
  state/
    store.ts          useReducer store + actions (selectPhase, updatePhase, dragHandle, addPhase, …)
  ui/
    AppShell.tsx      top bar + left rail + main area
    TopBar.tsx        method name, Save, Methods popover, Export
    MethodsPopover.tsx
    StepRail.tsx      4 steps + stats
    steps/
      ApplicationStep.tsx
      ColumnStep.tsx  table + custom column form
      ProgramStep.tsx chart + phase list + phase form
      ExportStep.tsx  breakpoint table + txt preview
    chart/
      GradientChart.tsx   SVG: bands, %B line, flow line, fractions, handles
      geometry.ts         scales, ticks, drag/keyboard patches (pure, tested)
    form/             Field, NumberInput, Toggle, Segmented, Select
  styles/tokens.css   CSS variables from SPEC.md "Design Tokens"
tests/
  golden/             PrimeView dumps and GradientDesk reference .txt files
  primeview.test.ts
  methodTxt.test.ts
  methodJson.test.ts
  calc.test.ts
```

## Milestones
1. **Domain**: types, columns, templates, calc, breakpoints. Unit tests for volumes, CV↔ml, time, and breakpoint rules (one per phase start, end breakpoint only on %B steps, final end).
2. **Export/Import**: `toPrimeViewTxt` (tab-separated, CRLF) and `fromPrimeViewTxt`, plus golden tests for all 4 templates. JSON round-trip tests.
3. **Shell + steps 1, 2, 4**: static layout per SPEC.md, wired to the store.
4. **Step 3**: phase list and form, then the SVG chart, then handle dragging (pointer events, touch) and keyboard control.
5. **Persistence**: autosave of the current method, library popover, custom columns, file import (TXT) with error messages.
6. **Polish**: hover/focus states, validation warnings, a11y pass, test on Chrome/Edge/Firefox at 1280–1920 px.
7. **Format alignment**: done with the first real sample. Add more golden files (step gradients, loop injection) when samples are available.

## Acceptance checks
- Choosing each application and column produces the template described in SPEC.md with correct ml values.
- Dragging a handle updates the length/%B in the form and the breakpoint table live, and the axis does not jump during the drag.
- Flow above the column max shows the red border and warning text.
- Save → reload → Methods → Open restores the identical method.
- Export .txt → Import gives the same method (table values plus the method block; values finer than the table rounded) and Export .txt again gives a byte-identical file.
- Custom columns survive reload and can be deleted.
- `npm test` and `npm run lint` are clean. `npm run build` produces a working static site.

## Repository (GitHub, public)
- Repo: `gradientdesk`, default branch `main`, protected (PR + green CI required).
- Add `LICENSE` (MIT), `README.md` (what, screenshot, quick start, disclaimer), `CONTRIBUTING.md`, issue templates (bug, column request, format issue).
- Disclaimer in README and app footer: "Not affiliated with or endorsed by Cytiva. Product names are trademarks of their respective owners." The footer is a single 12 px muted line under the main area, together with the app version.
- No secrets, no telemetry, no external requests at runtime.
- `.github/workflows/ci.yml`: on push/PR → `npm ci`, `npm run lint`, `npm test`, `npm run build`.
- Tag releases `vX.Y.Z`; show the version (from `package.json` via Vite `define`) in the app.

## Hosting (Coolify)
Static build served by nginx in a Docker image. In Coolify: New Resource → Public/GitHub repository → Build pack **Dockerfile** → port 80 → domain + auto HTTPS → enable auto-deploy on push to `main`.

The deploy files live in the repo root: `Dockerfile`, `nginx.conf`, `security-headers.conf`. Notes:
- nginx drops server-level `add_header` lines in any `location` that sets its own, so every location includes `security-headers.conf`.
- nginx listens on IPv4 and IPv6, and the healthcheck uses `127.0.0.1` (busybox `wget localhost` goes to `::1`).
Note: data lives in each user's browser (`localStorage`), so redeploys never touch user data. Keep the domain stable — a new origin means empty storage.

Domains: `gradientdesk.xcience.net` is the app; `gradidesk.xcience.net` is a short alias that nginx redirects (301) to it, so all saved methods stay under one origin. Both names must be listed in the Coolify resource's domains (so the proxy routes them and issues certificates) and point to the server in DNS.

## Open points
- Resolved: PrimeView method dump format, from a real sample (`tests/golden/sample-imac-gradient.txt`).
- To confirm on the instrument: two breakpoints at the same volume for %B steps; `Max pressure (kPa)` = column limit; injection valve (`Inj`) for loop injection, e.g. SEC, and the `Waste` keyword for pump wash; special characters (`; = [ \`) in header comment lines; maximum number of breakpoints. Confirmed: linear %B between breakpoints; lines ≤ 100 characters including CRLF; nothing but empty lines after the last breakpoint row.
- Seed column specs are placeholders; verify against datasheets later. The data structure is final.
- Resolved: ÄKTA prime and prime plus do not differ.
