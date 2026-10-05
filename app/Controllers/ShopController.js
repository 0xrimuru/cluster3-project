// ShopController - the customer web store: product catalogue, cart, checkout and orders.
// Products, prices and stock come from MySQL (lpa_stock); the cart lives in the server-side
// session. Every rule (active items only, quantity within stock on hand, prices from the
// catalogue) is checked on the server, so the browser can never change a price or buy more
// than LPA has. Placing an order is one database transaction.
const Product = require('../Models/Product');
const Invoice = require('../Models/Invoice');
const Client = require('../Models/Client');
const Log = require('../Models/ActivityLog');
const { transaction } = require('../../config/database');
const { takeStock, RuleError } = require('./SalesController');

const PAYMENT_OPTIONS = ['Visa', 'Mastercard', 'American Express', 'PayPal'];
const round2 = n => Math.round(n * 100) / 100;
const wantsJson = req => (req.get('accept') || '').includes('application/json');
const isCustomer = req => req.user && req.user.group === 'customer';

// Build the cart lines from the session using current catalogue prices (one SQL query).
async function cartView(session) {
  const found = await Product.findMany(session.cart.map(i => i.sku));
  const bySku = Object.fromEntries(found.map(p => [p.sku, p]));
  const lines = [];
  session.cart = session.cart.filter(item => {
    const p = bySku[item.sku];
    if (!p || p.status !== 'active') return false; // item withdrawn since it was added
    lines.push({ sku: p.sku, title: p.title, image: p.image, price: p.price, qty: item.qty, onHand: p.quantity,
                 amount: round2(p.price * item.qty), short: item.qty > p.quantity });
    return true;
  });
  const total = round2(lines.reduce((s, l) => s + l.amount, 0));
  return { lines, total, gst: round2(total / 11), count: lines.reduce((n, l) => n + l.qty, 0) };
}

// GET /shop - product list (search, category filter and sort are done by SQL)
exports.index = async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const sort = Product.SORTS.includes(req.query.sort) ? req.query.sort : 'featured';
  const category = String(req.query.category || '');
  const [list, categories] = await Promise.all([Product.forSale({ q, category, sort }), Product.categories()]);
  const inCart = {};
  if (req.session) req.session.cart.forEach(i => { inCart[i.sku] = i.qty; });
  if (wantsJson(req)) return res.json(list.map(p => ({ sku: p.sku, title: p.title, price: p.price, onHand: p.quantity, category: p.category })));
  res.render('shop/index', { title: 'Shop', pageName: 'Shop', nav: 'shop', products: list, q, sort, category, categories,
    inCart, level: Product.level, canBuy: isCustomer(req), added: req.query.added || '' });
};

// POST /cart  { sku, qty } - add to cart
exports.add = async (req, res) => {
  const fail = (status, error) => (wantsJson(req) ? res.status(status).json({ error }) : res.redirect('/shop?error=' + encodeURIComponent(error)));
  if (!isCustomer(req)) return fail(403, 'Only customer accounts can buy. Staff create orders with New Invoice.');
  const p = await Product.findBySku(req.body.sku);
  const qty = Number(req.body.qty);
  if (!p || p.status !== 'active') return fail(404, 'That product is not available.');
  if (!Number.isInteger(qty) || qty < 1) return fail(400, 'Quantity must be a whole number of at least 1.');
  const line = req.session.cart.find(i => i.sku === p.sku);
  const already = line ? line.qty : 0;
  if (already + qty > p.quantity) return fail(409, p.quantity === 0 ? `${p.title} is out of stock.` : `Only ${p.quantity} in stock (you already have ${already} in your cart).`);
  if (line) line.qty += qty; else req.session.cart.push({ sku: p.sku, qty });
  const view = await cartView(req.session);
  const message = `${qty} x ${p.title} added to your cart.`;
  if (wantsJson(req)) return res.json({ ok: true, message, count: view.count, total: view.total, inCart: already + qty });
  res.redirect('/shop?added=' + encodeURIComponent(p.sku));
};

// GET /cart
exports.cart = async (req, res) => {
  const view = await cartView(req.session);
  res.render('shop/cart', Object.assign({ title: 'Your cart', pageName: 'Cart', nav: 'cart', error: req.query.error || '' }, view));
};

// POST /cart/:sku  { qty } - change quantity (0 removes)
exports.update = async (req, res) => {
  const line = req.session.cart.find(i => i.sku === String(req.params.sku).toUpperCase());
  const p = await Product.findBySku(req.params.sku);
  const qty = Number(req.body.qty);
  let error = '';
  if (!line || !p) error = 'That item is not in your cart.';
  else if (!Number.isInteger(qty) || qty < 0) error = 'Quantity must be 0 or more.';
  else if (qty > p.quantity) error = `Only ${p.quantity} of ${p.title} in stock.`;
  else if (qty === 0) req.session.cart = req.session.cart.filter(i => i !== line);
  else line.qty = qty;
  const view = await cartView(req.session);
  if (wantsJson(req)) return error ? res.status(400).json({ error, total: view.total, count: view.count }) : res.json(Object.assign({ ok: true }, view));
  res.redirect('/cart' + (error ? '?error=' + encodeURIComponent(error) : ''));
};

