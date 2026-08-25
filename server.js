// server.js - application entry point (wires the MVC framework together)
const path = require('path');
const express = require('express');
const methodOverride = require('method-override');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'app', 'Views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Login gate: you must sign in before reaching any store page.
// (Interface-level check via a cookie; full authentication is built in the
//  security block, ICTPRG537 - hashed passwords, roles, etc.)
function requireLogin(req, res, next) {
  const authed = (req.headers.cookie || '').split(';').some(c => c.trim() === 'otb_auth=1');
  if (authed || req.path === '/login') return next();
  return res.redirect('/login');
}
app.use(requireLogin);

app.use('/', routes);

app.use((req, res) => res.status(404).render('error', { title: 'Not found', message: 'Page not found.' }));

app.listen(PORT, () => console.log(`LPA eComms MVC app running at http://localhost:${PORT}`));

module.exports = app;
