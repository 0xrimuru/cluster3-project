// UserController - Users Management (administrators only): search, add, edit, delete.
// Matches the LPA Developer UI Guide: User ID, Username, First/Last name, Group, Status.
// Reads and writes the lpa_users table through the User model.
const User = require('../Models/User');
const Log = require('../Models/NoSql/ActivityLog');
const SessionStore = require('../Models/NoSql/SessionStore');
const { notFound } = require('../Middleware/respond');

const base = { pageName: 'Users', nav: 'more' };
const pick = b => ({
  username: String(b.username || '').trim().toLowerCase(),
  firstName: String(b.firstName || '').trim(),
  lastName: String(b.lastName || '').trim(),
  group: String(b.group || ''),
  status: b.status === 'inactive' ? 'inactive' : 'active',
  password: String(b.password || ''),
});
// A customer login needs a client record (delivery address, invoices) - those are made with Register.
const NEEDS_CLIENT = 'Customer accounts are created with Register on the sign-in page (they need a client record).';

// GET /users
exports.index = async (req, res) => {
  const q = String(req.query.q || '');
  res.render('users/index', Object.assign({ title: 'Users management', users: await User.search(q), q, label: User.label,
    notice: req.query.saved ? `User ${req.query.saved} saved.` : (req.query.deleted ? `User ${req.query.deleted} deleted.` : ''),
    error: req.query.error || '' }, base));
};

// GET /users/new
exports.newForm = (req, res) =>
  res.render('users/form', Object.assign({ title: 'Add user', mode: 'Add', form: { group: 'user', status: 'active' }, errors: [], groups: User.GROUPS, label: User.label }, base));

// POST /users
exports.create = async (req, res) => {
  const form = pick(req.body);
  const errors = await User.validate(form, { isNew: true });
  if (form.group === 'customer') errors.push(NEEDS_CLIENT);
  if (errors.length) { delete form.password; return res.status(400).render('users/form', Object.assign({ title: 'Add user', mode: 'Add', form, errors, groups: User.GROUPS, label: User.label }, base)); }
  const u = await User.create(form);
  Log.write(req, `USER ${u.username} (${u.group}) added by ${req.user.username}`);
  res.redirect('/users?saved=' + u.id);
};

// GET /users/:id/edit
exports.editForm = async (req, res) => {
  const u = await User.find(req.params.id);
  if (!u) return notFound(req, res, 'User not found.', 'more');
  res.render('users/form', Object.assign({ title: 'Edit user', mode: 'Edit', form: Object.assign({}, u, { password: '' }), errors: [], groups: User.GROUPS, label: User.label }, base));
};

// PUT /users/:id  (blank password = keep the current one)
exports.update = async (req, res) => {
  const u = await User.find(req.params.id);
  if (!u) return notFound(req, res, 'User not found.', 'more');
  const form = pick(req.body);
  const errors = await User.validate(form, { isNew: false, selfId: u.id });
  if (form.group === 'customer' && !u.clientId) errors.push(NEEDS_CLIENT);
  if (u.id === req.user.id && (form.group !== 'administrator' || form.status !== 'active')) errors.push('You cannot remove your own administrator access or deactivate yourself.');
  if (errors.length) { form.id = u.id; delete form.password; return res.status(400).render('users/form', Object.assign({ title: 'Edit user', mode: 'Edit', form, errors, groups: User.GROUPS, label: User.label }, base)); }
  await User.update(u.id, form);
  // deactivated or new password -> sign that user out everywhere (deleteMany on sessions)
  if (u.id !== req.user.id && (form.status === 'inactive' || form.password)) await SessionStore.destroyForUser(u.id);
  Log.write(req, `USER ${u.username} updated by ${req.user.username}${form.password ? ' (password changed)' : ''}`);
  res.redirect('/users?saved=' + u.id);
};

// DELETE /users/:id
exports.destroy = async (req, res) => {
  const u = await User.find(req.params.id);
  if (!u) return notFound(req, res, 'User not found.', 'more');
  if (u.id === req.user.id) return res.redirect('/users?error=' + encodeURIComponent('You cannot delete your own account.'));
  await User.remove(u.id);
  await SessionStore.destroyForUser(u.id);
  Log.write(req, `USER ${u.username} deleted by ${req.user.username}`);
  res.redirect('/users?deleted=' + u.id);
};
