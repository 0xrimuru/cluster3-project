// ProductController - the Product (stock item) resource: CRUD + stock adjustment.
// Reads and writes the lpa_stock table through the Product model. Returns HTML views to the
// browser and JSON to API clients (Postman). Input is validated here before any SQL runs.
const Product = require('../Models/Product');
const StockLedger = require('../Models/StockLedger');
const { transaction } = require('../../config/database');

const { wantsJson, notFound } = require('../Middleware/respond');
const base = { pageName: 'Stock', nav: 'stock' };
const LIMITS = { sku: 20, title: 250, brand: 100, category: 50, image: 250 }; // column sizes in lpa_stock
const MAX_PRICE = 99999.99;   // DECIMAL(7,2)
const MAX_QTY = 1000000;

// Server-side checks (the form also checks in the browser, but the server must not trust it).
async function checkItem(body, selfSku) {
  if (['title', 'brand'].some(f => (!selfSku || body[f] !== undefined) && !String(body[f] || '').trim())) return 'A stock item needs at least a product name and a brand.';
  for (const [field, max] of Object.entries(LIMITS)) {
    if (body[field] !== undefined && String(body[field]).trim().length > max) return `${field === 'title' ? 'Product name' : field[0].toUpperCase() + field.slice(1)} must be ${max} characters or fewer.`;
  }
  if (body.sku !== undefined && String(body.sku).trim()) {
    const sku = String(body.sku).trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,20}$/.test(sku)) return 'Stock ID may only use letters, numbers and dashes (3-20 characters).';
    const clash = await Product.findBySku(sku);
    if (clash && clash.sku !== String(selfSku || '').toUpperCase()) return `Stock ID ${sku} already exists.`;
  }
  if (body.price !== undefined) {
    const price = parseFloat(body.price);
    if (isNaN(price) || price < 0 || price > MAX_PRICE) return `Price must be a number from 0 to ${MAX_PRICE}.`;
  }
  if (body.quantity !== undefined && String(body.quantity) !== '') {
    const q = Number(body.quantity);
    if (!Number.isInteger(q) || q < 0 || q > MAX_QTY) return 'On-hand quantity must be a whole number of 0 or more.';
  }
  return null;
}

// Database refusals we can explain (anything else is a real error -> 500 handler).
function dbProblem(err) {
  // The foreign keys stop a Stock ID change while invoices / the audit history refer to it.
  if (/^ER_ROW_IS_REFERENCED/.test(err.code)) return 'This Stock ID is used on invoices or in the audit history, so it cannot be changed.';
  if (err.code === 'ER_DUP_ENTRY') return 'That Stock ID already exists (deleted items keep their Stock ID).';
  throw err;
}

function fail(req, res, status, message) {
  if (wantsJson(req)) return res.status(status).json({ error: message });
  const title = status === 404 ? 'Not found' : 'Invalid item';
  return res.status(status).render('error', { title, message, nav: 'stock' });
}

// GET /products -> stock list (search done in SQL)
exports.index = async (req, res) => {
  const q = String(req.query.q || '').trim();
  const products = await Product.all({ q });
  if (wantsJson(req)) return res.json(products);
  res.render('products/index', Object.assign({ title: 'Stock', products, q: q.toLowerCase(), level: Product.level }, base));
};

// GET /products/new
exports.newForm = (req, res) =>
  res.render('products/new', Object.assign({ title: 'Add stock item' }, base));

// POST /products -> INSERT
exports.create = async (req, res) => {
  const problem = await checkItem(req.body);
  if (problem) return fail(req, res, 400, problem);
  let product;
  try { product = await Product.create(req.body); } catch (err) { return fail(req, res, 409, dbProblem(err)); }
  if (wantsJson(req)) return res.status(201).json(product);
  res.redirect(`/products/${encodeURIComponent(product.sku)}`);
};

// GET /products/:id -> stock item detail + its audit history
exports.show = async (req, res) => {
  const product = await Product.findBySku(req.params.id);
  if (!product) return fail(req, res, 404, 'Stock item not found.');
  if (wantsJson(req)) return res.json(product);
  res.render('products/show', Object.assign({
    title: product.title, product, level: Product.level(product),
    ledger: await StockLedger.forSku(product.sku),
    reasons: REASONS, adjusted: req.query.adjusted === '1',
  }, base));
};

// GET /products/:id/edit
exports.editForm = async (req, res) => {
  const product = await Product.findBySku(req.params.id);
  if (!product) return fail(req, res, 404, 'Stock item not found.');
  res.render('products/edit', Object.assign({ title: `Edit ${product.title}`, product }, base));
};

// PUT /products/:id -> UPDATE
exports.update = async (req, res) => {
  const problem = await checkItem(req.body, req.params.id);
  if (problem) return fail(req, res, 400, problem);
  let product;
  try { product = await Product.update(req.params.id, req.body); } catch (err) { return fail(req, res, 409, dbProblem(err)); }
  if (!product) return fail(req, res, 404, 'Stock item not found.');
  if (wantsJson(req)) return res.json(product);
  res.redirect(`/products/${encodeURIComponent(product.sku)}`);
};

// DELETE /products/:id -> soft delete (status x)
exports.destroy = async (req, res) => {
  const ok = await Product.remove(req.params.id);
  if (!ok) return fail(req, res, 404, 'Stock item not found.');
  if (wantsJson(req)) return res.status(204).end();
  res.redirect('/products');
};

// POST /products/:id/adjust -> stock adjustment (add / remove / reconcile).
// The new quantity and the audit entry are saved in ONE transaction.
const REASONS = ['Physical inventory count', 'Restocked from primary shipment', 'Damaged / write-off', 'Correction', 'Customer return'];
const OPERATIONS = ['add', 'remove', 'reconcile'];
exports.adjust = async (req, res) => {
  const { operation, reason } = req.body;
  const qty = Number(req.body.quantity);
  if (!OPERATIONS.includes(operation)) return fail(req, res, 400, 'Choose add, remove or reconcile.');
  if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) return fail(req, res, 400, 'Quantity must be a whole number of 0 or more.');
  const result = await transaction(async conn => {
    const r = await Product.adjust(req.params.id, { operation, quantity: qty }, conn);
    if (r && (r.delta !== 0 || operation === 'reconcile')) {
      await StockLedger.record({ sku: r.product.sku, userId: req.user.id, operation, reason: REASONS.includes(reason) ? reason : 'Correction', before: r.before, after: r.after }, conn);
    }
    return r;
  });
  if (!result) return fail(req, res, 404, 'Stock item not found.');
  res.redirect(`/products/${encodeURIComponent(result.product.sku)}?adjusted=1`);
};

// GET /stock/ledger -> full audit history
exports.ledger = async (req, res) =>
  res.render('stock/ledger', Object.assign({ title: 'Stock audit history', entries: await StockLedger.all() }, base));
