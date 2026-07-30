// BookController - handles the four HTTP verbs for the Book resource.
// GET (read), POST (create), PUT (update), DELETE (delete).
// It returns HTML views for the browser and JSON for API clients (e.g. Postman).
const Book = require('../Models/Book');

// A request "wants JSON" when it sends a JSON body (Postman/API clients) or
// explicitly asks for JSON in its Accept header. Browsers do neither, so they
// keep getting the normal HTML pages and redirects.
function wantsJson(req) {
  return req.is('application/json') || (req.get('accept') || '').includes('application/json');
}

// GET /books  -> READ (list all)
exports.index = (req, res) => {
  const books = Book.all();
  if (wantsJson(req)) return res.json(books);
  res.render('books/index', { title: 'Catalogue', books });
};

// GET /books/new  -> form to create
exports.newForm = (req, res) => {
  res.render('books/new', { title: 'Add book' });
};

// POST /books  -> CREATE
exports.create = (req, res) => {
  if (!req.body.title || !req.body.author) {
    if (wantsJson(req)) return res.status(400).json({ error: 'title and author are required' });
    return res.status(400).render('error', { title: 'Invalid book', message: 'A book needs at least a title and an author.' });
  }
  const book = Book.create(req.body);
  if (wantsJson(req)) return res.status(201).json(book);
  res.redirect(`/books/${book.id}`);
};

// GET /books/:id  -> READ (one)
exports.show = (req, res) => {
  const book = Book.find(req.params.id);
  if (!book) {
    if (wantsJson(req)) return res.status(404).json({ error: 'Book not found' });
    return res.status(404).render('error', { title: 'Not found', message: 'Book not found.' });
  }
  if (wantsJson(req)) return res.json(book);
  res.render('books/show', { title: book.title, book });
};

// GET /books/:id/edit  -> form to edit
exports.editForm = (req, res) => {
  const book = Book.find(req.params.id);
  if (!book) return res.status(404).render('error', { title: 'Not found', message: 'Book not found.' });
  res.render('books/edit', { title: `Edit ${book.title}`, book });
};

// PUT /books/:id  -> UPDATE
exports.update = (req, res) => {
  const book = Book.update(req.params.id, req.body);
  if (!book) {
    if (wantsJson(req)) return res.status(404).json({ error: 'Book not found' });
    return res.status(404).render('error', { title: 'Not found', message: 'Book not found.' });
  }
  if (wantsJson(req)) return res.json(book);
  res.redirect(`/books/${book.id}`);
};

// DELETE /books/:id  -> DELETE
exports.destroy = (req, res) => {
  const ok = Book.remove(req.params.id);
  if (!ok) {
    if (wantsJson(req)) return res.status(404).json({ error: 'Book not found' });
    return res.status(404).render('error', { title: 'Not found', message: 'Book not found.' });
  }
  if (wantsJson(req)) return res.status(204).end();
  res.redirect('/books');
};
