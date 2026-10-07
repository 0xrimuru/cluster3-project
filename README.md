# LPA eComms — Cluster 3 Project

**Student:** Pedro Alvim (CTI20260187) · **Course:** ICT50220 Diploma of IT — Cluster 3 (Advanced Programming) · **Assessor:** Dijo Sasidharan · **Client:** Logic Peripherals Australia (LPA)

One connected e-commerce application built across the Cluster 3 blocks: stock management, sales and invoicing, clients, users, and a customer web store. It runs in the browser and inside the LPA Android app.

## Tech stack
Node.js · Express · EJS on a Model–View–Controller structure · **MySQL / MariaDB** (via `mysql2`: stock, clients, invoices, users) · **MongoDB** (official driver: sessions + carts, activity log, product reviews, rating trigger).

## Run it
1. Install **Node.js 18+**, **MySQL 8 or MariaDB 10.4+** (XAMPP is fine: start *MySQL* in the XAMPP Control Panel) and **MongoDB Community Server 7/8** (+ Compass to look at the data).
2. In this folder:
   ```
   npm install          # first time only
   npm run db:setup     # MySQL: creates lpa_ecomms, the tables, the starting data and the lpa_app account
   npm run nosql:setup  # MongoDB: creates lpa_nosql, validators, indexes, reviews, the lpa_nosql_app account
   npm start            # then open http://localhost:3000
   ```
   `nosql:setup` prints how to switch on MongoDB logins and the replica set (needed for the change-stream trigger) in `mongod.cfg`; without them the app still works and runs the trigger itself.
   `db:setup` creates `.env` (database settings, a random password for `lpa_app`). If your MySQL `root` has a password, put it in `.env` as `DB_ADMIN_PASSWORD` and run `npm run db:setup` again. **`.env` is never committed.**
3. Demo accounts (password `Lpa#2026`): `palvim` administrator · `mchang` staff · `aturner` customer.

Other commands: `npm run db:export` (MySQL → `db/export.sql`) · `npm run nosql:export` (MongoDB → `db/nosql/export/*.json`) · running a setup again resets its data.
Security: `npm run start:secure` (code-access security: the app may only read its own folder, write `logs/`, and cannot run other programs) · `npm run security:cert` (development certificate → the app serves HTTPS).

## Structure
```
app/
  Models/       data (M) — Product, Client, Invoice, StockLedger, User (SQL), Store (static)
  Controllers/  logic (C) — Home, Auth, Product, Sales, Shop, User, Review, Activity, Mashup
  Views/        EJS templates (V)
  Models/NoSql/ MongoDB models — SessionStore, ActivityLog, Review, RatingTrigger
  Middleware/   auth (sessions, roles), security (CSP, CSRF)
  Security/     policy.js (access policy engine), crypto.js (AES-256-GCM, blind index, hashing),
                loginGuard.js (lockout), sandbox.js (code-access status), common-passwords.js
config/
  database.js   the MySQL connection pool (settings from .env)
  nosql.js      the MongoDB client (settings from .env)
  security-policy.json  permissions -> user groups (deny by default)
db/
  schema.sql    tables, keys, constraints     seed.sql   starting data
  setup.js      npm run db:setup              export.js  npm run db:export -> export.sql
  nosql/        collections.js (data model: validators, indexes, TTL), seed-reviews.js, setup.js, export.js
routes/         URL -> controller mapping (each route asks for a permission)
scripts/        secure-start.js (npm run start:secure), make-cert.js (npm run security:cert)
mobile-app/     Android WebView app (Android Studio project)
oop-app/        Java desktop app - LPA Administration System (Swing, same database) - see oop-app/README.md
public/         css, js, images, media
docs/           plans, minutes, requirements, test scripts and results per phase
server.js       application entry point
```

## Progress by block
- **Block 1 — ICTPRG530:** project plan, Gantt, GitHub repo + board, meeting minutes.
- **Block 2 — ICTPRG556:** MVC framework with GET/POST/PUT/DELETE.
- **Block 3 — ICTPRG538:** mashups — store locator (OpenStreetMap + weather) and international pricing (live exchange rates).
- **Block 4 — ICTPRG535:** advanced UI — themes, live search, validation, multimedia; Android app.
- **Block 5 — ICTPRG546:** SRS v1.1 and design validation (`docs/phase5`).
- **Block 6 — ICTWEB514:** dynamic pages, security headers, CSRF, privacy (`docs/phase6`).
- **Block 7 — ICTDBS507:** MySQL database integration (`config/`, `db/`, `docs/phase7`).
- **Block 8 — ICTPRG554:** MongoDB — sessions, activity log, product reviews, change-stream trigger (`config/nosql.js`, `db/nosql`, `docs/phase8`).
- **Block 9 — ICTPRG537:** application security — access policy, code-access security, lockout, encryption, HTTPS, injection protection; Android app hardened (`app/Security`, `docs/phase9`, `mobile-app`).
- **Block 10 — ICTPRG549:** Java OOP desktop app (Swing GUI + MySQL) (`oop-app`, `docs/phase10`).
- **Block 11 — ICTPRG547:** data structures and algorithms (trie, heap, LRU cache, sorts, binary search, graph + Dijkstra, 2-opt routes) and third-party libraries (JFreeChart, OpenPDF, Commons CSV) in the desktop app's Reports and Planning; 63 desktop tests (`docs/phase11`).
