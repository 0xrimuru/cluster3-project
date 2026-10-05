# LPA eComms — Cluster 3 Project

**Student:** Pedro Alvim (CTI20260187) · **Course:** ICT50220 Diploma of IT — Cluster 3 (Advanced Programming) · **Assessor:** Dijo Sasidharan · **Client:** Logic Peripherals Australia (LPA)

One connected e-commerce application built across the Cluster 3 blocks: stock management, sales and invoicing, clients, users, and a customer web store. It runs in the browser and inside the LPA Android app.

## Tech stack
Node.js · Express · EJS on a Model–View–Controller structure · **MySQL / MariaDB** (via `mysql2`, prepared statements, connection pool, transactions).

## Run it
1. Install **Node.js 18+** and **MySQL 8 or MariaDB 10.4+** (XAMPP is fine: start *MySQL* in the XAMPP Control Panel).
2. In this folder:
   ```
   npm install          # first time only
   npm run db:setup     # creates lpa_ecomms, the tables, the starting data and the lpa_app account
   npm start            # then open http://localhost:3000
   ```
   `db:setup` creates `.env` (database settings, a random password for `lpa_app`). If your MySQL `root` has a password, put it in `.env` as `DB_ADMIN_PASSWORD` and run `npm run db:setup` again. **`.env` is never committed.**
3. Demo accounts (password `Lpa#2026`): `palvim` administrator · `mchang` staff · `aturner` customer.

Other commands: `npm run db:export` (saves the live database to `db/export.sql`) · `npm run db:setup` again resets the data.

## Structure
```
app/
  Models/       data (M) — Product, Client, Invoice, StockLedger, User (SQL), Store, ActivityLog
  Controllers/  logic (C) — Home, Auth, Product, Sales, Shop, User, Mashup
  Views/        EJS templates (V)
  Middleware/   auth (sessions, roles), security (CSP, CSRF)
config/
  database.js   the MySQL connection pool (settings from .env)
db/
  schema.sql    tables, keys, constraints     seed.sql   starting data
  setup.js      npm run db:setup              export.js  npm run db:export -> export.sql
routes/         URL -> controller mapping (with the user groups allowed)
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
- Blocks 8–11 — NoSQL, application security, OOP desktop app, advanced programming — to come.
