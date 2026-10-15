# Handoff: GradientDesk (ÄKTA prime)

## Overview
A browser app for planning typical chromatography runs on an ÄKTA prime / prime plus. The user picks an application (General, IMAC, affinity, IEX, HIC, SEC / desalting, column equilibration), then a column (library or custom). The app loads a template program, which the user edits either graphically (drag handles in a %B-over-volume chart) or phase by phase in a form. The result is exported as a PrimeView-compatible breakpoint table (`.txt`). Methods are stored in the browser and can be exchanged as JSON. Existing JSON or `.txt` files can be imported and edited.

UI language: **English**. Users: mixed lab staff, teaching and practical courses.

## About the Design Files
`prototype/GradientDesk.dc.html` is a **design reference built in HTML**: a working prototype that shows the intended look and behavior. It is not production code. Recreate it in a proper app (recommended stack in `BUILD.md`). The prototype logic (templates, calculations, export, import) lives in the `<script data-dc-script>` class at the bottom of the file and can be used as a functional reference. Open the file in a browser next to `support.js` to try it.

The file contains two layouts: **1a "Guided wizard"** (chosen, implement this one) and 1b "Chart workspace" (rejected, ignore it).

## Fidelity
**High fidelity** for layout, colors, typography and interactions of layout 1a. The design frame is 1440 × 900 px. The production app should fill the viewport (min width ~1280 px) and keep the same proportions.

---

## Screens / Views (Layout 1a)

### App shell
- **Top bar**: height 52 px, background `#fff`, bottom border 1 px `#dcdcd8`, padding 0 20 px, flex row, gap 16 px, items centered.
  - App icon (`public/favicon.svg`) at 22 × 22 px, plus the label "GradientDesk" (14 px / 600), gap 9 px.
  - Vertical divider: 1 × 22 px `#dcdcd8`.
  - Method name: an inline-editable input, 280 × 30 px, background `#f5f5f4`, transparent border, radius 4 px, 13 px.
  - Spacer (flex 1).
  - Status message (12 px `#55554f`), shown for 2.5 s after save, open or import. Import errors stay visible.
  - **Save** button (secondary).
  - **Methods (n) ▾** button (secondary), which opens the Methods popover.
  - **Export .txt** button (primary).
- **Body**: flex row.
  - **Left rail**: 248 px wide, `#fff`, right border `#dcdcd8`, padding 20 px 14 px. Contains the four wizard steps and a stats block at the bottom.
  - **Main area**: flex 1, padding 24 px 28 px, column, gap 16 px.
- **Footer**: one line at the bottom of the main area, 12 px `#6b6b68`: "GradientDesk v{version} · Not affiliated with or endorsed by Cytiva. Product names are trademarks of their respective owners."

### Wizard step item (left rail)
- Button, padding 10 px, radius 5 px, gap 12 px. Active background `#f0f0ee`, otherwise transparent.
- Number circle: 24 px. Active or done: fill `#1d1d1c` with white text. Upcoming: white fill.
- Title 14 px / 600. Subtitle 12 px `#6b6b68`, ellipsis, max 160 px. The subtitle shows the current choice (application name, column name, "6 phases", "12 breakpoints").
- All steps can be clicked at any time; the order is not enforced.
- **Stats block**: top border `#e4e4e1`, 2-column grid, 12 px. Rows: Total volume, Run time (h/min), Breakpoints, Buffer B max. Values are right-aligned with tabular numbers.

### Step header (every step)
A row with space-between, align end. Left: title 20 px / 600, below it a description 14 px `#6b6b68`. Right: Back (secondary) and Continue / Review export / Download (primary), all 34 px high.

### Step 1 — Choose an application
- Description: "Loads a starting program with typical phases. Everything can be changed later."
- 2-column grid of cards, gap 14 px. The General card comes first and spans both columns; the other six follow in three rows. A fresh start (nothing stored) loads General. Card: `#fff`, padding 20 px, radius 6 px, border 1 px `#dcdcd8` (selected: 1.5 px `#1d1d1c`).
  - Name 16 px / 600, right: "N columns" 12 px muted.
  - Description 13 px `#55554f`, line-height 1.45.
  - Phase preview: a row of 6 px bars in the phase color with labels (11 px) underneath.
