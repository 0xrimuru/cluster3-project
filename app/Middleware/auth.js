// Authentication + authorisation middleware.
// - Sessions: a random 32-byte token in an HttpOnly cookie maps to a server-side
//   session (user id + shopping cart). Nothing about the user is trusted from the cookie.
// - requireLogin: every page except the public ones needs a signed-in, active user.
// - requireRole: limits a route to certain user groups (administrator / user / customer).
const crypto = require('crypto');
const User = require('../Models/User');

const COOKIE = 'lpa_sid';
const sessions = new Map(); // token -> { userId, cart: [{ sku, qty }], created, csrf }
const PUBLIC = ['/login', '/register', '/privacy'];

function readCookie(req, name) {
  const part = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}

function startSession(res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, cart: [], created: Date.now(), csrf: crypto.randomBytes(24).toString('hex') });
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax`);
  return token;
}
function endSession(req, res) {
  sessions.delete(readCookie(req, COOKIE));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

// Loads the session (if any) and exposes the user to controllers and views.
// The user is read from lpa_users on every request, so a deactivated account is stopped at once.
async function loadUser(req, res, next) {
  const token = readCookie(req, COOKIE);
  const s = token && sessions.get(token);
  let user = null;
  try {
    user = s ? await User.find(s.userId) : null;
  } catch (err) {
    return next(err); // database not available -> error handler
  }
  if (s && user && user.status === 'active') {
    req.session = s;
    req.user = user;
  } else if (s) {
    sessions.delete(token); // user deleted or deactivated -> session ends
  }
  res.locals.user = req.user || null;
  res.locals.role = req.user ? req.user.group : '';
  res.locals.roleLabel = req.user ? User.label(req.user.group) : '';
  res.locals.cartCount = req.session ? req.session.cart.reduce((n, i) => n + i.qty, 0) : 0;
  res.locals.csrfToken = req.session ? req.session.csrf : '';
  next();
}

function requireLogin(req, res, next) {
  if (req.user || PUBLIC.includes(req.path)) return next();
  if ((req.get('accept') || '').includes('application/json') || req.path.startsWith('/api/')) return res.status(401).json({ error: 'Sign in required' });
  return res.redirect('/login');
}

// requireRole('administrator') or requireRole('administrator', 'user')
function requireRole(...groups) {
  return (req, res, next) => {
    if (req.user && groups.includes(req.user.group)) return next();
    if ((req.get('accept') || '').includes('application/json') || req.path.startsWith('/api/')) return res.status(403).json({ error: 'Not allowed for your user group' });
    // Customers who reach a staff page are sent to the shop; staff to the home page.
    return res.status(403).render('error', { title: 'Not allowed', message: 'Your account does not have access to this page.', nav: '' });
  };
}

const STAFF = ['administrator', 'user'];
module.exports = { loadUser, requireLogin, requireRole, startSession, endSession, STAFF, _sessions: sessions };
