// routes/index.js - maps URLs to controller actions, with the user groups allowed for each.
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
const { requireRole, STAFF } = require('../app/Middleware/auth');

const admin = requireRole('administrator');
const staff = requireRole(...STAFF);
const customer = requireRole('customer');

// Public
router.get('/login', AuthController.loginForm);
router.post('/login', AuthController.login);
router.get('/register', AuthController.registerForm);
router.post('/register', AuthController.register);
router.get('/logout', AuthController.logout);

// Everyone signed in
router.get('/', HomeController.index);
router.get('/help', HomeController.help);
router.get('/more', HomeController.more);
router.get('/settings', HomeController.settings);
router.get('/shop', ShopController.index);

// Stock (staff view + adjust; administrators add / edit / delete)
router.get('/stock/ledger', staff, ProductController.ledger);
router.get('/products', staff, ProductController.index);
router.get('/products/new', admin, ProductController.newForm);
router.post('/products', admin, ProductController.create);
router.get('/products/:id', staff, ProductController.show);
router.get('/products/:id/edit', admin, ProductController.editForm);
router.put('/products/:id', admin, ProductController.update);
router.delete('/products/:id', admin, ProductController.destroy);
router.post('/products/:id/adjust', staff, ProductController.adjust);

// Sales & invoicing (staff view; administrators create / delete invoices)
router.get('/sales', staff, SalesController.invoices);
router.get('/sales/new', admin, SalesController.newForm);
router.post('/sales', admin, SalesController.create);
router.get('/sales/:number', staff, SalesController.show);
router.delete('/sales/:number', admin, SalesController.destroy);
router.get('/clients', staff, SalesController.clients);
router.get('/api/clients/:code', staff, SalesController.clientJson);
router.get('/api/stock/:sku', staff, SalesController.stockJson);

// Users management (administrators)
router.get('/users', admin, UserController.index);
router.get('/users/new', admin, UserController.newForm);
router.post('/users', admin, UserController.create);
router.get('/users/:id/edit', admin, UserController.editForm);
router.put('/users/:id', admin, UserController.update);
router.delete('/users/:id', admin, UserController.destroy);

// Web store (customers)
router.post('/cart', customer, ShopController.add);
router.get('/cart', customer, ShopController.cart);
router.post('/cart/:sku', customer, ShopController.update);
router.delete('/cart/:sku', customer, ShopController.remove);
router.get('/checkout', customer, ShopController.checkoutForm);
router.post('/checkout', customer, ShopController.checkout);
router.get('/orders', customer, ShopController.orders);
router.get('/orders/:number', customer, ShopController.order);

// Mashups (About / More)
router.get('/mashups', MashupController.index);
router.get('/mashups/store-locator', MashupController.storeLocator);
router.get('/mashups/pricing', MashupController.pricing);
router.get('/mashups/api/stores', MashupController.storesJson);
router.get('/mashups/api/rates', MashupController.ratesJson);
router.get('/mashups/api/weather', MashupController.weatherJson);

module.exports = router;
