# Block 3 — ICTPRG538: Create Mashups (Assessment Phase 2)

The Block 2 **Express + EJS MVC** bookstore, evolved: this block adds **two mashups**,
features that combine data from more than one online service.

1. **Store locator** — OpenStreetMap tiles (Leaflet) + live Open-Meteo weather + our
   store data, combined in the browser at `/mashups/store-locator`.
2. **International pricing** — the catalogue + live exchange rates from Frankfurter
   (ECB), cross-checked against open.er-api.com, combined on the server at
   `/mashups/pricing` (rates cached for an hour, graceful fallback if a source is down).

Requirements and sign-off: [`docs/mashup-requirements.md`](docs/mashup-requirements.md).
JSON endpoints for Postman evidence: `/mashups/api/stores`, `/mashups/api/rates`,
`/mashups/api/weather?lat=-27.47&lng=153.02`. Leaflet is bundled in `public/vendor/`
so the app doesn't depend on a CDN.

**Student:** Pedro Alvim · **ID:** CTI20260187

## Run it

You need [Node.js](https://nodejs.org) (v18 or newer). In this folder:

```bash
npm install      # download dependencies (creates node_modules/)
npm start        # start the server
```

Then open **http://localhost:3000** in your browser.

## MVC structure (Block 2 base + Block 3 additions)

```
Block 2/
├── server.js              # entry point — wires Express + EJS + routes
├── routes/
│   └── index.js           # maps URLs to controller actions
└── app/
    ├── Models/
    │   ├── Book.js        # M — the book catalogue data + CRUD logic
    │   └── Store.js       # M — store locations for the locator mashup
    ├── Controllers/
    │   ├── HomeController.js   # C — renders the home page
    │   ├── BookController.js   # C — handles the four HTTP verbs
    │   └── MashupController.js # C — the two mashups + JSON endpoints
    └── Views/
        ├── home.ejs            # V — dynamic pages rendered by EJS
        ├── error.ejs
        ├── partials/           # shared header/footer
        ├── books/              # index / show / new / edit / _form
        └── mashups/            # index / store-locator / pricing
```

A request flows **route → controller → model → view**.

## HTTP verbs (GET / POST / PUT / DELETE)

| Verb | Route | Controller action | CRUD |
|------|-------|--------------------|------|
| GET | `/books` | `BookController.index` | Read (list) |
| GET | `/books/:id` | `BookController.show` | Read (one) |
| POST | `/books` | `BookController.create` | Create |
| PUT | `/books/:id` | `BookController.update` | Update |
| DELETE | `/books/:id` | `BookController.destroy` | Delete |

HTML forms only send GET and POST, so **method-override** turns the edit form into a real
`PUT` and the delete button into a real `DELETE`. API clients (Postman) can call the verbs
directly: send a JSON body (`Content-Type: application/json`) and the controller answers
with JSON and proper status codes — `201` on create, `200` on read/update, `204` on delete,
`400` when title/author are missing, `404` when the book doesn't exist. Browsers keep
getting HTML pages and redirects. Data is in memory for this block and resets on restart;
a real database arrives in the database blocks.
