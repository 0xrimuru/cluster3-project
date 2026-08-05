// routes/index.js - maps URLs to controller actions.
const express = require('express');
const router = express.Router();
const HomeController = require('../app/Controllers/HomeController');
const BookController = require('../app/Controllers/BookController');
const SalesController = require('../app/Controllers/SalesController');
const AuthController = require('../app/Controllers/AuthController');
const MashupController = require('../app/Controllers/MashupController');

router.get('/', HomeController.index);
router.get('/settings', HomeController.settings);

router.get('/login', AuthController.loginForm);
router.post('/login', AuthController.login);

router.get('/stock/ledger', BookController.ledger);

router.get('/books', BookController.index);
router.get('/books/new', BookController.newForm);
router.post('/books', BookController.create);
router.get('/books/:id', BookController.show);
router.get('/books/:id/edit', BookController.editForm);
router.put('/books/:id', BookController.update);
router.delete('/books/:id', BookController.destroy);
router.post('/books/:id/adjust', BookController.adjust);

router.get('/sales', SalesController.invoices);
router.get('/clients', SalesController.clients);

router.get('/mashups', MashupController.index);
router.get('/mashups/store-locator', MashupController.storeLocator);
router.get('/mashups/pricing', MashupController.pricing);
router.get('/mashups/api/stores', MashupController.storesJson);
router.get('/mashups/api/rates', MashupController.ratesJson);
router.get('/mashups/api/weather', MashupController.weatherJson);

module.exports = router;
