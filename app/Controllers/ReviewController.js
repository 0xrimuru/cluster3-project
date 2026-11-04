// ReviewController - product page with customer reviews (MongoDB) and staff moderation.
// Product details come from MySQL (lpa_stock); reviews and rating summaries from MongoDB.
const Product = require('../Models/Product');
const Client = require('../Models/Client');
const Invoice = require('../Models/Invoice');
const Review = require('../Models/NoSql/Review');
const Log = require('../Models/NoSql/ActivityLog');
const policy = require('../Security/policy');

const { wantsJson, notFound } = require('../Middleware/respond');
const isCustomer = req => policy.can(req.user, 'reviews.write');
const isStaff = req => policy.can(req.user, 'stock.view');
const back = (sku, q) => `/shop/${encodeURIComponent(sku)}${q ? '?' + q : ''}#reviews`;

// Render the product page (also used to show validation errors).
async function renderProduct(req, res, sku, extra = {}) {
  const product = await Product.findBySku(sku);
  if (!product || (product.status !== 'active' && !isStaff(req))) {
    return notFound(req, res, 'Product not found.', 'shop');
  }
  const sort = Review.SORTS.includes(req.query.sort) ? req.query.sort : 'newest';
  const [reviews, summary] = await Promise.all([Review.forProduct(product.sku, { viewer: req.user, sort }), Review.summary(product.sku)]);
  let mine = null; let canReview = false; let bought = false;
  if (isCustomer(req)) {
    [mine, bought] = await Promise.all([Review.mine(product.sku, req.user.clientId, req.user), Invoice.hasBought(req.user.clientId, product.sku)]);
    canReview = bought && !mine;
  }
  const inCart = req.session ? ((req.session.cart.find(i => i.sku === product.sku) || {}).qty || 0) : 0;
  if (wantsJson(req) && !extra.errors) return res.json({ product, summary, reviews });
  res.status(extra.status || 200).render('shop/product', Object.assign({
    title: product.title, pageName: 'Shop', nav: 'shop', product, level: Product.level(product), summary, reviews, sort,
    mine, canReview, bought, canBuy: isCustomer(req), inCart, errors: [], form: {}, editing: false,
    notice: { saved: 'Thank you - your review is published.', updated: 'Your review was updated.', deleted: 'Your review was deleted.', voted: 'Thanks for your vote.' }[req.query.done] || '',
    voteError: req.query.vote || '',
  }, extra));
}

// GET /shop/:sku
exports.show = (req, res) => renderProduct(req, res, req.params.sku);

// POST /shop/:sku/reviews (customers who bought the product)
exports.create = async (req, res) => {
  const sku = String(req.params.sku).toUpperCase();
  const product = await Product.findBySku(sku);
  if (!product) return notFound(req, res, 'Product not found.', 'shop');
  const { errors, clean } = Review.validate(req.body);
  if (!(await Invoice.hasBought(req.user.clientId, sku))) errors.unshift('You can review a product after you have bought it.');
  let result = null;
  if (!errors.length) {
    const customer = await Client.findByCode(req.user.clientId);
    result = await Review.create({ user: req.user, customer, sku, data: clean });
    if (result.errors) errors.push(...result.errors);
  }
  if (errors.length) {
    if (wantsJson(req)) return res.status(400).json({ errors });
    return renderProduct(req, res, sku, { errors, form: req.body, status: 400 });
  }
  Log.write(req, `REVIEW ${sku} ${clean.rating}-star by ${req.user.username}`, { sku, reviewId: result.review.id });
  if (wantsJson(req)) return res.status(201).json(result.review);
  res.redirect(back(sku, 'done=saved'));
};

// PUT /reviews/:id (the author)
exports.update = async (req, res) => {
  const current = await Review.get(req.params.id, req.user);
  if (!current || !policy.canEditReview(req.user, current)) return notFound(req, res, 'Review not found.', 'shop');
  const { errors, clean } = Review.validate(req.body);
  if (errors.length) {
    if (wantsJson(req)) return res.status(400).json({ errors });
    return renderProduct(req, res, current.sku, { errors, form: req.body, editing: true, status: 400 });
  }
  const r = await Review.update(current.id, req.user, clean);
  if (wantsJson(req)) return res.json(r);
  res.redirect(back(current.sku, 'done=updated'));
};

// DELETE /reviews/:id (the author, or an administrator)
exports.destroy = async (req, res) => {
  const current = await Review.get(req.params.id, req.user);
  if (current && !policy.canDeleteReview(req.user, current)) {
    // someone else's review: log the attempt, answer "not found" (do not reveal it exists)
    Log.write(req, `ACCESS_DENIED DELETE review ${current.id} (not the author)`, { type: 'ACCESS_DENIED', permission: 'reviews.delete_any' });
  }
  const ok = current && policy.canDeleteReview(req.user, current) && await Review.remove(current.id, req.user);
  if (!ok) return notFound(req, res, 'Review not found.', 'shop');
  Log.write(req, `REVIEW ${current.sku} review ${current.id} deleted by ${req.user.username}`, { sku: current.sku, reviewId: current.id });
  if (wantsJson(req)) return res.status(204).end();
  res.redirect(policy.can(req.user, 'reviews.moderate') ? '/reviews?done=deleted' : back(current.sku, 'done=deleted'));
};

// POST /reviews/:id/helpful
exports.vote = async (req, res) => {
  const current = await Review.get(req.params.id, req.user);
  if (!current) return notFound(req, res, 'Review not found.', 'shop');
  const r = await Review.vote(current.id, req.user);
  if (wantsJson(req)) {
    const after = await Review.get(current.id, req.user);
    return r.ok ? res.json({ ok: true, helpful: after.helpful }) : res.status(409).json({ error: r.error, helpful: after.helpful });
  }
  res.redirect(back(current.sku, r.ok ? 'done=voted' : 'vote=' + encodeURIComponent(r.error)));
};

// GET /reviews (staff) - moderation list with text search and filters
exports.index = async (req, res) => {
  const f = { q: String(req.query.q || '').trim(), status: String(req.query.status || ''), maxRating: String(req.query.maxRating || ''), sku: String(req.query.sku || '').trim() };
  const list = await Review.search(f);
  if (wantsJson(req)) return res.json({ reviews: list });
  res.render('reviews/index', { title: 'Product reviews', pageName: 'Reviews', nav: 'more', reviews: list, f,
    notice: { hidden: 'Review hidden from the shop.', published: 'Review published.', deleted: 'Review deleted.' }[req.query.done] || '' });
};

// PUT /reviews/:id/status (staff) - hide or publish
exports.setStatus = async (req, res) => {
  const status = req.body.status === 'hidden' ? 'hidden' : 'published';
  const r = await Review.setStatus(req.params.id, status);
  if (!r) return notFound(req, res, 'Review not found.', 'more');
  Log.write(req, `REVIEW ${r.sku} review ${r.id} ${status} by ${req.user.username}`, { sku: r.sku, reviewId: r.id });
  if (wantsJson(req)) return res.json(r);
  res.redirect('/reviews?done=' + status + (req.body.qs ? '&' + String(req.body.qs).replace(/[^\w=&%+.-]/g, '') : ''));
};
