// Injection guard for request data (ICTPRG537).
// MongoDB treats keys that start with "$" as query operators, so JSON like
//   { "username": { "$ne": "" } }
// could turn "find this user" into "find anyone" (NoSQL injection). Keys such as "__proto__" can
// change JavaScript objects for the whole app (prototype pollution). This middleware refuses any
// request whose body or query contains such keys, and logs it as a SECURITY event.
// (SQL injection is prevented separately: every SQL statement uses ? placeholders.)
const Log = require('../Models/NoSql/ActivityLog');
const { wantsJson } = require('./respond');

const BAD_KEY = k => k.startsWith('$') || ['__proto__', 'constructor', 'prototype'].includes(k);

function findBadKey(value, depth = 0) {
  if (depth > 20) return '(too deeply nested)';
  if (Array.isArray(value)) {
    for (const v of value) { const bad = findBadKey(v, depth + 1); if (bad) return bad; }
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      if (BAD_KEY(k)) return k;
      const bad = findBadKey(value[k], depth + 1);
      if (bad) return bad;
    }
  }
  return null;
}

function rejectOperators(req, res, next) {
  const bad = findBadKey(req.body) || findBadKey(req.query);
  if (!bad) return next();
  Log.write(req, `SECURITY blocked ${req.method} ${req.path.slice(0, 80)}: suspicious key "${String(bad).slice(0, 30)}" (possible injection)`, { type: 'SECURITY', key: String(bad).slice(0, 30) });
  if (wantsJson(req)) return res.status(400).json({ error: 'Bad request' });
  return res.status(400).render('error', { title: 'Bad request', message: 'The request contained data that is not allowed.' });
}

module.exports = { rejectOperators };
