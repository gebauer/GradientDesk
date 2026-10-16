# AKTAprime Method Dump Format (PrimeView, Dump Format V1.00)

Specification for generating and parsing AKTAprime method files used by PrimeView.
Derived from a real PrimeView-written file (`PrimeMeth_002.txt`, AKTAprime V2.02) and tests on the instrument by the project owner.
Implemented in `src/domain/primeview.ts`; byte-exact reference file `tests/golden/sample-imac-gradient.txt`.

The format has a **canonical layout** (what PrimeView writes, and what GradientDesk writes) and a **tolerant reading**: empty lines and the spacing around the commas in breakpoint rows are not significant.

---

## 1. File conventions

| Property | Value |
|---|---|
| File name | `PrimeMeth_NNN.txt`, `NNN` = `001`–`099` (3 digits, zero-padded) |
| Location | `C:\UNICORN\Bin\Prime\` |
| Max. number of methods | 99 |
| Encoding | ASCII, no BOM |
| Line ending | CRLF (`\r\n`) on every line, including the last line |

---

## 2. Line types and parsing rules

| Type | Recognition | Handling |
|---|---|---|
| Comment | line starts with `*` | ignored |
| Empty | empty or whitespace-only line | ignored anywhere in the file |
| Setting | `KEY` + optional spaces + `,` + `VALUE` | method setting |
| Column title | line starting with `Brkp`, and the following line with `(mAu/min)` | table header; column order taken from the `Brkp` line |
| Breakpoint row | first non-space character is `,` | one breakpoint |

---

## 3. Structure (grammar)

Empty lines may appear anywhere and are ignored.

```
file      := { comment } settings { comment } table
settings  := 6 setting lines, in this order:
             Method Type, Method, Method base, Frac base,
             Max pressure (kPa), Alarm (min/ml)
setting   := KEY { " " } "," VALUE
table     := title1 title2 row { row }
row       := "," field "," field "," field "," field "," field ","
             field "," field "," field "," field "," field
field     := { " " } value { " " }
```

Canonical (written) layout: setting keys left-justified and space-padded to 19 characters; fields padded as in §6.

---

## 4. Method settings

| Key (canonical: padded to 19 chars) | Type | Default | Meaning |
|---|---|---|---|
| `Method Type` | string | `-` | placeholder |
| `Method` | string | `-` | placeholder |
| `Method base` | unit | `ml` | unit of the breakpoint axis |
| `Frac base` | unit | `ml` | unit of the fraction size |
| `Max pressure (kPa)` | integer | `100` | pressure limit in kPa |
| `Alarm (min/ml)` | decimal (1 place) | `0.0` | alarm setting |

Example line: `Max pressure (kPa) ,100`

---

## 5. Table header (canonical)

```
Brkp Volume   Conc Flow  Frac   Buff Inj    Peak   Autozero Eventmark
                                          (mAu/min)
