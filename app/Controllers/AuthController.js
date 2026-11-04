// AuthController - User Login, Logout and customer Registration.
// Credentials are checked against the User model (scrypt password hashes); a random
// server-side session is started on success. Every attempt is written to the activity log.
const User = require('../Models/User');
const Client = require('../Models/Client');
const Log = require('../Models/NoSql/ActivityLog');
const { startSession, endSession } = require('../Middleware/auth');
const { transaction } = require('../../config/database');
const LoginGuard = require('../Security/loginGuard');

const MESSAGES = {
  1: 'Please enter a username and password.',
  2: 'Login failed: wrong username or password, or the account is inactive.',
  3: 'Too many failed sign-ins. Wait a few minutes and try again.',
};

exports.loginForm = (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('login', {
    title: 'User Login', bare: true, hideNav: true,
    error: req.query.error === '3' && /^\d{1,2}$/.test(req.query.m || '') ? `Too many failed sign-ins. Try again in ${req.query.m} minute${req.query.m === '1' ? '' : 's'}.` : (MESSAGES[req.query.error] || ''),
    notice: req.query.registered === '1' ? 'Account created - you can now sign in.' : '',
    username: req.query.u || '',
  });
};

exports.login = async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username || !password) return res.redirect('/login?error=1');
  // brute-force protection: refuse (without checking the password) while locked
  const lock = await LoginGuard.check(username, req.ip);
  if (lock.locked) {
    Log.write(req, `LOGIN LOCKED for user "${username.slice(0, 30)}" (${lock.by === 'ip' ? 'too many attempts from this address' : 'too many attempts for this user name'})`, { user: username.slice(0, 30).toLowerCase() });
    return res.redirect(`/login?error=3&m=${lock.minutes}&u=` + encodeURIComponent(username.slice(0, 30)));
  }
  const user = await User.authenticate(username, password);
  if (!user) {
    await LoginGuard.fail(username, req.ip);
    Log.write(req, `LOGIN FAILED for user "${username.slice(0, 30)}"`, { user: username.slice(0, 30).toLowerCase() });
    return res.redirect('/login?error=2&u=' + encodeURIComponent(username.slice(0, 30)));
  }
  await LoginGuard.success(username);
  await startSession(req, res, user);
  Log.write(req, `LOGIN ${user.username} (${user.group})`, { user: user.username });
  return res.redirect(user.group === 'customer' ? '/shop' : '/');
};

exports.logout = async (req, res) => {
  if (req.user) Log.write(req, `LOGOUT ${req.user.username}`);
  await endSession(req, res);
  res.redirect('/login');
};

// ---- Customer registration (web store) ----
exports.registerForm = (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('register', { title: 'Create an account', bare: true, hideNav: true, errors: [], form: {} });
};

exports.register = async (req, res) => {
  const form = {
    firstName: String(req.body.firstName || '').trim(),
    lastName: String(req.body.lastName || '').trim(),
    address: String(req.body.address || '').trim(),
    phone: String(req.body.phone || '').trim(),
    username: String(req.body.username || '').trim().toLowerCase(),
    password: String(req.body.password || ''),
    confirmPassword: String(req.body.confirmPassword || ''),
    privacy: req.body.privacy === 'yes',
  };
  const errors = await User.validate(form, { isNew: true });
  errors.push(...Client.contactErrors(form));
  if (!form.privacy) errors.push('Please confirm you have read the privacy notice.');
  if (errors.length) {
    delete form.password; delete form.confirmPassword;
    return res.status(400).render('register', { title: 'Create an account', bare: true, hideNav: true, errors, form });
  }
  // The client record and the login are saved together (one transaction) - never one without the other.
  const { client, user } = await transaction(async conn => {
    const c = await Client.create(form, conn);
    const u = await User.create(Object.assign({}, form, { group: 'customer', clientId: c.code }), conn);
    return { client: c, user: u };
  });
  Log.write(req, `REGISTER ${user.username} -> client ${client.code}`, { user: user.username, clientId: client.code });
  res.redirect('/login?registered=1&u=' + encodeURIComponent(user.username));
};
