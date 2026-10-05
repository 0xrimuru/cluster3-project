# Phase 6 Report: ICTWEB514 Create dynamic web pages — draft text for SUB1

Pedro Alvim · CTI20260187 · 05/10/2026 · build: see the git log (Block 6 commit)
Paste each block under the matching SUB1 heading. **[Brackets]** = evidence you add yourself.

---

## Prepare to create dynamic web pages

**Obtain and review technical requirements.** The LPA eComms requirements come from SRS v1.1 (Phase 5), the Technical Specification and CTI's LPA reference application. The parts that must be dynamic are:
- pages that change with the signed-in user and their group (administrator, staff, customer);
- pages that change with live data (stock on hand, invoices, the cart);
- pages that react to the user without reloading (search, quantities, totals, lookups).

The pages must work in the web browser and inside the Android app (WebView), on phones and desktops.

**Confirm applicable legislative and organisational standards and procedures.**

| Standard | What it means for these pages | How LPA eComms meets it |
|---|---|---|
| *Privacy Act 1988* (Cth) — Australian Privacy Principles (APP 1, 5, 6, 11) | Tell people what personal information is collected and why; protect it | Privacy notice page (linked from registration, footer and More); registration requires "I have read the privacy notice"; passwords stored only as salted hashes; customers can only see their own orders |
| *Spam Act 2003* | No marketing email without consent | No marketing email is sent; stated in the privacy notice |
| *Australian Consumer Law* (Competition and Consumer Act 2010) | Prices shown clearly, including GST; total shown before the customer commits | Prices include GST; the cart and checkout show the total and the GST amount; "Place order" shows the total and asks for confirmation |
| PCI DSS (card data) | Don't store card numbers unless certified | No card details are collected or stored — the customer only chooses a payment option |
| WCAG 2.1 AA (accessibility) | Labels, keyboard use, contrast, status messages | Every input is labelled; dialogs and buttons work with the keyboard; light and dark themes keep contrast; messages use role="status" / role="alert" |
| *Copyright Act 1968* | Only use content we own or are licensed for | Own product icons and promo video; OpenStreetMap tiles credited (ODbL); fonts under the Open Font Licence |
| OWASP Top 10 (organisational security procedure) | Protect web pages from common attacks | See "Debug code and confirm security" below |
| OT Tech procedures | MVC structure, Git commits with clear messages, test before merge | Code in app/Models, Views, Controllers, Middleware; every change committed and tested (51 use-case tests + 20 cross-browser checks) |

**Identify sections needing client-side and server-side dynamic content.**

| Page | Server-side dynamic content (Node.js / Express / EJS) | Client-side dynamic content (JavaScript in the browser) |
|---|---|---|
| **1 Home** (/) | Different page per user group: the staff/admin dashboard is built from live stock and invoice data (counts, total sales, "needs attention" list); customers get featured products and their recent orders; "Welcome, name" with their group | Greeting by time of day ("Good morning, Pedro"), worked out from the user's own clock |
| **2 Stock** (/products) | Search (?q=) filtered on the server; In / Low / Out badges from on-hand quantity; Add / Edit / Delete shown only to administrators | Live filter while typing, with no page reload (stock.js) |
| **3 New invoice** (/sales/new) | Next invoice number; JSON lookups for a client by ID and stock by ID; on Save the server re-checks the client, the stock on hand and the catalogue prices, then creates the invoice and reduces stock | Lookups fill in the client card and the item details; line items are added and removed and the total updates live; the invoice is sent as JSON (invoice.js) |
| **4 Shop** (/shop) | Active products only; sort by price / name and filter by category on the server; "only N left" and "sold out" from stock; Add to cart allowed only for customers and never beyond stock | Live search; Add to cart shows the price and asks for confirmation, then sends the item with fetch() and updates the cart badge without reloading (shop.js) |
| **5 Cart** (/cart) | Cart kept in the server session; totals and GST from current catalogue prices; quantity checked against stock | Changing a quantity recalculates the line, total and GST instantly and saves in the background; Remove takes the line away without reloading (cart.js) |

(Checkout, My orders, Sales, Users and Help are also server-generated per user; they are not part of the 5 pages tested here.)

**Select applicable languages and technology.**
- Server: JavaScript on Node.js with the Express framework (MVC) and EJS templates.
- Client: HTML5, CSS3 with design tokens for light and dark themes, and vanilla JavaScript (fetch, the dialog element, localStorage).
- Data: JSON between browser and server.

These were chosen because one language runs on both sides, EJS keeps views separate from controllers, and there are no heavy client libraries. That keeps pages fast inside the Android WebView.

---

## Create dynamic content

**Identify and create boilerplate templates.**
- `partials/header.ejs`: the HTML head, the fonts, the theme set before the page paints, the app bar and the Welcome strip.
- `partials/footer.ejs`: the bottom navigation for each user group, the footer and the Privacy link.
- `partials/csrf.ejs`: the hidden security token included in every form that changes data.

Every page is `include(header) + its own content + include(footer)`, so a change to the layout is made once.
**[Screenshot: header.ejs and footer.ejs in VS Code.]**

**Design and create a database and organise data and content according to data storage requirements.** The data is organised in models that match the validated LPA database design from Phase 5:
- Product → lpa_stock
- Client → lpa_clients
- Invoice + line items → lpa_invoices / lpa_invoice_items
- User → lpa_users
- StockLedger → the proposed audit table

The MySQL schema (*lpa_ecomms_validated.sql*: 6 tables, 5 foreign keys) was created and tested on MariaDB in Phase 5. Pages read data only through the models, which is why connecting them to MySQL in the next phase (ICTDBS507) will not change these pages.
**[ERD from Phase 5.]**

