// ShopController - the customer web store: product catalogue, cart, checkout and orders.
// The cart lives in the server-side session. Every rule (active items only, quantity
// within stock on hand, prices from the catalogue) is checked on the server, so the
// browser can never change a price or buy more than LPA has.
const Product = require('../Models/Product');
const Invoice = require('../Models/Invoice');
const Client = require('../Models/Client');
const StockLedger = require('../Models/StockLedger');
const Log = require('../Models/ActivityLog');

const PAYMENT_OPTIONS = ['Visa', 'Mastercard', 'American Express', 'PayPal'];
const SORTS = {
  'featured':   (a, b) => a.id - b.id,
  'price-asc':  (a, b) => a.price - b.price || a.title.localeCompare(b.title),
  'price-desc': (a, b) => b.price - a.price || a.title.localeCompare(b.title),
  'name':       (a, b) => a.title.localeCompare(b.title),
};
const round2 = n => Math.round(n * 100) / 100;
const wantsJson = req => (req.get('accept') || '').includes('application/json');
const isCustomer = req => req.user && req.user.group === 'customer';

// Build the cart lines from the session (current catalogue prices).
function cartView(session) {
  const lines = [];
  session.cart = session.cart.filter(item => {
    const p = Product.findBySku(item.sku);
    if (!p || p.status !== 'active') return false; // item withdrawn since it was added
    lines.push({ sku: p.sku, title: p.title, image: p.image, price: p.price, qty: item.qty, onHand: p.quantity,
                 amount: round2(p.price * item.qty), short: item.qty > p.quantity });
    return true;
  });
  const total = round2(lines.reduce((s, l) => s + l.amount, 0));
  return { lines, total, gst: round2(total / 11), count: lines.reduce((n, l) => n + l.qty, 0) };
}

// GET /shop - product list (search, category filter, sort by price)
exports.index = (req, res) => {
  const q = String(req.query.q || '').trim();
  const sort = SORTS[req.query.sort] ? req.query.sort : 'featured';
  const category = String(req.query.category || '');
  let list = Product.forSale();
  const categories = [...new Set(list.map(p => p.category))].sort();
  if (q) { const s = q.toLowerCase(); list = list.filter(p => (p.title + ' ' + p.brand + ' ' + p.category + ' ' + p.description).toLowerCase().includes(s)); }
  if (category) list = list.filter(p => p.category === category);
  list = list.slice().sort(SORTS[sort]);
  const inCart = {};
  if (req.session) req.session.cart.forEach(i => { inCart[i.sku] = i.qty; });
  if (wantsJson(req)) return res.json(list.map(p => ({ sku: p.sku, title: p.title, price: p.price, onHand: p.quantity, category: p.category })));
  res.render('shop/index', { title: 'Shop', pageName: 'Shop', nav: 'shop', products: list, q, sort, category, categories,
    inCart, level: Product.level, canBuy: isCustomer(req), added: req.query.added || '' });
};

// POST /cart  { sku, qty } - add to cart
exports.add = (req, res) => {
  const fail = (status, error) => wantsJson(req) ? res.status(status).json({ error }) : res.redirect('/shop?error=' + encodeURIComponent(error));
  if (!isCustomer(req)) return fail(403, 'Only customer accounts can buy. Staff create orders with New Invoice.');
  const p = Product.findBySku(req.body.sku);
  const qty = parseInt(req.body.qty, 10);
  if (!p || p.status !== 'active') return fail(404, 'That product is not available.');
  if (!Number.isInteger(qty) || qty < 1) return fail(400, 'Quantity must be a whole number of at least 1.');
  const line = req.session.cart.find(i => i.sku === p.sku);
  const already = line ? line.qty : 0;
  if (already + qty > p.quantity) return fail(409, p.quantity === 0 ? `${p.title} is out of stock.` : `Only ${p.quantity} in stock (you already have ${already} in your cart).`);
  if (line) line.qty += qty; else req.session.cart.push({ sku: p.sku, qty });
  const view = cartView(req.session);
  const message = `${qty} x ${p.title} added to your cart.`;
  if (wantsJson(req)) return res.json({ ok: true, message, count: view.count, total: view.total, inCart: already + qty });
  res.redirect('/shop?added=' + encodeURIComponent(p.sku));
};

// GET /cart
exports.cart = (req, res) => {
  const view = cartView(req.session);
  res.render('shop/cart', Object.assign({ title: 'Your cart', pageName: 'Cart', nav: 'cart', error: req.query.error || '' }, view));
};