// DELETE /cart/:sku
exports.remove = async (req, res) => {
  req.session.cart = req.session.cart.filter(i => i.sku !== String(req.params.sku).toUpperCase());
  const view = await cartView(req.session);
  if (wantsJson(req)) return res.json(Object.assign({ ok: true }, view));
  res.redirect('/cart');
};

// GET /checkout
exports.checkoutForm = async (req, res) => {
  const view = await cartView(req.session);
  if (!view.lines.length) return res.redirect('/cart');
  const customer = await Client.findByCode(req.user.clientId);
  // note: never pass a view variable called "client" - EJS reads it as its own render option
  res.render('shop/checkout', Object.assign({ title: 'Checkout', pageName: 'Checkout', nav: 'cart', customer, user: req.user,
    payments: PAYMENT_OPTIONS, errors: [], form: { address: customer.address, phone: customer.phone, payment: '' } }, view));
};

// POST /checkout - place the order. In ONE transaction: lock the stock rows, re-check stock and
// prices, save the delivery details, create the invoice + items, take the stock, write the ledger.
exports.checkout = async (req, res) => {
  const view = await cartView(req.session);
  const customer = await Client.findByCode(req.user.clientId);
  const form = { address: String(req.body.address || '').trim(), phone: String(req.body.phone || '').trim(), payment: String(req.body.payment || '') };
  const errors = [];
  if (!view.lines.length) errors.push('Your cart is empty.');
  if (!form.address) errors.push('Delivery address is required.');
  else if (form.address.length > 250) errors.push('Delivery address must be 250 characters or fewer.');
  if (!/^[0-9 ()+-]{8,20}$/.test(form.phone)) errors.push('Enter a valid phone number.');
  if (!PAYMENT_OPTIONS.includes(form.payment)) errors.push('Choose a payment option.');
  view.lines.filter(l => l.short).forEach(l => errors.push(`Only ${l.onHand} of ${l.title} left in stock - please update your cart.`));
  if (req.body.expectedTotal && Number(req.body.expectedTotal) !== view.total) errors.push('Prices changed while you were checking out - please review the new total.');
  const again = errs => res.status(400).render('shop/checkout', Object.assign({ title: 'Checkout', pageName: 'Checkout', nav: 'cart', customer, user: req.user, payments: PAYMENT_OPTIONS, errors: errs, form }, view));
  if (errors.length) return again(errors);

  const wanted = Object.fromEntries(view.lines.map(l => [l.sku, l.qty]));
  let inv;
  try {
    inv = await transaction(async conn => {
      const stock = await takeStock(conn, wanted, req.user.id, n => `Sold - ${n}`);
      // someone may have changed a price after the cart was shown - never charge a different total
      const lockedTotal = round2(stock.items.reduce((s, i) => s + round2(i.qty * i.price), 0));
      if (lockedTotal !== view.total) throw new RuleError(['Prices changed while you were checking out - please review the new total.']);
      const client = await Client.update(customer.code, form, conn);
      const created = await Invoice.create({ client, items: stock.items, payment: form.payment }, conn);
      await stock.finish(created.number);
      return created;
    });
  } catch (err) {
    if (err instanceof RuleError) return again(err.errors);
    throw err;
  }
  req.session.cart = [];
  Log.write(req, `ORDER ${inv.number} by ${req.user.username}: ${inv.items.length} line(s), $${inv.amount.toFixed(2)}, ${form.payment}`);
  res.redirect(`/orders/${inv.number}?placed=1`);
};

// GET /orders - the signed-in customer's own orders
exports.orders = async (req, res) => {
  const list = await Invoice.forClient(req.user.clientId);
  res.render('shop/orders', { title: 'My orders', pageName: 'Orders', nav: 'orders', orders: list, total: Invoice.total(list) });
};

// GET /orders/:number - one of the customer's own orders (others are "not found")
exports.order = async (req, res) => {
  const inv = await Invoice.find(req.params.number);
  if (!inv || inv.clientId !== req.user.clientId) return res.status(404).render('error', { title: 'Not found', message: 'Order not found.', nav: 'orders' });
  res.render('shop/order', { title: `Order ${inv.number}`, pageName: 'Orders', nav: 'orders', inv, placed: req.query.placed === '1', backHref: '/orders' });
};

exports.PAYMENT_OPTIONS = PAYMENT_OPTIONS;
exports.cartView = cartView;
