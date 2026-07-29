// BookController - handles the four HTTP verbs for the Book resource.
// GET (read), POST (create), PUT (update), DELETE (delete).
// It returns HTML views for the browser and JSON for API clients (e.g. Postman).
const Book = require('../Models/Book');

// GET /books  -> READ (list all)
exports.index = (req, res) => {
  const books = Book.all();
  if (req.accepts('html')) return res.render('books/index', { title: 'Catalogue', books });
  res.json(books);
};

// GET /books/new  -> form to create
exports.newForm = (req, res) => {
  res.render('books/new', { title: 'Add book' });
};

// POST /books  -> CREATE
exports.create = (req, res) => {
  const book = Book.create(req.body);
  if (req.accepts('html')) return res.redirect(`/books/${book.id}`);
  res.status(201).json(book);
};

// GET /books/:id  -> READ (one)
exports.show = (req, res) => {
  const book = Book.find(req.params.id);
  if (!book) return res.status(404).render('error', { title: 'Not found', message: 'Book not found.' });
  if (req.accepts('html')) return res.render('books/show', { title: book.title, book });
  res.json(book);
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
  if (!book) return res.status(404).render('error', { title: 'Not found', message: 'Book not found.' });
  if (req.accepts('html')) return res.redirect(`/books/${book.id}`);
  res.json(book);
};

// DELETE /books/:id  -> DELETE
exports.destroy = (req, res) => {
  const ok = Book.remove(req.params.id);
  if (!ok) return res.status(404).render('error', { title: 'Not found', message: 'Book not found.' });
  if (req.accepts('html')) return res.redirect('/books');
  res.status(204).end();
};
