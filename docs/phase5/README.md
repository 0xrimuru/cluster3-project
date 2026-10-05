# Phase 5 — ICTPRG546 Validate application design against specifications

Evidence for the design validation of LPA eComms (Pedro Alvim · CTI20260187 · 04–05/10/2026).
The SRS and the Design Validation Report (Word) are in the `CTI Project/Block 5 - ICTPRG546` folder.

| File | What it is |
|---|---|
| `requirements.json` | 35 functional + 9 non-functional requirements and the data mapping (SRS v1.1; single source for the SRS, checklist and tests) |
| `run-tests.js` | 48 use-case tests (HTTP per user group + Playwright browser checks); run 3 version |
| `test-results-before-fixes.json` | First run on commit 9a13794 — 22 PASS, 4 FAIL |
| `test-results-after-fixes.json` | Run 2 on commit 563a560 — 26 PASS, 0 FAIL, 1 pending (mobile, on emulator) |
| `test-results-after-revision.json` | Run 3 on commit b04dcf9 (after the requirements audit) — 47 PASS, 0 FAIL, 1 pending |
| `lpa_ecomms_validated.sql` | Validated MySQL/MariaDB schema (InnoDB, foreign keys, int quantities, hashed-password column, proposed ledger table) |
| `diagrams/` | Architecture, ERD and user-activity diagrams (Graphviz `.dot` source + `.png`), updated 05/10 for the web store and user groups |

## Run the tests

```bash
npm start                      # app on http://localhost:3000
npm install --no-save playwright
BASE=http://localhost:3000 node docs/phase5/run-tests.js
```
(The tests change the in-memory data and register a test customer, so restart the app before running them again. Demo accounts: palvim (administrator), mchang (staff), aturner (customer) — password Lpa#2026.)

## Rebuild the diagrams

```bash
dot -Tpng -Gdpi=170 docs/phase5/diagrams/erd.dot -o docs/phase5/diagrams/erd.png
```
