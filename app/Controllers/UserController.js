// UserController - Users Management (administrators only): search, add, edit, delete.
// Matches the LPA Developer UI Guide: User ID, Username, First/Last name, Group, Status.
// Reads and writes the lpa_users table through the User model.
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
  if (errors.length) { delete form.password; return res.status(400).render('users/form', Object.assign({ title: 'Add user', mode: 'Add', form, errors, groups: User.GROUPS, label: User.label }, base)); }
  const u = await User.create(form);
  Log.write(req, `USER ${u.username} (${u.group}) added by ${req.user.username}`);
  res.redirect('/users?saved=' + u.id);
};

// GET /users/:id/edit
exports.editForm = async (req, res) => {
  const u = await User.find(req.params.id);
  if (!u) return res.status(404).render('error', { title: 'Not found', message: 'User not found.', nav: 'more' });
  res.render('users/form', Object.assign({ title: 'Edit user', mode: 'Edit', form: Object.assign({}, u, { password: '' }), errors: [], groups: User.GROUPS, label: User.label }, base));
};

// PUT /users/:id  (blank password = keep the current one)
exports.update = async (req, res) => {
  const u = await User.find(req.params.id);
  if (!u) return res.status(404).render('error', { title: 'Not found', message: 'User not found.', nav: 'more' });
  const form = pick(req.body);
  const errors = await User.validate(form, { isNew: false, selfId: u.id });
  if (u.id === req.user.id && (form.group !== 'administrator' || form.status !== 'active')) errors.push('You cannot remove your own administrator access or deactivate yourself.');
  if (errors.length) { form.id = u.id; delete form.password; return res.status(400).render('users/form', Object.assign({ title: 'Edit user', mode: 'Edit', form, errors, groups: User.GROUPS, label: User.label }, base)); }
  await User.update(u.id, form);
  Log.write(req, `USER ${u.username} updated by ${req.user.username}${form.password ? ' (password changed)' : ''}`);
  res.redirect('/users?saved=' + u.id);
};

// DELETE /users/:id
exports.destroy = async (req, res) => {
  const u = await User.find(req.params.id);
  if (!u) return res.status(404).render('error', { title: 'Not found', message: 'User not found.', nav: 'more' });
  if (u.id === req.user.id) return res.redirect('/users?error=' + encodeURIComponent('You cannot delete your own account.'));
  await User.remove(u.id);
  Log.write(req, `USER ${u.username} deleted by ${req.user.username}`);
  res.redirect('/users?deleted=' + u.id);
};
