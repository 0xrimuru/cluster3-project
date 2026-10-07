// SessionStore - login sessions and shopping carts in MongoDB (collection: sessions).
// The browser keeps a random 256-bit token in an HttpOnly cookie. MongoDB stores only the
// SHA-256 HASH of that token as _id, so a copy of the database cannot be used to sign in.
// Each session expires on its own: a TTL index deletes it at expiresAt
// (2 hours after the last request, and never later than 12 hours after sign-in).
// Because sessions are in the database, carts and sign-ins survive an app restart.
const crypto = require('crypto');
const { col, C } = require('../../../config/nosql');
const { encrypt, hashToken } = require('../../Security/crypto');

const IDLE_MS = 2 * 60 * 60 * 1000;
const MAX_MS = 12 * 60 * 60 * 1000;
const TOUCH_MS = 60 * 1000;          // update lastSeen at most once a minute (fewer writes)
const sessions = () => col(C.sessions, { writeConcern: { w: 1 } });
const expiry = (createdAt, now) => new Date(Math.min(now + IDLE_MS, createdAt.getTime() + MAX_MS));

class SessionStore {
  // insertOne - returns the token for the cookie (the token itself is not stored).
  static async create(user, { ip, agent } = {}) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    await (await sessions()).insertOne({
      _id: hashToken(token), userId: user.id, cart: [], csrf: crypto.randomBytes(24).toString('hex'),
      createdAt: now, lastSeen: now, expiresAt: expiry(now, now.getTime()),
      ipEnc: encrypt(ip || ''), agent: String(agent || '').slice(0, 200),
    });
    return token;
  }

  // findOne by key - null when unknown or expired (the TTL monitor deletes expired ones within ~60 s).
  static async load(token) {
    if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
    const now = Date.now();
    const s = await (await sessions()).findOne({ _id: hashToken(token), expiresAt: { $gt: new Date(now) } });
    if (s && now - s.lastSeen.getTime() > TOUCH_MS) {
      s.expiresAt = expiry(s.createdAt, now);
      s.lastSeen = new Date(now);
      await (await sessions()).updateOne({ _id: s._id }, { $set: { lastSeen: s.lastSeen, expiresAt: s.expiresAt } });
    }
    return s;
  }

  // updateOne - save the cart after it changes.
  static async saveCart(session) {
    if (!session) return;
    const cart = session.cart.map(i => ({ sku: String(i.sku), qty: Math.trunc(i.qty) }));
    await (await sessions()).updateOne({ _id: session._id }, { $set: { cart } });
  }

  // deleteOne - sign out.
  static async destroy(token) {
    if (token) await (await sessions()).deleteOne({ _id: hashToken(token) });
  }

  // deleteMany - sign a user out everywhere (deactivated, deleted, password changed).
  // keepId: the session to keep (the one that just changed its own password).
  static async destroyForUser(userId, keepId) {
    const filter = keepId ? { userId, _id: { $ne: keepId } } : { userId };
    const r = await (await sessions()).deleteMany(filter);
    return r.deletedCount;
  }
}

module.exports = SessionStore;
