// UserController - Users Management (administrators only): search, add, edit, delete.
// Matches the LPA Developer UI Guide: User ID, Username, First/Last name, Group, Status.
const User = require('../Models/User');
const Log = require('../Models/ActivityLog');

const base = { pageName: 'Users', nav: 'more' };
const pick = b => ({
  username: String(b.username || '').trim().toLowerCase(),
  firstName: String(b.firstName || '').trim(),
  lastName: String(b.lastName || '').trim(),
  group: String(b.group || ''),
  status: b.status === 'inactive' ? 'inactive' : 'active',
  password: String(b.password || ''),
});

// GET /users
exports.index = (req, res) => {
  const q = String(req.query.q || '');
  res.render('users/index', Object.assign({ title: 'Users management', users: User.search(q), q, label: User.label,
    notice: req.query.saved ? `User ${req.query.saved} saved.` : (req.query.deleted ? `User ${req.query.deleted} deleted.` : ''),
    error: req.query.error || '' }, base));
};

// GET /users/new
exports.newForm = (req, res) =>
  res.render('users/form', Object.assign({ title: 'Add user', mode: 'Add', form: { group: 'user', status: 'active' }, errors: [], groups: User.GROUPS, label: User.label }, base));

// POST /users
exports.create = (req, res) => {
  const form = pick(req.body);
  const errors = User.validate(form, { isNew: true });
  if (errors.length) { delete form.password; return res.status(400).render('users/form', Object.assign({ title: 'Add user', mode: 'Add', form, errors, groups: User.GROUPS, label: User.label }, base)); }
  const u = User.create(form);
  Log.write(req, `USER ${u.username} (${u.group}) added by ${req.user.username}`);
  res.redirect('/users?saved=' + u.id);
};

// GET /users/:id/edit
exports.editForm = (req, res) => {
  const u = User.find(req.params.id);
  if (!u) return res.status(404).render('error', { title: 'Not found', message: 'User not found.', nav: 'more' });
  res.render('users/form', Object.assign({ title: 'Edit user', mode: 'Edit', form: Object.assign({}, u, { password: '' }), errors: [], groups: User.GROUPS, label: User.label }, base));
};

// PUT /users/:id  (blank password = keep the current one)
exports.update = (req, res) => {
  const u = User.find(req.params.id);
  if (!u) return res.status(404).render('error', { title: 'Not found', message: 'User not found.', nav: 'more' });
  const form = pick(req.body);
  const errors = User.validate(form, { isNew: false, selfId: u.id });
  if (u.id === req.user.id && (form.group !== 'administrator' || form.status !== 'active')) errors.push('You cannot remove your own administrator access or deactivate yourself.');
  if (errors.length) { form.id = u.id; delete form.password; return res.status(400).render('users/form', Object.assign({ title: 'Edit user', mode: 'Edit', form, errors, groups: User.GROUPS, label: User.label }, base)); }
  User.update(u.id, form);
  Log.write(req, `USER ${u.username} updated by ${req.user.username}${form.password ? ' (password changed)' : ''}`);
  res.redirect('/users?saved=' + u.id);
};

// DELETE /users/:id
exports.destroy = (req, res) => {
  const u = User.find(req.params.id);
  if (!u) return res.status(404).render('error', { title: 'Not found', message: 'User not found.', nav: 'more' });
  if (u.id === req.user.id) return res.redirect('/users?error=' + encodeURIComponent('You cannot delete your own account.'));
  User.remove(u.id);
  Log.write(req, `USER ${u.username} deleted by ${req.user.username}`);
  res.redirect('/users?deleted=' + u.id);
};
