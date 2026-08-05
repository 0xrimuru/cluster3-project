// BookController - the Book (stock item) resource: CRUD + stock adjustment.
// Returns HTML views to the browser and JSON to API clients (Postman).
const Book = require('../Models/Book');
const StockLedger = require('../Models/StockLedger');

function wantsJson(req) {
  return req.is('application/json') || (req.get('accept') || '').includes('application/json');
}
const base = { pageName: 'Stock', nav: 'stock' };

// GET /books -> stock list
exports.index = (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  let books = Book.all();
  if (q) books = books.filter(b => (b.title + ' ' + b.author + ' ' + b.sku + ' ' + b.category).toLowerCase().includes(q));
  if (wantsJson(req)) return res.json(books);
  res.render('books/index', Object.assign({ title: 'Stock', books, q, level: Book.level }, base));
};

// GET /books/new
exports.newForm = (req, res) =>
  res.render('books/new', Object.assign({ title: 'Add stock item' }, base));

// POST /books
exports.create = (req, res) => {
  if (!req.body.title || !req.body.author) {
    if (wantsJson(req)) return res.status(400).json({ error: 'title and author are required' });
    return res.status(400).render('error', { title: 'Invalid item', message: 'A stock item needs at least a title and an author.', nav: 'stock' });
  }
  const book = Book.create(req.body);
  if (wantsJson(req)) return res.status(201).json(book);
  res.redirect(`/books/${book.id}`);
};

// GET /books/:id -> stock item detail
exports.show = (req, res) => {
  const book = Book.find(req.params.id);
  if (!book) {
    if (wantsJson(req)) return res.status(404).json({ error: 'Book not found' });
    return res.status(404).render('error', { title: 'Not found', message: 'Stock item not found.', nav: 'stock' });
  }
  if (wantsJson(req)) return res.json(book);
  res.render('books/show', Object.assign({
    title: book.title, book, level: Book.level(book),
    ledger: StockLedger.forSku(book.sku),
    reasons: REASONS, adjusted: req.query.adjusted === '1',
  }, base));
};

// GET /books/:id/edit
exports.editForm = (req, res) => {
  const book = Book.find(req.params.id);
  if (!book) return res.status(404).render('error', { title: 'Not found', message: 'Stock item not found.', nav: 'stock' });
  res.render('books/edit', Object.assign({ title: `Edit ${book.title}`, book }, base));
};

// PUT /books/:id
exports.update = (req, res) => {
  const book = Book.update(req.params.id, req.body);
  if (!book) {
    if (wantsJson(req)) return res.status(404).json({ error: 'Book not found' });
    return res.status(404).render('error', { title: 'Not found', message: 'Stock item not found.', nav: 'stock' });
  }
  if (wantsJson(req)) return res.json(book);
  res.redirect(`/books/${book.id}`);
};

// DELETE /books/:id
exports.destroy = (req, res) => {
  const ok = Book.remove(req.params.id);
  if (!ok) {
    if (wantsJson(req)) return res.status(404).json({ error: 'Book not found' });
    return res.status(404).render('error', { title: 'Not found', message: 'Stock item not found.', nav: 'stock' });
  }
  if (wantsJson(req)) return res.status(204).end();
  res.redirect('/books');
};

// POST /books/:id/adjust -> stock adjustment (add / remove / reconcile)
const REASONS = ['Physical inventory count', 'Restocked from primary shipment', 'Damaged / write-off', 'Correction', 'Customer return'];
exports.adjust = (req, res) => {
  const book = Book.find(req.params.id);
  if (!book) return res.status(404).render('error', { title: 'Not found', message: 'Stock item not found.', nav: 'stock' });
  const result = Book.adjust(req.params.id, { operation: req.body.operation, quantity: req.body.quantity });
  if (result && (result.delta !== 0 || req.body.operation === 'reconcile')) {
    StockLedger.record({ sku: book.sku, title: book.title, user: 'Pedro Alvim', operation: req.body.operation, reason: req.body.reason, before: result.before, after: result.after });
  }
  res.redirect(`/books/${book.id}?adjusted=1`);
};

// GET /stock/ledger -> full audit history
exports.ledger = (req, res) =>
  res.render('stock/ledger', Object.assign({ title: 'Stock audit history', entries: StockLedger.all() }, base));
