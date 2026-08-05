# Mashup Interface Requirements — Block 3 (ICTPRG538)

**Project:** OT Tech online bookstore (Cluster 3)
**Prepared by:** Pedro Alvim · **Student ID:** CTI20260187 · **Date:** 30 July 2026
**Submitted to:** Trainer/assessor (client role-play) for feedback and sign-off

## 1. Purpose

The client (LPA, via OT Tech) asked for store features that combine information from
more than one online service. This document sets out what each mashup must do, where
its data comes from, and how it fits into the existing MVC application, so the work
can be checked and signed off before and after the build.

## 2. Organisational requirements the mashups must meet

- Free services only, with no paid API keys, in line with the project budget.
- Must fit the existing Express + EJS MVC structure (route → controller → model → view).
- Each mashup must combine **at least two sources** into one feature.
- Must not break if an external service is down — show a friendly fallback instead.
- Interfaces must match the store's look (shared header/footer and stylesheet).

## 3. Mashup 1 — Store locator (map + live weather)

**What it does:** shows every OT Tech store on an interactive map, and shows the
current weather at each store so customers can plan their visit.

| Aspect | Requirement |
|--------|-------------|
| Sources | OpenStreetMap map tiles (via the Leaflet library) + Open-Meteo weather API + our own store data (`Store` model, served at `/mashups/api/stores`) |
| Interface | `/mashups/store-locator`: an interactive map with a marker per store; clicking a marker shows the store details and current weather; store cards below the map repeat the details for accessibility |
| Where it's combined | In the browser: the page fetches our store JSON, plots the markers, then fetches live weather for each store through our server proxy (`/mashups/api/weather?lat=&lng=`) |
| Failure behaviour | If weather can't be fetched the card says "Weather unavailable right now" and the map still works; Leaflet is bundled with the app so the page never depends on a CDN |

## 4. Mashup 2 — Live international pricing (catalogue + exchange rates)

**What it does:** shows the book catalogue priced in a chosen foreign currency using
live exchange rates, for LPA's overseas customers.

| Aspect | Requirement |
|--------|-------------|
| Sources | Frankfurter API (European Central Bank rates) + open.er-api.com (second provider, used as a cross-check and fallback) + our own catalogue (`Book` model) |
| Interface | `/mashups/pricing`: a currency picker (USD, EUR, GBP, JPY, NZD, BRL) and a table showing each book in AUD and the chosen currency, with the rate, its source, date, and the cross-check rate shown underneath |
| Where it's combined | On the server: the controller fetches both providers, merges them, and renders the priced table; rates are cached for one hour so the free APIs aren't hammered |
| Failure behaviour | If one provider is down the other takes over; if both are down the page still renders with AUD prices and an apology message |

## 5. JSON endpoints (for testing in Postman)

- `GET /mashups/api/stores` — store data used by the map
- `GET /mashups/api/rates` — merged exchange rates (both providers, cache flag)
- `GET /mashups/api/weather?lat=-27.47&lng=153.02` — proxied live weather (400 without lat/lng)

## 6. Acceptance criteria

1. Two distinct mashups exist, each combining two or more sources into one feature.
2. Both run inside the MVC application and match its navigation and styling.
3. External failures degrade gracefully (no crashes, no blank pages).
4. APIs tested in Postman with request/response evidence captured.

## 7. Feedback and sign-off

| | Name | Feedback / comments | Signature | Date |
|-|------|--------------------|-----------|------|
| Trainer/assessor (client) | ____________ | ____________________ | __________ | ______ |
| Student | Pedro Alvim | | __________ | ______ |
