// routes/index.js - maps URLs to controller actions. Each protected route asks for a
// PERMISSION (authorize('...')); which user groups hold it is decided by the access policy in
// config/security-policy.json (deny by default). Summary of that policy:
//   administrator : everything (incl. stock add/edit/delete, invoices add/delete, users)
//   user (staff)  : dashboard, stock view + adjustment, sales + clients (view), shop (view)
//   customer      : shop, cart, checkout, own orders
// Help, More, Preferences and the mashups are open to every signed-in user.
const express = require('express');
const router = express.Router();
const HomeController = require('../app/Controllers/HomeController');
const ProductController = require('../app/Controllers/ProductController');
const SalesController = require('../app/Controllers/SalesController');
const AuthController = require('../app/Controllers/AuthController');
const MashupController = require('../app/Controllers/MashupController');
const ShopController = require('../app/Controllers/ShopController');
const UserController = require('../app/Controllers/UserController');
const ReviewController = require('../app/Controllers/ReviewController');
const ActivityController = require('../app/Controllers/ActivityController');
const SecurityController = require('../app/Controllers/SecurityController');
const { authorize } = require('../app/Security/policy');

// Controller actions are async (they wait for MySQL). Express 4 does not catch errors from
// async functions by itself, so every handler is wrapped: a rejected promise goes to next(err)
// and reaches the error handler in server.js (e.g. "database not available" page).
const wrap = fn => (fn.length >= 4 ? fn : (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
['get', 'post', 'put', 'delete'].forEach(m => {
  const original = router[m].bind(router);
  router[m] = (path, ...handlers) => original(path, ...handlers.map(wrap));
});


// Public
router.get('/login', AuthController.loginForm);
router.post('/login', AuthController.login);
router.get('/register', AuthController.registerForm);
router.post('/register', AuthController.register);
router.post('/logout', AuthController.logout); // POST + CSRF token: another site cannot sign you out with a link
router.get('/privacy', (req, res) => res.render('privacy', { title: 'Privacy notice', bare: !req.user, hideNav: !req.user, nav: 'more' }));

// Everyone signed in
router.get('/', HomeController.index);
router.get('/help', HomeController.help);
router.get('/more', HomeController.more);
router.get('/settings', HomeController.settings);
router.get('/shop', authorize('shop.view'), ShopController.index);
router.get('/shop/:sku', authorize('shop.view'), ReviewController.show);

// Stock (staff view + adjust; administrators add / edit / delete)
router.get('/stock/ledger', authorize('stock.history'), ProductController.ledger);
router.get('/products', authorize('stock.view'), ProductController.index);
router.get('/products/new', authorize('stock.manage'), ProductController.newForm);
router.post('/products', authorize('stock.manage'), ProductController.create);
router.get('/products/:id', authorize('stock.view'), ProductController.show);
router.get('/products/:id/edit', authorize('stock.manage'), ProductController.editForm);
router.put('/products/:id', authorize('stock.manage'), ProductController.update);
router.delete('/products/:id', authorize('stock.manage'), ProductController.destroy);
router.post('/products/:id/adjust', authorize('stock.adjust'), ProductController.adjust);

// Sales & invoicing (staff view; administrators create / delete invoices)
router.get('/sales', authorize('sales.view'), SalesController.invoices);
router.get('/sales/new', authorize('sales.create'), SalesController.newForm);
router.post('/sales', authorize('sales.create'), SalesController.create);
router.get('/sales/:number', authorize('sales.view'), SalesController.show);
router.delete('/sales/:number', authorize('sales.delete'), SalesController.destroy);
router.get('/clients', authorize('clients.view'), SalesController.clients);
router.get('/api/clients/:code', authorize('clients.view'), SalesController.clientJson);
router.get('/api/stock/:sku', authorize('stock.view'), SalesController.stockJson);

// Users management (administrators)
router.get('/users', authorize('users.manage'), UserController.index);
router.get('/users/new', authorize('users.manage'), UserController.newForm);
router.post('/users', authorize('users.manage'), UserController.create);
router.get('/users/:id/edit', authorize('users.manage'), UserController.editForm);
router.put('/users/:id', authorize('users.manage'), UserController.update);
router.delete('/users/:id', authorize('users.manage'), UserController.destroy);

// Web store (customers)
router.post('/cart', authorize('shop.buy'), ShopController.add);
router.get('/cart', authorize('shop.buy'), ShopController.cart);
router.post('/cart/:sku', authorize('shop.buy'), ShopController.update);
router.delete('/cart/:sku', authorize('shop.buy'), ShopController.remove);
router.get('/checkout', authorize('shop.buy'), ShopController.checkoutForm);
router.post('/checkout', authorize('shop.buy'), ShopController.checkout);
router.get('/orders', authorize('orders.own'), ShopController.orders);
router.get('/orders/:number', authorize('orders.own'), ShopController.order);

// Product reviews (MongoDB): customers write / edit / delete their own; anyone signed in can vote;
// staff moderate; administrators can delete any review
router.post('/shop/:sku/reviews', authorize('reviews.write'), ReviewController.create);
router.put('/reviews/:id', authorize('reviews.write'), ReviewController.update);
router.delete('/reviews/:id', ReviewController.destroy); // owner (reviews.write) or reviews.delete_any - checked in the controller
router.post('/reviews/:id/helpful', authorize('reviews.vote'), ReviewController.vote);
router.get('/reviews', authorize('reviews.moderate'), ReviewController.index);
router.put('/reviews/:id/status', authorize('reviews.moderate'), ReviewController.setStatus);

// Your account: change your own password
router.get('/account/password', authorize('account.password'), SecurityController.passwordForm);
router.put('/account/password', authorize('account.password'), SecurityController.changePassword);

// Security status + access policy (administrators)
router.get('/security', authorize('security.view'), SecurityController.index);

// Activity log (MongoDB) - administrators
router.get('/activity', authorize('activity.view'), ActivityController.index);

// Mashups (About / More)
router.get('/mashups', MashupController.index);
router.get('/mashups/store-locator', MashupController.storeLocator);
router.get('/mashups/pricing', MashupController.pricing);
router.get('/mashups/api/stores', MashupController.storesJson);
router.get('/mashups/api/rates', MashupController.ratesJson);
router.get('/mashups/api/weather', MashupController.weatherJson);

module.exports = router;
