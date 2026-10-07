# Phase 9 — ICTPRG537 Implement security for applications

Two applications are secured: the **LPA web app** and the **LPA Android app** (`mobile-app/`).

| File | What it is |
|---|---|
| `security-tests.js` | 11 tests: policy-based access control, deny by default, ownership, brute-force lockout, timing (no user enumeration), password rules + change password, encrypted phone numbers (MySQL), injection protection, code-access security (Node permission model), HTTPS, Android app hardening |
| `security-test-results.json` | Last run: 11 / 11 PASS |
| `injection-demo.js` | BEFORE (unsafe code, demo only) vs AFTER (the app's fix) for 6 attacks: SQL injection x2, NoSQL operator injection, XSS, log injection, prototype pollution |
| `injection-demo-results.json` | Last run: 6 / 6 fixed |
| `test-results-block9.json` | Full regression (51 use cases): 50 PASS, 0 FAIL, 1 pending (mobile) |

Code: `config/security-policy.json`, `app/Security/` (policy.js, sandbox.js, loginGuard.js, crypto.js, common-passwords.js),
`app/Middleware/sanitize.js`, `app/Controllers/SecurityController.js`, views `security/index.ejs`, `account/password.ejs`,
`scripts/secure-start.js` (`npm run start:secure`), `scripts/make-cert.js` (`npm run security:cert`), `db/schema.sql` change 9.1,
`mobile-app/` (network security config, locked-down WebView, release build).

## Run
```bash
npm run db:setup && npm run nosql:setup && npm start          # or: npm run start:secure
BASE=http://localhost:3000 node docs/phase9/security-tests.js
BASE=http://localhost:3000 node docs/phase9/injection-demo.js
```
