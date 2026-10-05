# Phase 5 — ICTPRG546 Validate application design against specifications

Evidence for the design validation of LPA eComms (Pedro Alvim · CTI20260187 · 04–05/10/2026).
The SRS and the Design Validation Report (Word) are in the `CTI Project/Block 5 - ICTPRG546` folder.

| File | What it is |
|---|---|
| `requirements.json` | 23 functional + 9 non-functional requirements and the data mapping (single source for the SRS, checklist and tests) |
| `run-tests.js` | 27 use-case tests (HTTP + Playwright browser checks) |
| `test-results-before-fixes.json` | First run on commit 9a13794 — 22 PASS, 4 FAIL |
| `test-results-after-fixes.json` | Re-run on commit 563a560 — 26 PASS, 0 FAIL, 1 pending (mobile, on emulator) |
| `lpa_ecomms_validated.sql` | Validated MySQL/MariaDB schema (InnoDB, foreign keys, int quantities, hashed-password column, proposed ledger table) |
| `diagrams/` | Architecture, ERD and user-activity diagrams (Graphviz `.dot` source + `.png`) |

## Run the tests

```bash
npm start                      # app on http://localhost:3000
npm install --no-save playwright
BASE=http://localhost:3000 node docs/phase5/run-tests.js
```
(The tests change the in-memory data, so restart the app before running them again.)

## Rebuild the diagrams

```bash
dot -Tpng -Gdpi=170 docs/phase5/diagrams/erd.dot -o docs/phase5/diagrams/erd.png
```
