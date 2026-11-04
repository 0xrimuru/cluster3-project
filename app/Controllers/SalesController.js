// SalesController - Sales & Invoicing (search, new invoice, invoice detail, delete),
// the Clients list, and two small JSON lookups used by the New Invoice page.
// New and deleted invoices change several tables (invoice, items, stock, ledger), so each
// is done in ONE database transaction: either everything is saved or nothing is.
const Invoice = require('../Models/Invoice');
const Client = require('../Models/Client');
const Product = require('../Models/Product');
const StockLedger = require('../Models/StockLedger');
const Log = require('../Models/NoSql/ActivityLog');
const { transaction } = require('../../config/database');

const { wantsJson, notFound } = require('../Middleware/respond');
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' });

// Thrown inside a transaction when a business rule fails -> ROLLBACK + 400 to the user.
class RuleError extends Error { constructor(errors) { super(errors.join(' ')); this.errors = errors; } }

// GET /sales -> Sales & Invoicing (search invoices, results, total)
exports.invoices = async (req, res) => {
  const q = String(req.query.q || '');
  const list = await Invoice.search(q);
  if (wantsJson(req)) return res.json({ invoices: list, total: Invoice.total(list) });
  res.render('sales/index', {
    title: 'Sales & Invoicing', pageName: 'Sales', nav: 'sales',
    invoices: list, q, total: Invoice.total(list),
    notice: req.query.deleted ? `Invoice ${req.query.deleted} deleted and its stock returned.` : '',
  });
};

// GET /sales/new -> New Invoice form
exports.newForm = async (req, res) => {
  res.render('sales/new', { title: 'New invoice', pageName: 'Sales', nav: 'sales', nextNumber: await Invoice.nextNumber(), today: today() });
};

// Check the request shape (no database needed). Returns { errors, wanted: {sku: qty}, date }.
function readInvoice(body) {
  const errors = [];
  let raw = body.items;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { raw = null; } }
  if (!Array.isArray(raw) || raw.length === 0) errors.push('Add at least one stock item.');
  const wanted = {};
  (Array.isArray(raw) ? raw : []).forEach(r => {
    const qty = Number(r && r.qty);
    const sku = String((r && r.sku) || '').trim().toUpperCase();
    if (!sku) { errors.push('Every line needs a stock ID.'); return; }
    if (!Number.isInteger(qty) || qty < 1 || qty > 100000) { errors.push(`Quantity for ${sku} must be a whole number of at least 1.`); return; }
    wanted[sku] = (wanted[sku] || 0) + qty; // the same item twice -> one line
  });
  const date = String(body.date || '');
  // Date.parse('2026-02-30') rolls over to 2 March, so also check the day survives the round trip
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) errors.push('Date must be a valid date.');
  else if (date && date > today()) errors.push('The invoice date cannot be in the future.');
  return { errors, wanted, date };
}

const MAX_INVOICE = 999999.99; // lpa_inv_amount is DECIMAL(8,2)

// The stock rules for selling qty of item p (null = OK). Used inside the transaction and by the read-only pre-check.
function stockProblem(p, sku, qty) {
  if (!p || p.status === 'deleted') return `Stock item ${sku} not found.`;
  if (p.status !== 'active') return `${p.title} is disabled and cannot be sold.`;
  if (qty > p.quantity) return `Only ${p.quantity} of ${p.title} on hand (asked for ${qty}).`;
  return null;
}

// Inside the transaction: lock each stock row, check it, and build the lines (price from the catalogue).
async function takeStock(conn, wanted, userId, reasonFor) {
  const errors = [];
  const items = [];
  for (const sku of Object.keys(wanted).sort()) { // same lock order every time -> no deadlocks
    const p = await Product.lockForUpdate(sku, conn);
    const problem = stockProblem(p, sku, wanted[sku]);
    if (problem) { errors.push(problem); continue; }
    items.push({ sku: p.sku, name: p.title, qty: wanted[sku], price: p.price, before: p.quantity });
  }
  if (items.reduce((sum, i) => sum + i.qty * i.price, 0) > MAX_INVOICE) errors.push(`One invoice can be at most $${MAX_INVOICE.toLocaleString('en-AU')} - split the order.`);
  if (errors.length) throw new RuleError(errors);
  return { items, finish: async number => {
    for (const i of items) {
      const r = await Product.changeQty(i.sku, -i.qty, conn);
      await StockLedger.record({ sku: i.sku, userId, operation: 'remove', reason: reasonFor(number), before: r.before, after: r.after }, conn);
    }
  } };
}
exports.takeStock = takeStock;
exports.RuleError = RuleError;