- Clicking a card loads that application's template (this replaces the current program).

### Step 2 — Select a column
- Table card (`#fff`, border, radius 6). Grid columns: `40px 1fr 120px 140px 160px 90px` → radio, Column (name, manufacturer below in 12 px muted), CV (ml), Max flow (ml/min), Pressure limit (MPa), tag. Max flow shows "–" when the vendor gives no value.
  - Header: 11 px uppercase, letter-spacing .05em, `#6b6b68`.
  - Row: 14 px, padding 12 × 16, bottom border `#eeeeeb`, selected background `#f3f3f1`. The radio is a 14 px ring with an 8 px dot.
  - Custom columns show the "Custom" tag and an × button to remove them.
  - **Filters** above the table, preset from the application but always changeable (picking a column of another type keeps the loaded program):
  - **Type** select (170 px): All types, IMAC, Affinity, Ion exchange, HIC, SEC / desalting. Preset to the step 1 application; General and Column equilibration preset to All types. Custom columns belong to every type.
  - **Search** input (max 480 px, placeholder "Search by name, manufacturer or size, e.g. superdex 200, 5 ml"). Every word must appear in name, manufacturer or size ("5 ml"), case-insensitive. Escape clears it.
  - Muted count "n of m columns" (m = all columns).
  - **Vendor pills** below: "All vendors" plus one pill per vendor that has columns of the chosen type, with its count, most columns first, "Custom" last. Single select; clicking the active pill returns to All vendors. Pill: 28 px high, radius 14, border `#cfcfcb`, 12 px; active = ink fill, white text.
  - Empty result: "No columns match “…”." or "No columns for this type and vendor."
- **Recent section**: the filtered list is split into "Recent" (the last 5 columns the user chose, newest first, then all custom columns) and "All columns" (the rest, library order), each under an 11 px uppercase section row on `#fafaf9`. Without recent or custom columns there are no section rows. Choosing a column, adding a custom column and opening a method count as use; loading a template or the automatic fallback after removing a custom column don't. Stored per browser in `gd.recentColumns`.
- Card "Add custom column", right label "Saved in this browser only". Grid `2fr 1fr 1fr 1fr auto`: Name, CV (ml), Max flow, Pressure (MPa), button "Add to library" (outline). Name, CV and flow are required. The new column is selected immediately.
- Changing the column clamps each phase's flow to the column's maximum flow. Columns without a max flow (`flow: null`) don't clamp.

### Step 3 — Program (main screen)
- Description: "{App} on {Column} · drag a handle to change length and %B, drag a flat line to move it up or down, right-click a phase for more".
- **Chart card** (`#fff`, border, radius 6, padding 12 16 8). Legend: Conc %B (2 px solid line), Flow (dashed), Fractions (ticks). The SVG is 1104 × 240.
  - Padding: left 36, right 8, top 24, bottom 26.
  - X axis: volume in ml, auto tick step from {0.5,1,2,5,10,20,25,50,100,200,500} so there are ≤ 12 ticks. The "ml" unit label sits at the right.
  - Y axis: 0/25/50/75/100 %, gridlines in black at 8 % opacity.
  - Phase bands: full-height rect filled with the phase color at alpha .12 (selected: .30), a 4 px color bar above the plot, and the label at top-left. The label shows the full name if the band is > 90 px wide, otherwise the number if > 22 px. Clicking a band selects the phase.
  - %B line: polyline, 2 px `#1d1d1c`.
  - Flow line: dashed `4 3`, 1.5 px `#8a8a86`, on its own scale (max = max(column max, phase flows) × 1.15).
  - Column max flow: dotted red line `oklch(0.6 0.15 25)` with the label "column max X ml/min". Not drawn when the column has no max flow.
  - Fraction ticks: 6 px vertical marks under the plot, one per fraction volume.
  - **Level lines**: isocratic phases have an invisible 12 px hit line along their %B line (cursor ns-resize, faint highlight on hover). Dragging it changes Start and End %B together; length stays.
  - **Context menu**: right-click (or menu key / Shift+F10) on a phase band, level line or phase list row selects the phase and opens a menu at the pointer: "Add phase after", "Delete phase" (red, disabled with one phase). Popover style, 180 px min width; closes on Escape, outside click, scroll.
  - **Handles**: one at the end of each phase (v1, %B end). Visible circle r=5, white (selected: phase color), 1.5 px ink stroke. Invisible hit area r=12, cursor move.
