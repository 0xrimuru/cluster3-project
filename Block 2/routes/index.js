// routes/index.js - maps URLs to controller actions.
const express = require('express');
const router = express.Router();
const HomeController = require('../app/Controllers/HomeController');
const BookController = require('../app/Controllers/BookController');

// Home page, rendered through a controller
router.get('/', HomeController.index);

// Book resource - demonstrates all four HTTP verbs
router.get('/books', BookController.index);            // GET    (read: list)
router.get('/books/new', BookController.newForm);      // GET    (create form)
router.post('/books', BookController.create);          // POST   (create)
router.get('/books/:id', BookController.show);         // GET    (read: one)
router.get('/books/:id/edit', BookController.editForm);// GET    (edit form)
router.put('/books/:id', BookController.update);       // PUT    (update)
router.delete('/books/:id', BookController.destroy);   // DELETE (delete)

module.exports = router;
