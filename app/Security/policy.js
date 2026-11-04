// app/Security/policy.js - policy-based access control (ICTPRG537).
// The rules live in config/security-policy.json (data, not code): permission -> user groups.
// Routes ask for a permission with authorize('stock.manage'); views ask with can('...').
// Deny by default: an unknown permission or an unlisted group is refused. Every refusal is
// written to the activity log as ACCESS_DENIED.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'config', 'security-policy.json');

// Load and CHECK the policy once at start-up - a broken policy stops the app instead of
// silently letting people in.
function load() {
  const p = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const roles = Object.keys(p.roles || {});
  if (p.defaultDecision !== 'deny') throw new Error('security-policy.json: defaultDecision must be "deny"');
  for (const [name, rule] of Object.entries(p.permissions || {})) {
    if (!/^[a-z]+\.[a-z_]+$/.test(name)) throw new Error(`security-policy.json: bad permission name "${name}"`);
    if (!Array.isArray(rule.roles) || !rule.roles.length) throw new Error(`security-policy.json: "${name}" has no roles`);
    const unknown = rule.roles.filter(r => !roles.includes(r));
    if (unknown.length) throw new Error(`security-policy.json: "${name}" names unknown role(s) ${unknown.join(', ')}`);
  }
  return Object.freeze(p);
}
const POLICY = load();

// Is this user allowed this permission? (false for unknown permissions or signed-out users)
function can(user, permission) {
  const rule = POLICY.permissions[permission];
  return !!(user && user.status === 'active' && rule && rule.roles.includes(user.group));
}

const { wantsJson } = require('../Middleware/respond');

function deny(req, res, permission) {
  require('../Models/NoSql/ActivityLog').write(req, `ACCESS_DENIED ${req.method} ${req.originalUrl.slice(0, 120)} needs ${permission}`, { type: 'ACCESS_DENIED', permission, group: req.user ? req.user.group : null });
  if (wantsJson(req)) return res.status(403).json({ error: 'Not allowed for your user group' });
  return res.status(403).render('error', { title: 'Not allowed', message: 'Your account does not have access to this page.', nav: '' });
}

// Route middleware: authorize('sales.create') - all listed permissions are needed.
function authorize(...permissions) {
  permissions.forEach(p => { if (!POLICY.permissions[p]) throw new Error(`Route asks for unknown permission "${p}"`); });
  return function authorizeMiddleware(req, res, next) {
    const missing = permissions.find(p => !can(req.user, p));
    return missing ? deny(req, res, missing) : next();
  };
}

// Ownership rules (resource-based) on top of the permissions.
const owns = {
  review: (user, review) => !!(user && review && review.authorUserId === user.id),
  order: (user, invoice) => !!(user && invoice && user.clientId && invoice.clientId === user.clientId),
};
function canEditReview(user, review) { return can(user, 'reviews.write') && owns.review(user, review); }
function canDeleteReview(user, review) { return can(user, 'reviews.delete_any') || canEditReview(user, review); }
function canViewOrder(user, invoice) { return can(user, 'orders.own') && owns.order(user, invoice); }

// Gives every view can('permission') for showing / hiding buttons.
function locals(req, res, next) {
  res.locals.can = permission => can(req.user, permission);
  next();
}

// For the Security page: rows = permissions, columns = groups.
function matrix() {
  const groups = Object.keys(POLICY.roles);
  return { groups, roles: POLICY.roles, rows: Object.entries(POLICY.permissions).map(([name, r]) => ({ name, description: r.description, allowed: groups.map(g => r.roles.includes(g)) })), version: POLICY.version, updated: POLICY.updated };
}

module.exports = { can, authorize, locals, matrix, canEditReview, canDeleteReview, canViewOrder, POLICY };