- Below the chart: a 2-column grid `340px 1fr`, gap 16.
  - **Phases list**: header "Phases" with "n · total ml". Each row is a grid `22px 10px 1fr auto`: number, color square, name, meta ("5 CV · 5→100 %B"). The selected row has background `#f3f3f1` and an inset 3 px left ink bar. Footer button "+ Add phase after selected".
  - **Phase form**: header with color square, name 16 px / 600, "Phase i of n", and right "X ml · Y CV · Z min". Then a 4-column grid of fields (label 11 px uppercase muted, input 32 px high, border `#d0d0cc`, radius 4):
    - Name (span 2)
    - Phase type (span 2): Equilibration, Sample application, Wash, Elution, Strip / CIP
    - Length, with a CV | ml segmented toggle. Switching the unit converts the value.
    - Start %B
    - End %B (disabled when isocratic)
    - Gradient toggle: "Linear gradient" / "Isocratic"
    - Flow (ml/min). The border turns red when above the column max, and the warning "Above the column maximum of X ml/min." appears. No check when the column has no max flow.
    - Warnings (export allowed): flow above column max; values the export rounds (%B to whole numbers, flow and fraction size to 0.1); a gradient over less than 10 ml ("Steep gradient … the 4 ml mixer smooths gradients shorter than 10 ml"). Errors (export blocked): length ≤ 0, %B outside 0–100, flow ≤ 0, negative fraction size, inlet outside A1–A8, phase shorter than 0.1 ml (0.2 ml when it starts with a %B step).
    - Fraction size (ml), where 0 means no fractions
    - Inlet A (A1–A8, A8 labelled "(sample)")
    - Autozero at start (On/Off toggle)
  - Footer: "Delete phase" (muted outline), spacer, "← Previous phase", "Next phase →" (primary).
- Toggle buttons: active = ink fill with white text, inactive = white with ink text.

### Step 4 — Export for PrimeView
- Description: "ÄKTA prime method dump with the breakpoint table, ready to load with PrimeView.". Button: "Download {name}.txt". The preview shows the exact file.
- Grid `1.3fr 1fr`: the breakpoint table (sticky header; columns BP, Volume ml, %B, Flow, Fraction, Inlet A, Autozero, with a 6 px phase-color dot per row) and a raw text preview (`#1f1f1e` background, `#e8e8e5` text, monospace 12 px / 1.6).

### Methods popover (from the top bar)
- Anchored right under the button, 440 px wide, `#fff`, border `#cfcfcb`, radius 6, shadow `0 10px 28px rgba(0,0,0,.14)`.
- Header: "Saved methods", right "Stored in this browser".
- List (max-height 320, scroll). Each row shows the name (13/600), meta "IMAC · HisTrap HP 5 ml · 6 phases · date", an **Open** button (outline) and × to delete. Empty state: "No saved methods yet. Use Save, or import a file."
- Footer (`#fafaf9`): "Import .json / .txt" (file picker) on the left, "Export .json" on the right.

---

