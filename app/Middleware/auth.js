// Authentication + authorisation middleware.
// - Sessions: a random 32-byte token in an HttpOnly cookie. The session itself (user id, cart,
//   CSRF token) is stored in MongoDB by SessionStore - only the token's hash is saved there.
//   Nothing about the user is trusted from the cookie.
// - requireLogin: every page except the public ones needs a signed-in, active user.
// - requireRole: limits a route to certain user groups (administrator / user / customer).
const User = require('../Models/User');
const SessionStore = require('../Models/NoSql/SessionStore');

const COOKIE = 'lpa_sid';
const PUBLIC = ['/login', '/register', '/privacy'];

function readCookie(req, name) {
  const part = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(name + '='));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}

async function startSession(req, res, user) {
  const token = await SessionStore.create(user, { ip: req.ip, agent: req.get('user-agent') });
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax`);
  return token;
}
async function endSession(req, res) {
  await SessionStore.destroy(readCookie(req, COOKIE));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
}

// Loads the session (MongoDB) and the user (MySQL) and exposes them to controllers and views.
// The user is read on every request, so a deactivated account is stopped at once.
async function loadUser(req, res, next) {
  try {
    const token = readCookie(req, COOKIE);
    const s = token ? await SessionStore.load(token) : null;
    const user = s ? await User.find(s.userId) : null;
    if (s && user && user.status === 'active') {
      req.session = s;
      req.user = user;
    } else if (s) {
      await SessionStore.destroy(token); // user deleted or deactivated -> session ends
    }
  } catch (err) {
    return next(err); // a database is not available -> error handler (503 page)
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
    return res.status(403).render('error', { title: 'Not allowed', message: 'Your account does not have access to this page.', nav: '' });
  };
}

const STAFF = ['administrator', 'user'];
module.exports = { loadUser, requireLogin, requireRole, startSession, endSession, STAFF };
