# Cluster 3 Project — OT Tech Bookstore (LPA eComms scenario)

**Student:** Pedro Alvim (CTI20260187) · **Course:** ICT50220 Diploma of IT — Cluster 3 (Advanced Programming) · **Assessor:** Dijo Sasidharan

A single, connected e-commerce web application built across the Cluster 3 blocks. The theme is the **OT Tech Bookstore**, addressing the LPA eComms scenario requirements (stock management now; sales/invoicing, clients, database, security and desktop/mobile interfaces in later blocks).

## Tech stack
Node.js · Express · EJS, built on a Model–View–Controller structure. Data is held in memory for now and moves to a database in the database blocks.

## Run it
```
npm install      # first time only
node server.js   # then open http://localhost:3000
```

## Structure
```
app/
  Models/       data (M)  — Book (stock item)
  Controllers/  logic (C) — Book, Home, Mashup
  Views/        EJS templates (V)
routes/         URL -> controller mapping
public/         css, js, images, vendor (Leaflet)
docs/           project plan, Gantt, meeting minutes, requirements,
                and evidence/ (screenshots per block)
server.js       application entry point
```

## Progress by block (unit — assessment phase)
- **Block 1 — ICTPRG530 (Phase 1): Project management.** Plan, Gantt, GitHub repo + board, meeting minutes. See `docs/`.
- **Block 2 — ICTPRG556 (Phase 2): MVC framework.** Book catalogue with full CRUD and GET/POST/PUT/DELETE.
- **Block 3 — ICTPRG538 (Phase 3): Mashups.** Store Locator (OpenStreetMap + Open-Meteo weather) and International Pricing (live exchange rates). See `docs/mashup-requirements.md`.
- **Block 4 — ICTPRG535 (Phase 4): Advanced UI.** Stock-management view — on-hand quantity + active/disabled status, live search, client-side validation. *(in progress)*
- Blocks 5–11 — dynamic pages, database integration, NoSQL, security, OOP/desktop, advanced programming — to come.

Evidence screenshots are in `docs/evidence/block-N/`; the git commit history documents the work block by block.
