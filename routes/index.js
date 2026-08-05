// routes/index.js - maps URLs to controller actions.
const express = require('express');
const router = express.Router();
const HomeController = require('../app/Controllers/HomeController');
const BookController = require('../app/Controllers/BookController');
const MashupController = require('../app/Controllers/MashupController');

// Home page, rendered through a controller
router.get('/', HomeController.index);

// Mashups (ICTPRG538) - two mashups + their JSON endpoints
router.get('/mashups', MashupController.index);
router.get('/mashups/store-locator', MashupController.storeLocator);
router.get('/mashups/pricing', MashupController.pricing);
router.get('/mashups/api/stores', MashupController.storesJson);
router.get('/mashups/api/rates', MashupController.ratesJson);
router.get('/mashups/api/weather', MashupController.weatherJson);

// Book resource - demonstrates all four HTTP verbs
router.get('/books', BookController.index);            // GET    (read: list)
router.get('/books/new', BookController.newForm);      // GET    (create form)
router.post('/books', BookController.create);          // POST   (create)
router.get('/books/:id', BookController.show);         // GET    (read: one)
router.get('/books/:id/edit', BookController.editForm);// GET    (edit form)
router.put('/books/:id', BookController.update);       // PUT    (update)
router.delete('/books/:id', BookController.destroy);   // DELETE (delete)

module.exports = router;