// POST /cart/:sku  { qty } - change quantity (0 removes)
exports.update = (req, res) => {
  const line = req.session.cart.find(i => i.sku === String(req.params.sku).toUpperCase());
  const p = Product.findBySku(req.params.sku);
  const qty = parseInt(req.body.qty, 10);
  let error = '';
  if (!line || !p) error = 'That item is not in your cart.';
  else if (!Number.isInteger(qty) || qty < 0) error = 'Quantity must be 0 or more.';
  else if (qty > p.quantity) error = `Only ${p.quantity} of ${p.title} in stock.`;
  else if (qty === 0) req.session.cart = req.session.cart.filter(i => i !== line);
  else line.qty = qty;
  const view = cartView(req.session);
  if (wantsJson(req)) return error ? res.status(400).json({ error, total: view.total, count: view.count }) : res.json(Object.assign({ ok: true }, view));
  res.redirect('/cart' + (error ? '?error=' + encodeURIComponent(error) : ''));
};

// DELETE /cart/:sku
exports.remove = (req, res) => {
  req.session.cart = req.session.cart.filter(i => i.sku !== String(req.params.sku).toUpperCase());
  const view = cartView(req.session);
  if (wantsJson(req)) return res.json(Object.assign({ ok: true }, view));
  res.redirect('/cart');
};

// GET /checkout
exports.checkoutForm = (req, res) => {
  const view = cartView(req.session);
  if (!view.lines.length) return res.redirect('/cart');
  const customer = Client.findByCode(req.user.clientId);
  // note: never pass a view variable called "client" - EJS reads it as its own render option
  res.render('shop/checkout', Object.assign({ title: 'Checkout', pageName: 'Checkout', nav: 'cart', customer, user: req.user,
    payments: PAYMENT_OPTIONS, errors: [], form: { address: customer.address, phone: customer.phone, payment: '' } }, view));
};

// POST /checkout - place the order: validate, create the invoice, take the stock, empty the cart
exports.checkout = (req, res) => {
  const view = cartView(req.session);
  const client = Client.findByCode(req.user.clientId);
  const form = { address: String(req.body.address || '').trim(), phone: String(req.body.phone || '').trim(), payment: String(req.body.payment || '') };
  const errors = [];
  if (!view.lines.length) errors.push('Your cart is empty.');
  if (!form.address) errors.push('Delivery address is required.');
  if (!/^[0-9 ()+-]{8,20}$/.test(form.phone)) errors.push('Enter a valid phone number.');
  if (!PAYMENT_OPTIONS.includes(form.payment)) errors.push('Choose a payment option.');
  view.lines.filter(l => l.short).forEach(l => errors.push(`Only ${l.onHand} of ${l.title} left in stock - please update your cart.`));
  if (req.body.expectedTotal && Number(req.body.expectedTotal) !== view.total) errors.push('Prices changed while you were checking out - please review the new total.');
  if (errors.length) {
    return res.status(400).render('shop/checkout', Object.assign({ title: 'Checkout', pageName: 'Checkout', nav: 'cart', customer: client, user: req.user, payments: PAYMENT_OPTIONS, errors, form }, view));
  }
  Client.update(client.code, form);
  const items = view.lines.map(l => ({ sku: l.sku, name: l.title, qty: l.qty, price: l.price }));
  const inv = Invoice.create({ clientId: client.code, items, payment: form.payment });
  items.forEach(i => {
    const r = Product.changeQty(i.sku, -i.qty);
    StockLedger.record({ sku: i.sku, title: i.name, user: `${client.firstName} ${client.lastName} (web order)`, operation: 'remove',
      reason: `Sold - ${inv.number}`, before: r.before, after: r.after });
  });
  req.session.cart = [];
  Log.write(req, `ORDER ${inv.number} by ${req.user.username}: ${items.length} line(s), $${inv.amount.toFixed(2)}, ${form.payment}`);
  res.redirect(`/orders/${inv.number}?placed=1`);
};

// GET /orders - the signed-in customer's own orders
exports.orders = (req, res) => {
  const list = Invoice.forClient(req.user.clientId);
  res.render('shop/orders', { title: 'My orders', pageName: 'Orders', nav: 'orders', orders: list, total: Invoice.total(list) });
};

// GET /orders/:number - one of the customer's own orders (others are not found)
exports.order = (req, res) => {
  const inv = Invoice.find(req.params.number);
  if (!inv || inv.clientId !== req.user.clientId) return res.status(404).render('error', { title: 'Not found', message: 'Order not found.', nav: 'orders' });
  res.render('shop/order', { title: `Order ${inv.number}`, pageName: 'Orders', nav: 'orders', inv, placed: req.query.placed === '1', backHref: '/orders' });
};

exports.PAYMENT_OPTIONS = PAYMENT_OPTIONS;
exports.cartView = cartView;
