// SecurityController - change your own password, and the Security page (administrators):
// the access policy matrix and the live status of every protection in the app.
const User = require('../Models/User');
const SessionStore = require('../Models/NoSql/SessionStore');
const Log = require('../Models/NoSql/ActivityLog');
const policy = require('../Security/policy');
const sandbox = require('../Security/sandbox');
const LoginGuard = require('../Security/loginGuard');
const db = require('../../config/database');
const nosql = require('../../config/nosql');
const { wantsJson } = require('../Middleware/respond');

const base = { pageName: 'Security', nav: 'more' };

// GET /account/password
exports.passwordForm = (req, res) =>
  res.render('account/password', Object.assign({ title: 'Change password', errors: [], done: req.query.done === '1' }, base));

// PUT /account/password - needs the current password; signs out the user's OTHER sessions
exports.changePassword = async (req, res) => {
  const current = String(req.body.currentPassword || '');
  const next = String(req.body.newPassword || '');
  const confirm = String(req.body.confirmPassword || '');
  const errors = [];
  if (!(await User.checkPassword(req.user.id, current))) errors.push('Your current password is not correct.');
  const problem = User.passwordProblem(next, req.user.username);
  if (problem) errors.push(problem);
  if (next !== confirm) errors.push('New password and confirm password must match.');
  if (!problem && next === current) errors.push('The new password must be different from the current one.');
  if (errors.length) {
    Log.write(req, `PASSWORD change refused for ${req.user.username}`, { type: 'PASSWORD' });
    return res.status(400).render('account/password', Object.assign({ title: 'Change password', errors, done: false }, base));
  }
  await User.setPassword(req.user.id, next);
  const ended = await SessionStore.destroyForUser(req.user.id, req.session._id);
  Log.write(req, `PASSWORD changed by ${req.user.username} (${ended} other session${ended === 1 ? '' : 's'} signed out)`, { type: 'PASSWORD' });
  res.redirect('/account/password?done=1');
};

// GET /security - access policy + protection status
exports.index = async (req, res) => {
  const [mysqlInfo, mongoInfo, events] = await Promise.all([
    (async () => {
      const who = (await db.query('SELECT CURRENT_USER() AS u'))[0].u;
      const grants = (await db.query('SHOW GRANTS')).map(g => Object.values(g)[0].replace(/IDENTIFIED BY PASSWORD '[^']*'/, "IDENTIFIED BY PASSWORD '***'"));
      return { who, grants };
    })().catch(e => ({ error: e.code || e.message })),
    nosql.check().catch(e => ({ error: e.codeName || e.name })),
    Log.list({ types: ['LOGIN_FAILED', 'LOGIN_LOCKED', 'ACCESS_DENIED', 'PASSWORD'], limit: 15 }),
  ]);
  const status = {
    sandbox: sandbox.status(),
    https: !!req.app.locals.https,
    mysql: mysqlInfo,
    mongo: mongoInfo,
    lockout: { maxPerUser: LoginGuard.MAX_PER_USER, maxPerIp: LoginGuard.MAX_PER_IP, minutes: LoginGuard.WINDOW_MS / 60000 },
    encryption: [
      { what: 'Passwords (lpa_users.lpa_user_password)', how: 'scrypt hash with a random salt per password (one-way)' },
      { what: 'Client phone numbers (lpa_clients.lpa_client_phone)', how: 'AES-256-GCM encrypted; HMAC-SHA256 blind index for exact search' },
      { what: 'IP addresses in the activity log (MongoDB)', how: 'AES-256-GCM encrypted' },
      { what: 'Session tokens (MongoDB sessions)', how: 'only the SHA-256 hash is stored' },
      { what: 'Connection to MongoDB', how: mongoInfo.tls ? 'TLS (encrypted in transit)' : 'not encrypted (same computer only)' },
      { what: 'Browser to web app', how: req.app.locals.https ? 'HTTPS (TLS) + HSTS, Secure cookie' : 'HTTP (development) - run npm run security:cert for HTTPS' },
    ],
  };
  if (wantsJson(req)) return res.json({ policy: policy.matrix(), status, events });
  res.render('security/index', Object.assign({ title: 'Security', matrix: policy.matrix(), status, events }, base));
};
