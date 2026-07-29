# Block 2 — ICTPRG556: MVC framework (Assessment Phase 7)

An **Express + EJS** web application built on the **Model–View–Controller** pattern —
the "pre-alpha" core of the OT Tech bookstore. This same app grows across the later
blocks (database, security, etc.).

**Student:** Pedro Alvim · **ID:** CTI20260187

## Run it

You need [Node.js](https://nodejs.org) (v18 or newer). In this folder:

```bash
npm install      # download dependencies (creates node_modules/)
npm start        # start the server
```

Then open **http://localhost:3000** in your browser.

## MVC structure

```
Block 2/
├── server.js              # entry point — wires Express + EJS + routes
├── routes/
│   └── index.js           # maps URLs to controller actions
└── app/
    ├── Models/
    │   └── Book.js        # M — the book catalogue data + CRUD logic
    ├── Controllers/
    │   ├── HomeController.js   # C — renders the home page
    │   └── BookController.js   # C — handles the four HTTP verbs
    └── Views/
        ├── home.ejs            # V — dynamic pages rendered by EJS
        ├── error.ejs
        ├── partials/           # shared header/footer
        └── books/              # index / show / new / edit / _form
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
directly and receive JSON. Data is in memory for this block and resets on restart; a real
database arrives in the database blocks.
