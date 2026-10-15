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
| 7 | Inj | 7 | keyword | `Load`, `Inject` | injection valve position |
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
3. `Conc` 0–100, `Buff` 1–8, `Inj` ∈ {`Load`, `Inject`}, flags ∈ {`Y`, `N`}.
4. Canonical layout only: a value must not exceed its field width minus 1 (e.g. `Volume` ≤ 8 characters).

---

## 9. Open points

- Whether `Conc` changes linearly (gradient) or stepwise between breakpoints. AKTAprime convention suggests linear; GradientDesk assumes linear.
- Maximum number of breakpoints per method.

---

## 10. GradientDesk decisions

- %B steps: a step from phase A to phase B is written as an end breakpoint of A at A's end volume (A's end %B, A's settings), followed by B's start breakpoint at **+0.1 ml** (B's %B and settings). Phase volumes don't shift; B just starts 0.1 ml later in the file.
- Volumes are rounded to 0.1 ml at phase boundaries. Each phase must be at least 0.1 ml after rounding, and at least 0.2 ml when it starts with a %B step.
- On import, a 0.1 ml segment that only changes %B (same flow, fraction size and inlet as the phase before, no autozero, no injection) is folded into the following phase, so export → import → export is byte-identical.
- `Max pressure (kPa)` is written as the column's pressure limit in kPa, capped at 1000 (pending owner confirmation; the default in PrimeView files is 100).
- `Inj` is always written as `Load`; `Peak` 0; `Eventmark` N. On import, `Inject`, peak thresholds and event marks are dropped with a message.
