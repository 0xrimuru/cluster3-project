# Phase 6 — ICTWEB514 Create dynamic web pages

| File | What it is |
|---|---|
| `Phase6_Report_Draft.md` | Text for the SUB1 Phase 6 section (standards, client vs server map, security, tests, debugging) |
| `cross-browser-test.js` | 5 dynamic pages × Chromium + Firefox × desktop + phone, checks server and client dynamic content |
| `cross-browser-results.json` | Last run: 20 / 20 PASS |
| `shots/` | Screenshot of every page in every browser/device (`browser-device-page.png`) |
| `test-results-block6.json` | Full regression after Block 6 (51 use cases: 50 PASS, 0 FAIL, 1 pending) |

## Run

```bash
npm start                                   # fresh server on :3000
npm install --no-save playwright selenium-webdriver
# Firefox: needs Firefox + geckodriver (set FIREFOX and GECKODRIVER paths if not in /opt/ff)
BASE=http://localhost:3000 node docs/phase6/cross-browser-test.js
```

Security added in this phase: `app/Middleware/security.js` (CSP with nonce, security headers, CSRF token check), `app/Views/partials/csrf.ejs`, Privacy notice (`/privacy`).
