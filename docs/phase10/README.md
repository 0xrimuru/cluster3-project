# Phase 10 — ICTPRG549 Apply intermediate object-oriented language skills

The Java desktop app is in `oop-app/` (see its README for the class design).

| File | What it is |
|---|---|
| `desktop-test-results.json` | Phase 10 tests T-01..T-22, I-01..I-12, G-01..G-07 (41) - the file now holds the full 63-test run incl. Phase 11: 63 / 63 PASS |
| `shots/` | Screenshots taken by the GUI test (login failure, home, stock, new invoice, invoice saved, invoices, clients phone search, users, my details, staff view) |

Bugs found by the tests and fixed:
1. `AppConfig` crashed at start-up when the `LPA_ENV` variable was not set (`Path.of` with a NUL character) — found by T-19.
2. A screen could change the signed-in user object and so its permissions — `Session.user()` now returns a copy — found by I-10.

Optimisation: connection pool (0 new connections for 200 searches; ~1 ms per query vs ~4-5 ms with a new connection each time, test I-11);
database work runs on SwingWorker threads so the window never freezes; indexes from the web app's schema; BigDecimal money.

## Run the tests
```bash
cd oop-app && mvnw package            # GUI tests need a screen (Linux CI: xvfb-run mvnw package)
```
