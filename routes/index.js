// routes/index.js - maps URLs to controller actions.
const express = require('express');
const router = express.Router();
const HomeController = require('../app/Controllers/HomeController');
const ProductController = require('../app/Controllers/ProductController');
const SalesController = require('../app/Controllers/SalesController');
const AuthController = require('../app/Controllers/AuthController');
const MashupController = require('../app/Controllers/MashupController');

router.get('/', HomeController.index);
router.get('/settings', HomeController.settings);

router.get('/login', AuthController.loginForm);
router.post('/login', AuthController.login);
router.get('/logout', AuthController.logout);

router.get('/stock/ledger', ProductController.ledger);

router.get('/products', ProductController.index);
router.get('/products/new', ProductController.newForm);
router.post('/products', ProductController.create);
router.get('/products/:id', ProductController.show);
router.get('/products/:id/edit', ProductController.editForm);
router.put('/products/:id', ProductController.update);
router.delete('/products/:id', ProductController.destroy);
router.post('/products/:id/adjust', ProductController.adjust);

router.get('/sales', SalesController.invoices);
router.get('/clients', SalesController.clients);

router.get('/mashups', MashupController.index);
router.get('/mashups/store-locator', MashupController.storeLocator);
router.get('/mashups/pricing', MashupController.pricing);
router.get('/mashups/api/stores', MashupController.storesJson);
router.get('/mashups/api/rates', MashupController.ratesJson);
router.get('/mashups/api/weather', MashupController.weatherJson);

module.exports = router;
