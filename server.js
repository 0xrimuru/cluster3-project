// server.js - application entry point (wires the MVC framework together)
const path = require('path');
const express = require('express');
const methodOverride = require('method-override');
const routes = require('./routes');
const { loadUser, requireLogin } = require('./app/Middleware/auth');
const security = require('./app/Middleware/security');
const db = require('./config/database');
const nosql = require('./config/nosql');
const RatingTrigger = require('./app/Models/NoSql/RatingTrigger');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'app', 'Views'));
app.disable('x-powered-by');

app.use(security.headers);
app.use(express.urlencoded({ extended: true, limit: '20kb' }));
app.use(express.json({ limit: '20kb' }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Sessions + login gate: every page except Login and Register needs a signed-in,
// active user. Role checks per route are in routes/index.js.
app.use(loadUser);
app.use(requireLogin);
app.use(security.csrf);

app.use('/', routes);

app.use((req, res) => res.status(404).render('error', { title: 'Not found', message: 'Page not found.' }));

// Errors: log the details on the server, show the user a plain message (no stack trace,
// file paths or code are ever sent to the browser).
// Database errors are logged with their code (e.g. ECONNREFUSED, ER_DUP_ENTRY) but the user only
// sees "temporarily unavailable" (503) when MySQL cannot be reached, or the general message.
app.use((err, req, res, next) => {
  console.error(new Date().toISOString(), req.method, req.originalUrl, err.code || '', err.sqlMessage || err.message);
  if (res.headersSent) return next(err);
  const dbDown = db.isDown(err) || nosql.isDown(err);
  const status = dbDown ? 503 : (err.status || err.statusCode || 500);
  const message = dbDown ? 'The LPA database is not available at the moment. Please try again in a few minutes.'
    : (status === 400 ? 'The request could not be read.' : 'Sorry, something went wrong. Please try again.');
  if ((req.get('accept') || '').includes('application/json')) return res.status(status).json({ error: dbDown ? 'Database unavailable' : (status === 400 ? 'Bad request' : 'Something went wrong') });
  Object.assign(res.locals, { user: res.locals.user || null, role: res.locals.role || '', roleLabel: res.locals.roleLabel || '', cartCount: res.locals.cartCount || 0, csrfToken: res.locals.csrfToken || '' });
  res.status(status).render('error', { title: dbDown ? 'Service unavailable' : 'Error', message, bare: dbDown, hideNav: dbDown });
});

app.listen(PORT, async () => {
  console.log(`LPA eComms MVC app running at http://localhost:${PORT}`);
  try {
    const info = await db.check();
    console.log(`Database connected: ${info.db} on ${db.settings.host}:${db.settings.port} as ${info.who} (server ${info.version})`);
  } catch (err) {
    console.error(`\n*** Database NOT connected (${err.code || err.message}) - pages will show "Service unavailable".`);
    console.error('    Start MySQL/MariaDB (XAMPP -> MySQL -> Start) and run: npm run db:setup\n');
  }
  try {
    const info = await nosql.check();
    const trigger = await RatingTrigger.start();
    console.log(`MongoDB connected: ${info.db} on ${nosql.where()} as ${info.who} (server ${info.version}, TLS ${info.tls ? 'on' : 'off'}, replica set ${info.replicaSet || 'none'}, rating trigger: ${trigger})`);
  } catch (err) {
    console.error(`\n*** MongoDB NOT connected (${err.codeName || err.name}: ${err.message}) - sign-in will show "Service unavailable".`);
    console.error('    Start MongoDB (Windows: Services -> MongoDB Server) and run: npm run nosql:setup\n');
  }
});

module.exports = app;
