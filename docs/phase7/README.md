# Phase 7 — ICTDBS507 Integrate databases with websites

| File | What it is |
|---|---|
| `db-tests.js` | 15 database tests: limited account, credentials, read / create / update / delete checked in MySQL, validation, SQL injection, transaction rollback, two buyers at once, foreign keys, checkout, restart, database down, export |
| `db-test-results.json` | Last run: 15 / 15 PASS |
| `browser-crud-test.js` | One full CRUD cycle through the Stock pages in Chromium and Firefox, each step checked in MySQL |
| `browser-crud-results.json`, `shots/` | Last run: 8 / 8 PASS, with a screenshot of every step |
| `test-results-block7.json` | Full regression (51 use cases) on MySQL: 50 PASS, 0 FAIL, 1 pending (mobile) |

Database files: `config/database.js` (connection pool), `db/schema.sql`, `db/seed.sql`, `db/setup.js`, `db/export.js`, `db/export.sql`, `.env.example`.

## Run
```bash
npm run db:setup && npm start
BASE=http://localhost:3000 node docs/phase7/db-tests.js
npm install --no-save playwright selenium-webdriver     # browsers for the next two
BASE=http://localhost:3000 node docs/phase7/browser-crud-test.js
npm run db:setup && BASE=http://localhost:3000 node docs/phase5/run-tests.js
```
