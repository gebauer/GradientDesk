# GradientDesk

**App:** https://gradientdesk.xcience.net

Plan chromatography runs for the ÄKTA prime / prime plus in the browser and export them as a PrimeView breakpoint table (`.txt`).

Pick an application (IMAC, IEX, SEC, column equilibration) and a column, then edit the program graphically or phase by phase. Methods are stored in your browser; the exported `.txt` keeps names, column and units in a comment block next to the breakpoint table, so it can be imported again. There is no backend; nothing leaves your machine.

> **Status:** early development. The `.txt` export format is preliminary and the column library values are placeholders.

## Quick start

```bash
nvm use        # Node 24
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | dev server |
| `npm test` | unit and golden-file tests |
| `npm run lint` | oxlint + TypeScript check |
| `npm run build` | static build to `dist/` |

Design spec and build plan: [`docs/SPEC.md`](docs/SPEC.md), [`docs/BUILD.md`](docs/BUILD.md).

## License

[MIT](LICENSE)

## Disclaimer

Not affiliated with or endorsed by Cytiva. Product names are trademarks of their respective owners.