```

Line 2 consists of 42 spaces followed by `(mAu/min)`.

---

## 6. Breakpoint rows

Ten fields, each introduced by a comma, in the order below. Spaces around a value are not significant when reading.

**Canonical layout** (written): each field is `,` + value, left-justified and space-padded to a fixed total width. The width **includes** the leading comma. The last field (`Eventmark`) has no padding, so a canonical row is 62 characters.

| # | Field | Width (canonical) | Format | Allowed values | Meaning |
|---|---|---|---|---|---|
| 1 | Brkp | 5 | integer | 1…n, consecutive | breakpoint index |
| 2 | Volume | 9 | decimal, 1 place | first row `0.0`, strictly increasing | position (ml) where the breakpoint takes effect |
| 3 | Conc | 5 | integer | 0–100 | %B |
| 4 | Flow | 6 | decimal, 1 place | ≥ 0 | flow rate, ml/min |
| 5 | Frac | 7 | decimal, 1 place | ≥ 0; `0.0` = off | fraction size, ml |
| 6 | Buff | 5 | integer | 1–8 | buffer valve position |
| 7 | Inj | 7 | keyword | `Load`, `Inject`, `Waste` | injection valve position |
| 8 | Peak | 7 | integer | ≥ 0; `0` = off | peak fractionation threshold, mAU/min |
| 9 | Autozero | 9 | flag | `Y`, `N` | UV autozero at this breakpoint |
| 10 | Eventmark | – | flag | `Y`, `N` | set event mark |

A breakpoint sets flow, fraction size, buffer valve and injection valve from its volume on. `Conc` is interpolated linearly to the next breakpoint. The last row marks the end of the method; its `Volume` is the total run volume.

Canonical example row:

```
,2   ,2.0     ,0   ,1.0  ,0.0   ,8   ,Load  ,0     ,Y       ,N
```

Equivalent when reading:

```
,2,2.0,0,1.0,0.0,8,Load,0,Y,N
```

---

## 7. Canonical file

Writers emit the canonical file: the comment header verbatim (lines 5 and 7 have 15 trailing spaces, total length 42; the line after the `** Method Breakpoints` banner consists of 21 spaces), an empty first line, padded settings and rows, and CRLF after the last row. The byte-exact example is `tests/golden/sample-imac-gradient.txt`.

Readers don't depend on any of the layout details above, only on the line types in §2.

---

## 8. Validation rules

1. `Brkp` starts at 1 and increases by 1.
2. First `Volume` = `0.0`; `Volume` strictly increasing. Two breakpoints at the same volume do not work on the instrument.
3. `Conc` 0–100, `Buff` 1–8, `Inj` ∈ {`Load`, `Inject`, `Waste`}, flags ∈ {`Y`, `N`}.
4. Canonical layout only: a value must not exceed its field width minus 1 (e.g. `Volume` ≤ 8 characters).

---

## 9. Open points

- Whether `Conc` changes linearly (gradient) or stepwise between breakpoints. AKTAprime convention suggests linear; GradientDesk assumes linear.
- Maximum number of breakpoints per method.

---

## 10. GradientDesk decisions

- %B steps: a step from phase A to phase B is written as an end breakpoint of A at A's end volume (A's end %B, A's settings), followed by B's start breakpoint at **+0.1 ml** (B's %B and settings). Phase volumes don't shift; B just starts 0.1 ml later in the file.
- Volumes are rounded to 0.1 ml at phase boundaries. Each phase must be at least 0.1 ml after rounding, and at least 0.2 ml when it starts with a %B step.
- On import, a 0.1 ml segment that only changes %B (same flow, fraction size, inlet and injection valve as the phase before, no autozero) is folded into the following phase, so export → import → export is byte-identical.
- `Max pressure (kPa)` is written as the column's pressure limit in kPa, capped at 1000 (pending owner confirmation; the default in PrimeView files is 100).
- Credit lines: GradientDesk adds two comment lines inside the header block, before the closing `**` line:
  ```
  ** Created with     , GradientDesk v<version> (gradientdesk.xcience.net, github.com/gebauer/GradientDesk)
  ** Created by       , <name>
  ```
  The name comes from the "Created by" field (per browser, may be empty: the line then ends with the comma, as a spot to fill in by hand). Both are converted to ASCII (ä → ae, ß → ss, accents dropped, anything else → `?`). Comment lines are ignored by readers, so they don't affect import. Reference: `tests/golden/gradientdesk-imac-gradient.txt`; without these lines the output equals the PrimeView sample byte for byte.
- `Inj` is written from the phase's injection valve (`Load`, `Inject`, `Waste`; default by phase type: sample → `Inject`, pump wash → `Waste`, others → `Load`) and read back on import; an unknown value reads as `Load`. `Peak` 0; `Eventmark` N. On import, peak thresholds and event marks are dropped with a message.
- Pump wash: one segment per line in the order B, A8 … A1, each written like a phase on `Waste` (B at 100 %B, An at 0 %B on `Buff` n). The step from B to A8 follows the %B step rule above (end breakpoint, next start at +0.1 ml). On import, a `Waste` segment at constant 100 or 0 %B becomes a single-line pump wash.
- The keyword `Waste` is assumed from the instrument's valve positions; no PrimeView dump with `Waste` has been checked yet.

---

## 11. GradientDesk method block

GradientDesk appends the complete method as comment lines after the last breakpoint row, so a re-import restores everything the breakpoint table can't hold (method name, application, column, phase names, types and units). Code: `src/domain/methodTxt.ts`; byte-exact reference: `tests/golden/gradientdesk-imac-method.txt`.

```
<last breakpoint row>

*****************************************************************
** GradientDesk method
** Everything GradientDesk needs to restore this method on import.
*****************************************************************
** [method]
** format = gradientdesk
** version = 2
** name = IMAC_HisTrapHP5ml
** application = imac
**
** [column]
** id = histrap-hp-5-ml
** name = HisTrap HP 5 ml
** manufacturer = Cytiva
** cv = 5
** flow = 20
** rec = 5
** p = 0.5
** apps = imac
**
** [phase 1]
** name = Equilibration
** type = equil
** length = 5
** unit = CV
** startB = 0
** endB = 0
** gradient = no
** flow = 5
** fraction = 0
** inletA = 1
** injection = Load
** autozero = yes
**
** [phase 2]
...
*****************************************************************
```

- Every line starts with `**`, so it is a comment line (§2). The block starts at the line `** GradientDesk method`; sections are `** [method]`, `** [column]`, `** [phase N]`; entries are `** key = value`, split at the first `=`, spaces around key and value are not significant.
- Keys are the method data field names (docs/SPEC.md "Method data"); pump wash phases add `lines` (comma-separated, wash order, e.g. `** lines = B, A8, A1`); the column's `note` and `custom` are written only when set. Numbers as written by JavaScript (`String(n)`), booleans `yes` / `no`, unknown max flow `none`, `apps` comma-separated.
- Values are ASCII: `\` is written as `\\`, any other character outside 0x20–0x7E as `\uXXXX` (UTF-16 code unit), and leading or trailing spaces as `\u0020`.
- No timestamp: the same method always gives the same file.
- Import: the block is used only when the breakpoints it produces equal the file's rows (compared without spaces). Otherwise, or when the block can't be read, the table is imported (§10) with a message. A file without a block is imported from the table.
- Open point: §3 only shows comments before the table. Whether PrimeView and the instrument accept comment lines after the last breakpoint row still has to be confirmed.
