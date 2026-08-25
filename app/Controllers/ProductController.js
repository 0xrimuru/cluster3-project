// ProductController - the Product (stock item) resource: CRUD + stock adjustment.
// Returns HTML views to the browser and JSON to API clients (Postman).
const Product = require('../Models/Product');
const StockLedger = require('../Models/StockLedger');

function wantsJson(req) {
  return req.is('application/json') || (req.get('accept') || '').includes('application/json');
}
const base = { pageName: 'Stock', nav: 'stock' };

// GET /products -> stock list
exports.index = (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  let products = Product.all();
  if (q) products = products.filter(p => (p.title + ' ' + p.brand + ' ' + p.sku + ' ' + p.category).toLowerCase().includes(q));
  if (wantsJson(req)) return res.json(products);
  res.render('products/index', Object.assign({ title: 'Stock', products, q, level: Product.level }, base));
};

// GET /products/new
exports.newForm = (req, res) =>
  res.render('products/new', Object.assign({ title: 'Add stock item' }, base));

// POST /products
exports.create = (req, res) => {
  if (!req.body.title || !req.body.brand) {
    if (wantsJson(req)) return res.status(400).json({ error: 'title and brand are required' });
    return res.status(400).render('error', { title: 'Invalid item', message: 'A stock item needs at least a product name and a brand.', nav: 'stock' });
  }
  const product = Product.create(req.body);
  if (wantsJson(req)) return res.status(201).json(product);
  res.redirect(`/products/${product.id}`);
};

// GET /products/:id -> stock item detail
exports.show = (req, res) => {
  const product = Product.find(req.params.id);
  if (!product) {
    if (wantsJson(req)) return res.status(404).json({ error: 'Product not found' });
    return res.status(404).render('error', { title: 'Not found', message: 'Stock item not found.', nav: 'stock' });
  }
  if (wantsJson(req)) return res.json(product);
  res.render('products/show', Object.assign({
    title: product.title, product, level: Product.level(product),
    ledger: StockLedger.forSku(product.sku),
    reasons: REASONS, adjusted: req.query.adjusted === '1',
  }, base));
};

// GET /products/:id/edit
exports.editForm = (req, res) => {
  const product = Product.find(req.params.id);
  if (!product) return res.status(404).render('error', { title: 'Not found', message: 'Stock item not found.', nav: 'stock' });
  res.render('products/edit', Object.assign({ title: `Edit ${product.title}`, product }, base));
};

// PUT /products/:id
exports.update = (req, res) => {
  const product = Product.update(req.params.id, req.body);
  if (!product) {
    if (wantsJson(req)) return res.status(404).json({ error: 'Product not found' });
    return res.status(404).render('error', { title: 'Not found', message: 'Stock item not found.', nav: 'stock' });
  }
  if (wantsJson(req)) return res.json(product);
  res.redirect(`/products/${product.id}`);
};

// DELETE /products/:id
exports.destroy = (req, res) => {
  const ok = Product.remove(req.params.id);
  if (!ok) {
    if (wantsJson(req)) return res.status(404).json({ error: 'Product not found' });
    return res.status(404).render('error', { title: 'Not found', message: 'Stock item not found.', nav: 'stock' });
  }
  if (wantsJson(req)) return res.status(204).end();
  res.redirect('/products');
};

// POST /products/:id/adjust -> stock adjustment (add / remove / reconcile)
const REASONS = ['Physical inventory count', 'Restocked from primary shipment', 'Damaged / write-off', 'Correction', 'Customer return'];
exports.adjust = (req, res) => {
  const product = Product.find(req.params.id);
  if (!product) return res.status(404).render('error', { title: 'Not found', message: 'Stock item not found.', nav: 'stock' });
  const result = Product.adjust(req.params.id, { operation: req.body.operation, quantity: req.body.quantity });
  if (result && (result.delta !== 0 || req.body.operation === 'reconcile')) {
    StockLedger.record({ sku: product.sku, title: product.title, user: 'Pedro Alvim', operation: req.body.operation, reason: req.body.reason, before: result.before, after: result.after });
  }
  res.redirect(`/products/${product.id}?adjusted=1`);
};

// GET /stock/ledger -> full audit history
exports.ledger = (req, res) =>
  res.render('stock/ledger', Object.assign({ title: 'Stock audit history', entries: StockLedger.all() }, base));