**Create pages using the selected languages.** The five pages above were built in EJS with their controllers (HomeController, ProductController, SalesController, ShopController) and client scripts (stock.js, invoice.js, shop.js, cart.js, app.js).
**[Code screenshots: one controller action + its EJS view + its client script for at least 3 pages.]**

---

## Test and finalise dynamic web pages

**Debug code and confirm security of the web pages using cyber security protocols.**

Bugs found and fixed while building and testing:

| # | Found by | Problem | Fix |
|---|---|---|---|
| 1 | Browser test of checkout | Checkout crashed ("include is not a function"): a view variable named `client` is read by EJS as one of its own render options | Renamed to `customer`; noted in the code |
| 2 | Same crash | The crash page showed a stack trace with file paths | Added an error handler: details go to the server log, the user sees a plain message |
| 3 | Browser test of the shop | After adding the security token to forms, the shop's Add-to-cart form broke: the token was inserted inside the `<form>` tag because the tag contained `<% %>` code | Rewrote the insertion to find the real end of each tag; all 12 forms re-checked |
| 4 | Screen review | New-invoice line items were wider than a phone screen | Compact table and a round × remove button |
| 5 | New-invoice test | An out-of-stock item could be selected, and only failed on Add | The lookup now says "out of stock" straight away and disables Add |

**[Screenshot of the VS Code debugger stopped in a controller (e.g. ShopController.add) showing req.body and the cart — and the browser DevTools Network tab showing the fetch() to /cart.]**

Security confirmed against OWASP:

| OWASP risk | Protection in these pages | Test |
|---|---|---|
| A01 Broken access control | Every route checks the user's group; customers only see their own orders | UC-28, UC-38 |
| A02 Cryptographic failures | Passwords stored as salted scrypt hashes; random 256-bit session tokens | UC-43, UC-01 |
| A03 Injection / XSS | EJS escapes all output; typed `<script>` is shown as text; input validated on the server | UC-49, UC-09a |
| A04 Insecure design | Prices and stock decided by the server, never by the browser | UC-33, UC-39 |
| A05 Security misconfiguration | Content-Security-Policy (own scripts + nonce, no framing), nosniff, X-Frame-Options, Referrer-Policy, X-Powered-By hidden, request size limits | UC-48 |
| A07 Identification and authentication failures | Wrong or inactive accounts refused and logged; HttpOnly, SameSite cookies | UC-02b, UC-42 |
| A08 Integrity / CSRF | Secret per-session token required on every POST / PUT / DELETE | UC-47 |
| A09 Logging and monitoring | Sign-ins, failed sign-ins, orders, invoices and user changes logged | UC-46 |
| Error handling | No stack traces sent to the browser | UC-45 |

**Test page functionality and content across a variety of browsers and devices.** I ran `docs/phase6/cross-browser-test.js`, which tests all 5 pages in 2 browsers and on 2 devices, checking both kinds of dynamic content on each page:
- browsers: Chromium 141 (the engine of Chrome and Edge) and Firefox 157;
- devices: a desktop screen (1366 × 768) and a phone (412 × 915, with touch and a mobile user-agent).

**Result: 20 / 20 PASS, no JavaScript errors.** Screenshots: `docs/phase6/shots/` (browser-device-page.png).

| Page | Chromium desktop | Chromium phone | Firefox desktop | Firefox phone |
|---|---|---|---|---|
| 1 Home | PASS | PASS | PASS | PASS |
| 2 Stock | PASS | PASS | PASS | PASS |
| 3 New invoice | PASS | PASS | PASS | PASS |
| 4 Shop | PASS | PASS | PASS | PASS |
| 5 Cart | PASS | PASS | PASS | PASS |

The same pages also run inside the LPA Android app (WebView) on the Pixel 7 emulator.
**[Add: one screenshot of a page in Microsoft Edge on your PC, and the Shop page in the Android emulator.]**

**Evaluate web page functionality results and amend as required.**
- The first cross-browser run had 5 failures, all in the test script, not the pages. I had expected the "keyboard" search to return 1 item, but it correctly returns 2 (the numpad is in the Keyboards category). And Selenium clicked a button hidden under the fixed bottom menu on the Firefox phone; the test now scrolls the button to the middle of the screen first, as a person would.
- After those amendments: 20 / 20.
- The full regression suite still passes after the Block 6 changes: 50 PASS, 0 FAIL, 1 pending (the on-device mobile test).

**Confirm required dynamic content functions according to task requirements.** All 5 pages have both server-side and client-side dynamic content, as shown in the table above and tested in both browsers on both devices.

**Present the dynamic web pages to required personnel and seek feedback.**
**[Demo to Dijo / John at Meeting 02: show the same page in two browsers and on the phone; record the feedback here.]**

**Finalise the web pages and obtain sign-off.**
**[Sign-off email or signature from the supervisor.]**

---

## Summary of Special phase 6 requirements

- **At least three dynamic web pages:** 5 pages (Home, Stock, New invoice, Shop, Cart).
- **Client- and server-side dynamic content in each page:** yes, as shown in the table above.
- **Code created and debugged:** 5 real bugs found and fixed, listed above.
- **Tested on at least two browsers and two devices:** Chromium and Firefox, each on desktop and phone (20 / 20 PASS), plus the Android app.
- **Organisational and legislative standards:** Privacy Act / APPs, Spam Act, Australian Consumer Law, PCI DSS, WCAG 2.1, copyright and OWASP were all checked, as shown in the standards table.
