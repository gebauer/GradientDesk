# AKTAprime Method Dump Format (PrimeView, Dump Format V1.00)

Specification for generating and parsing AKTAprime method files used by PrimeView.
Derived from a real PrimeView-written file (`PrimeMeth_002.txt`, AKTAprime V2.02).
Provided by the project owner; implemented in `src/domain/primeview.ts`, golden file `tests/golden/sample-imac-gradient.txt`.

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
| Empty | empty or whitespace-only line | ignored (before the breakpoint table) |
| Setting | `KEY` + spaces + `,` + `VALUE` | method setting |
| Column title | the two fixed lines starting with `Brkp` and with spaces + `(mAu/min)` | table header |
| Breakpoint row | starts with `,` | one breakpoint |

---

## 3. Structure (grammar)

```
file      := { comment | empty } settings { comment | empty } table
settings  := exactly 6 setting lines, in this order:
             Method Type, Method, Method base, Frac base,
             Max pressure (kPa), Alarm (min/ml)
setting   := KEY left-justified, space-padded to 19 chars, "," VALUE
table     := title1 CRLF title2 CRLF { empty } row { row }
row       := "," Brkp "," Volume "," Conc "," Flow "," Frac ","
             Buff "," Inj "," Peak "," Autozero "," Eventmark
```

---

## 4. Method settings

| Key (padded to 19 chars) | Type | Default | Meaning |
|---|---|---|---|
| `Method Type` | string | `-` | placeholder |
| `Method` | string | `-` | placeholder |
| `Method base` | unit | `ml` | unit of the breakpoint axis |
| `Frac base` | unit | `ml` | unit of the fraction size |
| `Max pressure (kPa)` | integer | `100` | pressure limit in kPa |
| `Alarm (min/ml)` | decimal (1 place) | `0.0` | alarm setting |

Example line: `Max pressure (kPa) ,100`

---

## 5. Table header (verbatim)

```
Brkp Volume   Conc Flow  Frac   Buff Inj    Peak   Autozero Eventmark
                                          (mAu/min)
```

Line 2 consists of 42 spaces followed by `(mAu/min)`.

---

## 6. Breakpoint rows

Each field is `,` + value, left-justified and space-padded to a fixed total width.
The width **includes** the leading comma. The last field (`Eventmark`) has no padding.
Row length is therefore always 62 characters.

| # | Field | Width | Format | Allowed values | Meaning |
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

The last row marks the end of the method; its `Volume` is the total run volume.

Example row:

```
,2   ,2.0     ,0   ,1.0  ,0.0   ,8   ,Load  ,0     ,Y       ,N
```

---

## 7. Canonical template (complete file)

Generators should emit this comment header verbatim, even though parsers ignore it.
Lines 5 and 7 have 15 trailing spaces (total length 42). The line after the
`** Method Breakpoints` banner consists of 21 spaces.

The byte-exact file is `tests/golden/sample-imac-gradient.txt`. It starts with a truly
empty line and ends with CRLF after the last row.

---

## 8. Validation rules

1. `Brkp` starts at 1 and increases by 1.
2. First `Volume` = `0.0`; `Volume` strictly increasing.
3. `Conc` 0–100, `Buff` 1–8, `Inj` ∈ {`Load`, `Inject`}, flags ∈ {`Y`, `N`}.
4. A value must not exceed its field width minus 1 (e.g. `Volume` ≤ 8 characters).

---

## 9. Open points (not verified from the reference file)

- Whether `Conc` changes linearly (gradient) or stepwise between breakpoints. AKTAprime convention suggests linear.
- Resolved (owner): empty lines are not significant, and the spacing between the commas in breakpoint rows is free. GradientDesk still writes the canonical padded layout and reads any spacing.
- Maximum number of breakpoints per method.

## 10. GradientDesk decisions

- %B steps: two breakpoints at the same volume do not work on the instrument (confirmed by the owner). A step from phase A to phase B is written as an end breakpoint of A at A's end volume (A's end %B, A's settings), followed by B's start breakpoint at **+0.1 ml** (B's %B and settings). Phase volumes don't shift; B just starts 0.1 ml later in the file.
- Volumes are rounded to 0.1 ml at phase boundaries. Each phase must be at least 0.1 ml after rounding, and at least 0.2 ml when it starts with a %B step.
- On import, a 0.1 ml segment that only changes %B (same flow, fraction size and inlet as the phase before, no autozero, no injection) is folded into the following phase, so export → import → export is byte-identical.
