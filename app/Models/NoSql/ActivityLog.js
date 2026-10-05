// ActivityLog - important events (sign-ins, failed sign-ins, registrations, orders, invoices,
// user changes, reviews) stored in MongoDB (collection: activity_log), like the LPA reference
// app's lpa_log(). Each event is a document; different event types can carry different details
// in `meta` (flexible schema). The IP address is personal information, so it is stored
// ENCRYPTED (AES-256-GCM). A TTL index deletes events after 365 days.
// If MongoDB is down, the event is written to logs/lpa.log instead, so nothing is lost.
const fs = require('fs');
const path = require('path');
const { col, C } = require('../../../config/nosql');
const { encrypt, decrypt } = require('../../Security/crypto');

const TYPES = ['LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'ORDER', 'INVOICE', 'USER', 'REVIEW', 'REVIEW_ALERT', 'STOCK', 'OTHER'];
const DIR = path.join(__dirname, '..', '..', '..', 'logs');
const FILE = path.join(DIR, 'lpa.log');
const events = () => col(C.activity, { writeConcern: { w: 1 } });

function typeOf(message) {
  if (/^LOGIN FAILED/.test(message)) return 'LOGIN_FAILED';
  const first = String(message).split(/\s/)[0];
  return TYPES.includes(first) ? first : 'OTHER';
}
const ipOf = req => (req && (req.ip || (req.socket && req.socket.remoteAddress))) || '';

function toFile(line) {
  try { fs.mkdirSync(DIR, { recursive: true }); fs.appendFileSync(FILE, line + '\n'); } catch (e) { console.error('Could not write activity log:', e.message); }
}

// insertOne. Returns a promise; callers do not have to wait for it.
function write(req, message, meta = {}) {
  let ipEnc = null;
  try { ipEnc = encrypt(ipOf(req)); } catch (e) { /* no DATA_KEY yet - store no IP */ }
  const doc = {
    at: new Date(),
    type: meta.type || typeOf(message),
    user: (req && req.user && req.user.username) || meta.user || null,
    message: String(message).slice(0, 500),
    ipEnc,
    meta: Object.assign({}, meta, { type: undefined, user: undefined }),
  };
  delete doc.meta.type; delete doc.meta.user;
  return events().then(c => c.insertOne(doc)).catch(err => {
    toFile(`${doc.at.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour12: false })} | ${ipOf(req) || '-'} | ${doc.message} | (MongoDB unavailable: ${err.name})`);
  });
}

// find with filters (each one uses an index: type_at, user_at or ttl_at), newest first.
async function list({ type, user, from, to, limit = 50 } = {}) {
  const filter = {};
  if (TYPES.includes(type)) filter.type = type;
  if (user) filter.user = String(user).toLowerCase();
  if (from || to) {
    filter.at = {};
    if (from) filter.at.$gte = new Date(from + 'T00:00:00+10:00');
    if (to) filter.at.$lt = new Date(new Date(to + 'T00:00:00+10:00').getTime() + 86400000);
  }
  const rows = await (await events()).find(filter).sort({ at: -1 }).limit(Math.min(Number(limit) || 50, 500)).toArray();
  return rows.map(r => ({ id: String(r._id), at: r.at, type: r.type, user: r.user, message: r.message, ip: safeDecrypt(r.ipEnc), meta: r.meta || {} }));
}
function safeDecrypt(v) { try { return decrypt(v) || ''; } catch (e) { return '(cannot decrypt)'; } }

// Counts per event type for the last N days (aggregation pipeline).
async function countsByType(days = 7) {
  const since = new Date(Date.now() - days * 86400000);
  const rows = await (await events()).aggregate([
    { $match: { at: { $gte: since } } },
    { $group: { _id: '$type', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]).toArray();
  return rows.map(r => ({ type: r._id, n: r.n }));
}

module.exports = { write, list, countsByType, TYPES, FILE };