## Interactions & Behavior
- **Drag a handle**: x changes the phase length (stored in the phase's unit, rounded to 0.1). y changes %B (0–100, integer). For a gradient phase, y changes End %B; for an isocratic phase, it changes both Start and End. While dragging, the x domain is frozen to the total at drag start so the axis doesn't rescale under the cursor. Drag starts on mousedown, then window mousemove/mouseup listeners take over. Add pointer/touch support in production.
- **Phase selection** is shared between the chart band, the list row and Previous/Next.
- **Add phase**: inserts "New phase" (wash, 5 CV, %B = end %B of the selected phase, same flow and inlet) after the selected phase and selects it.
- **Delete**: only allowed when more than one phase exists.
- **Save**: upserts by method name into the library.
- **Open / Import**: replaces the current program and jumps to step 3.
- **Autosave**: the current working method is written to storage on every change (not while dragging) and restored on load.
- No animations. Hover states are not designed. Add a subtle background darken (about 4 %) on buttons and rows.

## Calculations
- Phase ml = length × column CV (unit CV) or length (unit ml).
- Phase start volume = sum of previous phase volumes. Phase time = ml / flow. Total time = Σ.
- Breakpoints follow ÄKTA prime semantics: a breakpoint sets flow, fraction size and inlet from its volume on; %B is interpolated linearly to the next breakpoint; the method ends at the last breakpoint. So: **one breakpoint per phase start** (Autozero = phase setting) and a **final end breakpoint**. Where %B steps between phases, the phase gets an **end breakpoint** at its end volume (its end %B, Autozero = No) and the next phase's start breakpoint follows at **+0.1 ml** (two breakpoints at the same volume don't work on the instrument). Breakpoint values are the file values: volume, flow and fraction size rounded to 0.1, %B to whole numbers.

## Data model
```ts
type PhaseType = 'equil'|'sample'|'wash'|'elution'|'strip';
interface Phase { name:string; type:PhaseType; len:number; unit:'CV'|'ml';
  b0:number; b1:number; grad:boolean; flow:number; frac:number; inlet:1..8; az:boolean }
type ApplicationId = 'imac'|'affinity'|'iex'|'hic'|'sec'|'equil';
interface Column { id:string; name:string; manufacturer:string; cv:number;
  flow:number|null /*max ml/min; null = vendor gives no value*/; rec:number /*default flow*/;
  p:number /*MPa, lower of packed bed and hardware limit*/; apps:ApplicationId[]; note?:string; custom?:boolean }
```
**Method JSON** (export/import, version 1):
```json
{ "format":"gradientdesk", "version":1, "name":"IMAC_HisTrap5_gradient",
  "application":"imac", "system":"AKTAprime",
  "column":{"id":"histrap-hp-5-ml","name":"HisTrap HP 5 ml","manufacturer":"Cytiva","cv":5,"flow":20,"rec":5,"p":0.5,"apps":["imac"]},
  "phases":[{"name":"Equilibration","type":"equil","length":5,"unit":"CV","startB":0,"endB":0,
    "gradient":false,"flow":5,"fraction":0,"inletA":1,"autozero":true}],
  "modified":"2026-10-15T10:00:00.000Z" }
```
On import, the column is matched by id, then by name. If neither matches and CV is given, the column is created as a custom column.

