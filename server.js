// server.js - application entry point (wires the MVC framework together)
const path = require('path');
const express = require('express');
const methodOverride = require('method-override');
const routes = require('./routes');
const { loadUser, requireLogin } = require('./app/Middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'app', 'Views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Sessions + login gate: every page except Login and Register needs a signed-in,
// active user. Role checks per route are in routes/index.js.
app.use(loadUser);
app.use(requireLogin);

app.use('/', routes);

app.use((req, res) => res.status(404).render('error', { title: 'Not found', message: 'Page not found.' }));

// Errors: log the details on the server, show the user a plain message (no stack trace,
// file paths or code are ever sent to the browser).
app.use((err, req, res, next) => {
  console.error(new Date().toISOString(), req.method, req.originalUrl, err);
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if ((req.get('accept') || '').includes('application/json')) return res.status(status).json({ error: status === 400 ? 'Bad request' : 'Something went wrong' });
  res.status(status).render('error', { title: 'Error', message: status === 400 ? 'The request could not be read.' : 'Sorry, something went wrong. Please try again.' });
});

app.listen(PORT, () => console.log(`LPA eComms MVC app running at http://localhost:${PORT}`));

module.exports = app;