// POST /sales -> create invoice (JSON from the New Invoice page)
exports.create = async (req, res) => {
  const bad = errors => (wantsJson(req) ? res.status(400).json({ errors }) : res.status(400).render('error', { title: 'Invoice not saved', message: errors.join(' '), nav: 'sales' }));
  const { errors, wanted, date } = readInvoice(req.body);
  const client = await Client.findByCode(req.body.clientId);
  if (!client) errors.unshift('Search and select a client first (client ID not found).');
  else if (client.status !== 'active') errors.unshift(`Client ${client.code} is disabled.`);
  if (errors.length) {
    // report every problem at once: also check the stock (read only - nothing is saved)
    const bySku = Object.fromEntries((await Product.findMany(Object.keys(wanted))).map(p => [p.sku, p]));
    for (const sku of Object.keys(wanted)) { const problem = stockProblem(bySku[sku], sku, wanted[sku]); if (problem) errors.push(problem); }
    return bad(errors);
  }
  let inv;
  try {
    inv = await transaction(async conn => {
      const stock = await takeStock(conn, wanted, req.user.id, n => `Sold - ${n}`);
      const created = await Invoice.create({ client, items: stock.items, date: date || undefined, payment: 'Account' }, conn);
      await stock.finish(created.number);
      return created;
    });
  } catch (err) {
    if (err instanceof RuleError) return bad(err.errors);
    throw err;
  }
  Log.write(req, `INVOICE ${inv.number} created by ${req.user.username} for ${client.code}: $${inv.amount.toFixed(2)}`);
  if (wantsJson(req)) return res.status(201).json({ ok: true, number: inv.number, url: `/sales/${inv.number}?created=1` });
  res.redirect(`/sales/${inv.number}?created=1`);
};

// GET /sales/:number -> invoice detail
exports.show = async (req, res) => {
  const inv = await Invoice.find(req.params.number);
  if (!inv) return notFound(req, res, 'Invoice not found.', 'sales');
  if (wantsJson(req)) return res.json(inv);
  res.render('shop/order', { title: `Invoice ${inv.number}`, pageName: 'Sales', nav: 'sales', inv, placed: false,
    created: req.query.created === '1', backHref: '/sales', staffView: true });
};

// DELETE /sales/:number -> delete invoice (administrators) and return its stock - one transaction
exports.destroy = async (req, res) => {
  const inv = await transaction(async conn => {
    const removed = await Invoice.remove(req.params.number, conn);
    if (!removed) return null;
    for (const i of removed.items) {
      const r = await Product.changeQty(i.sku, i.qty, conn);
      if (r) await StockLedger.record({ sku: i.sku, userId: req.user.id, operation: 'add', reason: `Returned - ${removed.number} deleted`, before: r.before, after: r.after }, conn);
    }
    return removed;
  });
  if (!inv) return notFound(req, res, 'Invoice not found.', 'sales');
  Log.write(req, `INVOICE ${inv.number} deleted by ${req.user.username}`);
  if (wantsJson(req)) return res.status(204).end();
  res.redirect('/sales?deleted=' + inv.number);
};

// GET /clients -> Clients list
exports.clients = async (req, res) => {
  const q = String(req.query.q || '');
  res.render('clients/index', { title: 'Clients', pageName: 'Clients', nav: 'clients', clients: await Client.search(q), q });
};

// GET /api/clients/:code  and  GET /api/stock/:sku  (lookups for the New Invoice page)
exports.clientJson = async (req, res) => {
  const c = await Client.findByCode(req.params.code);
  if (!c) return res.status(404).json({ error: `No client with ID ${String(req.params.code).toUpperCase()}` });
  res.json({ code: c.code, name: Client.fullName(c), address: c.address, phone: c.phone, status: c.status });
};
exports.stockJson = async (req, res) => {
  const p = await Product.findBySku(req.params.sku);
  if (!p) return res.status(404).json({ error: `No stock item with ID ${String(req.params.sku).toUpperCase()}` });
  res.json({ sku: p.sku, name: p.title, price: p.price, onHand: p.quantity, status: p.status });
};
