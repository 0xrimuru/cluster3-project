# Phase 8 — ICTPRG554 Manage data persistence using NoSQL data stores (MongoDB)

| File | What it is |
|---|---|
| `nosql-tests.js` | 17 tests: login + least privilege, TLS, field encryption, data types (validators), indexes + query plans, insertMany throughput, insert / find / text search / update / delete through the pages, unique index, change-stream trigger, TTL expiry, sessions across restarts, permissions, MongoDB down |
| `nosql-test-results.json` | Last run: 17 / 17 PASS (MongoDB 8.0 replica set with TLS + authorization) |
| `test-results-block8.json` | Full regression (51 use cases) with sessions in MongoDB: 50 PASS, 0 FAIL, 1 pending (mobile) |

Code: `config/nosql.js`, `app/Models/NoSql/` (SessionStore, ActivityLog, Review, RatingTrigger), `app/Security/crypto.js`,
`app/Controllers/ReviewController.js`, `ActivityController.js`, views `shop/product.ejs`, `reviews/index.ejs`, `activity/index.ejs`.
Data model: `db/nosql/collections.js`. Setup / export: `npm run nosql:setup`, `npm run nosql:export`.

## Run
```bash
npm run db:setup && npm run nosql:setup && npm start
BASE=http://localhost:3000 node docs/phase8/nosql-tests.js
```