**TXT export**: ÄKTA prime "Method Dump" (AKTAprime V2.02, dump format V1.00). Full format spec: `docs/primeview-format.md`. Byte-exact reference: `tests/golden/sample-imac-gradient.txt`. Code: `src/domain/primeview.ts`.
- Header credit: `** Created with , GradientDesk v{version} (gradientdesk.xcience.net, github.com/gebauer/GradientDesk)` and `** Created by , {name}` (see `docs/primeview-format.md` §10). Step 4 has a row under the header: "Method no." (64 px number input), "Created by" (240 px text input, placeholder "Your name (optional)"), and the muted note "Written into the file header, saved in this browser."
- File name `PrimeMeth_NNN.txt` with the method number 1–99 (step 4 field "Method no.", default 1, stored with the current method). PrimeView reads them from `C:\UNICORN\Bin\Prime\`.
- ASCII, CRLF on every line, starts with an empty line, spaces only. Rows are 62 characters.
- `Max pressure (kPa)` = column pressure limit in kPa, capped at 1000. `Inj` always `Load`, `Peak` 0, `Eventmark` N.
- Export (top bar and step 4) is disabled while the program has errors; the reason is shown. Warnings never block.

**TXT import** (Methods popover accepts `.json` and `.txt`):
- Only `Method base ml`. Find the header row starting with `Brkp`, map columns by name, read rows that start with a comma. The first volume must be 0.0 and volumes must strictly increase.
- Each consecutive pair of breakpoints becomes one phase (length in ml, %B from the pair, settings from the first). A 0.1 ml segment that only changes %B (same settings as the phase before, no autozero) is a %B step and is folded into the following phase.
- A `PrimeMeth_NNN.txt` file name sets the method number.
- Phase type is guessed: inlet 8 or Inj = Inject → sample; %B changes → elution; %B ≥ 99 → strip; first phase → equil; otherwise wash. Phase names are not in the file, so the type name is used.
- The program replaces the current one; application and column stay, the method name becomes the file name. Inject positions, peak settings and event marks are dropped with a visible message.

## Application templates
Lengths depend on the column (`rec` = recommended flow). Code: `src/domain/templates.ts`. Every phase uses `rec` unless stated; elution fractions are 2 ml (1 ml for columns below 5 ml); `grad` is true when start %B ≠ end %B. After loading, the first elution phase is selected (otherwise the first phase). Default method name: `{short}_{column name without non-alphanumerics}`, e.g. `IMAC_HisTrapHP5ml`.

Application cards (name · short · description):
- General · General · Any column. Equilibration, sample load, wash, linear gradient elution and re-equilibration as a starting point.
- Affinity · IMAC · IMAC · His-tagged proteins on Ni columns. Imidazole step wash and linear gradient elution.
- Affinity · tags and ligands · Affinity · GST, Strep, MBP, Protein A/G and heparin. Step elution with the elution buffer.
- Ion exchange · IEX · Anion or cation exchange. Salt gradient elution, high-salt strip, re-equilibration.
- Hydrophobic interaction · HIC · Bind in high salt, elute with a decreasing salt gradient, strip without salt.
- Size exclusion · SEC · Isocratic run on a gel filtration or desalting column with fraction collection over 1.2 CV.
- Column equilibration · Equilibrate · Water rinse followed by buffer equilibration. No sample, no fractions.

- **General** (all columns): Equilibration 5 CV 0 %B (AZ) → Sample load 10 ml, A8, flow max(0.5, rec/5) → Wash 5 CV 0 %B → Elution 20 CV 0→100 %B, fractions, AZ → Re-equilibration 5 CV 0 %B.
- **IMAC**: Equilibration 5 CV 0 %B (AZ on) → Sample load 25 ml, A8, flow 1 (5 ml column) or 0.5 → Wash 10 CV 5 %B → Elution 20 CV 5→100 %B, fractions 2 ml (1 ml for small columns), AZ on → Strip 5 CV 100 % → Re-equilibration 5 CV 0 %.
- **IEX**: Equilibration 5 CV (AZ) → Sample load 20 ml, A8, flow max(0.5, rec/5) → Wash 5 CV → Elution 20 CV 0→50 %B, fractions → High-salt strip 5 CV 100 % → Re-equilibration 5 CV.
- **Affinity** (proposal, step elution; B = elution buffer with glutathione / biotin / maltose / low pH): Equilibration 5 CV 0 %B (AZ) → Sample load 20 ml, A8, flow max(0.5, rec/5) → Wash 10 CV 0 %B → Elution 10 CV 100 %B isocratic, fractions 2 ml (1 ml for columns below 5 ml), AZ → Re-equilibration 5 CV 0 %B.
- **HIC** (proposal; A = high-salt binding buffer, B = no salt): Equilibration 5 CV 0 %B (AZ) → Sample load 20 ml, A8, flow max(0.5, rec/5) → Wash 5 CV 0 %B → Elution 20 CV 0→100 %B, fractions → Strip 5 CV 100 %B → Re-equilibration 5 CV 0 %B.
- **SEC** (includes desalting columns): Equilibration 1 CV (AZ) → Sample injection 2 ml, inlet A1, flow rec → Isocratic elution 1.2 CV, fractions 2 ml, AZ.
- **Column equilibration**: Water rinse 3 CV, inlet A2 (AZ) → Equilibration 5 CV (AZ).

## Column library (seed)
Source: `docs/data/columns-source.de.csv` (German, as provided). Code: `src/domain/columns.ts`, 101 columns.
- Each product and each size is its own column ("HiTrap Q FF / SP FF" × "1 / 5 ml" → four columns). The size is part of the name for cartridges sold in several sizes ("HisTrap HP 5 ml"). IDs are the slugged name (`histrap-hp-5-ml`).
- `p` is the lower of packed-bed and hardware limit. The system limit (ÄKTA prime: 1 MPa) is the constant `SYSTEM_MAX_PRESSURE`.
- `flow` is `null` where the vendor gives no value ("k. A." in the source).
- `rec` is a heuristic: 1 CV/min for cartridges ≤ 5 ml (capped at max flow), otherwise 50 % of max flow; without a max flow 1 CV/min capped at 5 ml/min. Explicit override: Superdex 200 Increase 10/300 GL → 0.3 ml/min (1 MPa system limit).
- Applications: IMAC → `imac`; GST/Strep/MBP/Protein A/G/SUPrA/eXact → `affinity`; Q/S/DEAE/CM, Mono Q/S, UNOsphere, Macro-Prep, CHT → `iex`; Heparin → `affinity` and `iex`; Phenyl/Butyl/Octyl → `hic`; Superdex, ENrich, desalting → `sec`.
- Vendor notes are kept in `note` (English).

Values are unverified; check them against the vendor datasheets later. A custom column gets rec flow = 50 % of its max flow.

## State Management
- `app`, `colId`, `phases[]`, `sel` (selected phase index), `step` (1–4), `methodName`
- `customColumns[]`, `library[]` (saved methods), `showMethods`, `statusMsg`, `importError`
- `dragDomain` (frozen x max during a drag)
- Persistence in `localStorage`: `gd.customColumns`, `gd.methods`, `gd.current`, `gd.author`, `gd.recentColumns`. There is no backend.

## Design Tokens
- **Ink** `#1d1d1c` · **Secondary text** `#55554f` · **Muted** `#6b6b68` · **Chart flow line** `#8a8a86`
- **Canvas** `#f5f5f4` · **Surface** `#ffffff` · **Footer surface** `#fafaf9` · **Selected row** `#f3f3f1` · **Active step** `#f0f0ee`
- **Borders**: frame `#dcdcd8`, input `#d0d0cc`, button `#cfcfcb`, inner divider `#e4e4e1`, row `#eeeeeb` / `#f0f0ed`
- **Code block**: background `#1f1f1e`, text `#e8e8e5`
- **Warning**: line/border `oklch(0.6 0.15 25)`, text `oklch(0.48 0.15 25)`
- **Phase colors**: `oklch(0.72 0.12 H)` with H = equil 240, sample 300, wash 190, elution 40, strip 95. Band tint uses alpha .12 (selected .30). List tint uses alpha .14 / .32.
- **Type**: "Helvetica Neue", Helvetica, "Segoe UI", sans-serif. Sizes 11 (labels, uppercase, +.05em), 12, 13 (inputs/buttons), 14 (body), 16 (card titles), 20 (step titles), all 400/500/600. Numbers use `font-variant-numeric: tabular-nums`. Monospace: ui-monospace, Menlo, Consolas.
- **Radius**: 2 (swatches), 4 (inputs/buttons), 5 (step items), 6 (cards/popovers)
- **Heights**: inputs 32, buttons 32–34, top bar 52
- **Spacing**: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 28
- **Shadow**: only the popover, `0 10px 28px rgba(0,0,0,.14)`

## Assets
- `public/favicon.svg`: app icon (64 × 64, rounded ink square with a white %B gradient line over an orange elution peak). Used as the browser favicon and in the top bar (22 px).
- No other images or icon fonts; glyphs (× ‹ › ▾ ← →) are plain text characters.

## Files
- `docs/prototype/GradientDesk.dc.html` – the prototype (layout 1a is the reference; logic at the bottom of the file)
- `docs/prototype/support.js` – runtime needed to open the prototype in a browser
- `CLAUDE.md` (repo root) – project instructions for Claude Code
- `docs/BUILD.md` – stack, structure, build and test plan
