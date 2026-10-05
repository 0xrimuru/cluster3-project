// SalesController - Sales & Invoicing (search, new invoice, invoice detail, delete),
// the Clients list, and two small JSON lookups used by the New Invoice page.
const Invoice = require('../Models/Invoice');
const Client = require('../Models/Client');
const Product = require('../Models/Product');
const StockLedger = require('../Models/StockLedger');
const Log = require('../Models/ActivityLog');
const { currentUser } = require('./AuthController');

const wantsJson = req => (req.get('accept') || '').includes('application/json');

// GET /sales -> Sales & Invoicing (search invoices, results, total)
exports.invoices = (req, res) => {
  const q = req.query.q || '';
  const list = Invoice.search(q);
  if (wantsJson(req)) return res.json({ invoices: list, total: Invoice.total(list) });
  res.render('sales/index', {
    title: 'Sales & Invoicing', pageName: 'Sales', nav: 'sales',
    invoices: list, q, total: Invoice.total(list),
    notice: req.query.deleted ? `Invoice ${req.query.deleted} deleted and its stock returned.` : '',
  });
};

// GET /sales/new -> New Invoice form
exports.newForm = (req, res) => {
  res.render('sales/new', { title: 'New invoice', pageName: 'Sales', nav: 'sales', nextNumber: Invoice.nextNumber(),
    today: new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }) });
};

// Check and normalise the invoice the browser sent. Returns { errors, client, items }.
function validateInvoice(body) {
  const errors = [];
  const client = Client.findByCode(body.clientId);
  if (!client) errors.push('Search and select a client first (client ID not found).');
  else if (client.status !== 'active') errors.push(`Client ${client.code} is disabled.`);
  let raw = body.items;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { raw = null; } }
  if (!Array.isArray(raw) || raw.length === 0) errors.push('Add at least one stock item.');
  const merged = {};
  (raw || []).forEach(r => {
    const qty = parseInt(r.qty, 10);
    const sku = String(r.sku || '').toUpperCase();
    if (!Number.isInteger(qty) || qty < 1) { errors.push(`Quantity for ${sku || 'an item'} must be at least 1.`); return; }
    merged[sku] = (merged[sku] || 0) + qty;
  });
  const items = [];
  Object.keys(merged).forEach(sku => {
    const p = Product.findBySku(sku);
    if (!p) return errors.push(`Stock item ${sku} not found.`);
    if (p.status !== 'active') return errors.push(`${p.title} is disabled and cannot be sold.`);
    if (merged[sku] > p.quantity) return errors.push(`Only ${p.quantity} of ${p.title} on hand (asked for ${merged[sku]}).`);
    items.push({ sku: p.sku, name: p.title, qty: merged[sku], price: p.price }); // price always from the catalogue
  });
  const date = String(body.date || '');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Date must be a valid date.');
  return { errors, client, items, date };
}

// POST /sales -> create invoice (JSON from the New Invoice page)
exports.create = (req, res) => {
  const { errors, client, items, date } = validateInvoice(req.body);
  if (errors.length) return wantsJson(req) ? res.status(400).json({ errors }) : res.status(400).render('error', { title: 'Invoice not saved', message: errors.join(' '), nav: 'sales' });
  const inv = Invoice.create({ clientId: client.code, items, date: date || undefined, payment: 'Account' });
  const who = currentUser(req);
  items.forEach(i => {
    const r = Product.changeQty(i.sku, -i.qty);
    StockLedger.record({ sku: i.sku, title: i.name, user: who, operation: 'remove', reason: `Sold - ${inv.number}`, before: r.before, after: r.after });
  });
  Log.write(req, `INVOICE ${inv.number} created by ${req.user.username} for ${client.code}: $${inv.amount.toFixed(2)}`);
  if (wantsJson(req)) return res.status(201).json({ ok: true, number: inv.number, url: `/sales/${inv.number}?created=1` });
  res.redirect(`/sales/${inv.number}?created=1`);
};

// GET /sales/:number -> invoice detail
exports.show = (req, res) => {
  const inv = Invoice.find(req.params.number);
  if (!inv) return res.status(404).render('error', { title: 'Not found', message: 'Invoice not found.', nav: 'sales' });
  if (wantsJson(req)) return res.json(inv);
  res.render('shop/order', { title: `Invoice ${inv.number}`, pageName: 'Sales', nav: 'sales', inv, placed: false,
    created: req.query.created === '1', backHref: '/sales', staffView: true });
};

// DELETE /sales/:number -> delete invoice (administrators) and return its stock
exports.destroy = (req, res) => {
  const inv = Invoice.remove(req.params.number);
  if (!inv) return wantsJson(req) ? res.status(404).json({ error: 'Invoice not found' }) : res.status(404).render('error', { title: 'Not found', message: 'Invoice not found.', nav: 'sales' });
  const who = currentUser(req);
  inv.items.forEach(i => {
    const r = Product.changeQty(i.sku, i.qty);
    if (r) StockLedger.record({ sku: i.sku, title: i.name, user: who, operation: 'add', reason: `Returned - ${inv.number} deleted`, before: r.before, after: r.after });
  });
  Log.write(req, `INVOICE ${inv.number} deleted by ${req.user.username}`);
  if (wantsJson(req)) return res.status(204).end();
  res.redirect('/sales?deleted=' + inv.number);
};

// GET /clients -> Clients list
exports.clients = (req, res) => {
  const q = req.query.q || '';
  res.render('clients/index', { title: 'Clients', pageName: 'Clients', nav: 'clients', clients: Client.search(q), q });
};

// GET /api/clients/:code  and  GET /api/stock/:sku  (lookups for the New Invoice page)
exports.clientJson = (req, res) => {
  const c = Client.findByCode(req.params.code);
  if (!c) return res.status(404).json({ error: `No client with ID ${String(req.params.code).toUpperCase()}` });
  res.json({ code: c.code, name: Client.fullName(c), address: c.address, phone: c.phone, status: c.status });
};
exports.stockJson = (req, res) => {
  const p = Product.findBySku(req.params.sku);
  if (!p) return res.status(404).json({ error: `No stock item with ID ${String(req.params.sku).toUpperCase()}` });
  res.json({ sku: p.sku, name: p.title, price: p.price, onHand: p.quantity, status: p.status });
};
