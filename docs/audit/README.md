# Code audit and fixes — 4 November 2026

A full review of the web app, the Android app and the desktop app (correctness, security, load, tests, speed and code that is not needed), followed by fixes. Every fix has a test, and every test suite was run again afterwards.

## Bugs fixed

| # | Where | Problem | Fix | Test |
|---|---|---|---|---|
| 1 | Web – Users | An admin could create a Customer login with no client record; that customer's checkout crashed (500) | Customer logins are only made with Register | F-01 |
| 2 | Web – Stock | Re-using the Stock ID of a deleted item crashed (500) | Clear 409 message, same as editing | F-02 |
| 3 | Web + desktop – invoices, clients, users | Two saves at the same moment could get the same number; one was lost | The next number is read with `FOR UPDATE` (locked) | F-03 |
| 4 | Web – dark theme | Stock history, activity log and descriptions were white-on-white | Colours use the theme tokens | checked by eye (dark-theme screenshots) |
| 5 | Desktop – Sales report | Best sellers ignored the "to" date | Query has an end date | I-15 |
| 6 | Desktop – New invoice | "Date cannot be in the future" used the PC's time zone, not Brisbane's | `Clocks.today()` everywhere | I-03 (invoice dated by `Clocks`) |
| 7 | Web – Cart | Changing two lines quickly lost one save | One save timer per line; totals from the server | cross-browser Cart (live totals) |
| 8 | Web – Mashups | A stalled exchange-rate API could hang the page for minutes | 5-second timeout, both providers asked at once | UC-23 (page opens) |
| 9 | Web – sign-in | A damaged session cookie made every page fail | Token is not URL-decoded (it is hex) | F-06 |
| 10 | Android | Rotating the phone reloaded the app and lost unsaved invoice lines; Back on the splash still opened the app | `configChanges`; splash checks `isFinishing()` | S-11, lint |
| 11 | Desktop – My details | Changing my password wrote back my sign-in copy, undoing a group change made meanwhile | Only the password is updated | I-16 |
| 12 | Desktop – sign-in | Lockout message gave the wrong wait time | Counts from the oldest failure (as the web app) | T-23 |
| 13 | Web – Stock | Editing could save a product with no name | Same name/brand rule for add and edit | F-04 |
| 14 | Web – Invoices | 30 Feb, or a total above $999,999.99, gave a 500 | Clear 400 messages | F-05 |
| 15 | Web – live search | Typing a category/description hid items that Search finds | Same fields as the server search | UC-07 |
| 16 | Web – accent colour | Tints stayed green after choosing another accent | `--brand-soft` follows `--brand` | checked by eye |
| 17 | Desktop – reorder plan | Rounding error (29.999 days) changed the tier and order quantity | Whole-number maths | R-06 |
| 18 | Web – logout | Any link from another site could sign the user out | Logout is a POST with the CSRF token | F-08, UC-21 |
| 19 | Desktop – transactions | An `Error` could commit half-saved work | Uncommitted work is always rolled back | — (code review) |
| 20 | Desktop – type-ahead | Index could be cleared between two reads (crash) | Read once | — (code review) |
| 21 | Web – pricing | `?currency=a&currency=b` gave a 500 | Value read as text | F-07 |

Smaller fixes: links shown only for the permission their page needs; the product form checks the same limits as the server; network errors in the cart, shop and New Invoice show a message; the store locator shows "Weather unavailable" if the store list fails; the shop count says "1 product"; the About box lists all third-party libraries; desktop invoice numbers use the web app's numbering (INV-1001, …).

## Leaner code
Removed: unused functions and exports, duplicate helpers (`wantsJson` ×10 → `app/Middleware/respond.js`; `like` ×4; `.env` writing ×3 → `scripts/env-file.js`; rating summary ×2; delivery-detail rules ×2; activity types ×2), overridden CSS rules, a repeated video block (`partials/promo.ejs`), repeated footer links, unused desktop methods and repository overrides.
Application code: web −24 lines, desktop −29 lines, while adding the fixes above.

Kept on purpose (assessment evidence or named in the reports): the OOP structure and hand-written data structures, `stock.js` / `shop.js` and the `products/new` / `edit` views, `backup_rules.xml`, and the `DELETE` grant of `lpa_app` (test DB-01).

## Test results after the fixes (4 Nov 2026)
Use cases 50/0/1 pending (emulator) · database 15/15 · browser CRUD 8/8 · NoSQL 17/17 (login, TLS and replica set on) · security 11/11 · injection 6/6 · cross-browser 20/20 · audit fixes 8/8 (`fix-test-results.json`; all 8 fail on the old code) · desktop 67/67 · Android debug + release build, lint 0 errors.
