// AuthController - User Login, Logout and customer Registration.
// Credentials are checked against the User model (scrypt password hashes); a random
// server-side session is started on success. Every attempt is written to the activity log.
const User = require('../Models/User');
const Client = require('../Models/Client');
const Log = require('../Models/ActivityLog');
const { startSession, endSession } = require('../Middleware/auth');

const MESSAGES = {
  1: 'Please enter a username and password.',
  2: 'Login failed: wrong username or password, or the account is inactive.',
};

exports.loginForm = (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('login', {
    title: 'User Login', bare: true, hideNav: true,
    error: MESSAGES[req.query.error] || '',
    notice: req.query.registered === '1' ? 'Account created - you can now sign in.' : '',
    username: req.query.u || '',
  });
};

exports.login = (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username || !password) return res.redirect('/login?error=1');
  const user = User.authenticate(username, password);
  if (!user) {
    Log.write(req, `LOGIN FAILED for user "${username.slice(0, 30)}"`);
    return res.redirect('/login?error=2&u=' + encodeURIComponent(username.slice(0, 30)));
  }
  startSession(res, user);
  Log.write(req, `LOGIN ${user.username} (${user.group})`);
  return res.redirect(user.group === 'customer' ? '/shop' : '/');
};

// The signed-in user's full name (used by the stock audit history).
exports.currentUser = (req) => (req.user ? User.fullName(req.user) : 'Unknown user');

exports.logout = (req, res) => {
  if (req.user) Log.write(req, `LOGOUT ${req.user.username}`);
  endSession(req, res);
  res.redirect('/login');
};

// ---- Customer registration (web store) ----
exports.registerForm = (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('register', { title: 'Create an account', bare: true, hideNav: true, errors: [], form: {} });
};

exports.register = (req, res) => {
  const form = {
    firstName: String(req.body.firstName || '').trim(),
    lastName: String(req.body.lastName || '').trim(),
    address: String(req.body.address || '').trim(),
    phone: String(req.body.phone || '').trim(),
    username: String(req.body.username || '').trim().toLowerCase(),
    password: String(req.body.password || ''),
    confirmPassword: String(req.body.confirmPassword || ''),
  };
  const errors = User.validate(form, { isNew: true });
  if (!form.address) errors.push('Address is required (it is used for delivery and invoices).');
  if (!/^[0-9 ()+-]{8,20}$/.test(form.phone)) errors.push('Enter a valid phone number (8-20 digits, spaces, brackets, + or -).');
  if (errors.length) {
    delete form.password; delete form.confirmPassword;
    return res.status(400).render('register', { title: 'Create an account', bare: true, hideNav: true, errors, form });
  }
  const client = Client.create(form);
  const user = User.create(Object.assign({}, form, { group: 'customer', clientId: client.code }));
  Log.write(req, `REGISTER ${user.username} -> client ${client.code}`);
  res.redirect('/login?registered=1&u=' + encodeURIComponent(user.username));
};
