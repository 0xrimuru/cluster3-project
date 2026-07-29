// server.js - application entry point (wires the MVC framework together)
const path = require('path');
const express = require('express');
const methodOverride = require('method-override');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine: EJS, views live in app/Views (the "V" of MVC)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'app', 'Views'));

// Middleware
app.use(express.urlencoded({ extended: true })); // parse HTML form bodies
app.use(express.json());                          // parse JSON bodies (API clients)
app.use(methodOverride('_method'));               // let HTML forms send PUT and DELETE
app.use(express.static(path.join(__dirname, 'public')));

// Routes (map URLs -> controllers)
app.use('/', routes);

// 404 handler
app.use((req, res) => res.status(404).render('error', { title: 'Not found', message: 'Page not found.' }));

app.listen(PORT, () => console.log(`Bookstore MVC app running at http://localhost:${PORT}`));

module.exports = app;
