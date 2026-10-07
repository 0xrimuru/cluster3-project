// app/Security/loginGuard.js - stops password guessing (brute force) on the login page.
// Each failed sign-in is stored in MongoDB (login_attempts) twice: once for the user name and
// once for the (hashed) IP address. A TTL index deletes attempts after 15 minutes.
//   5 failures for one user name in 15 min  -> that user name is locked for the rest of the window
//  20 failures from one IP address in 15 min -> that address is locked
// The message is the same whether or not the user name exists (no user enumeration).
const { col } = require('../../config/nosql');
const { hashToken } = require('./crypto');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_USER = 5;
const MAX_PER_IP = 20;
const attempts = () => col('login_attempts', { writeConcern: { w: 1 } });
const keys = (username, ip) => ({ user: 'user:' + String(username || '').trim().toLowerCase().slice(0, 30), ip: 'ip:' + hashToken(ip || '-').slice(0, 32) });

// Returns { locked: false } or { locked: true, minutes } (minutes until the oldest counted attempt expires).
async function check(username, ip) {
  const k = keys(username, ip);
  const since = new Date(Date.now() - WINDOW_MS);
  const c = await attempts();
  for (const [key, max] of [[k.user, MAX_PER_USER], [k.ip, MAX_PER_IP]]) {
    const recent = await c.find({ key, at: { $gt: since } }).sort({ at: -1 }).limit(max).toArray();
    if (recent.length >= max) {
      const freeAt = recent[max - 1].at.getTime() + WINDOW_MS;
      return { locked: true, minutes: Math.max(1, Math.ceil((freeAt - Date.now()) / 60000)), by: key === k.user ? 'user' : 'ip' };
    }
  }
  return { locked: false };
}

async function fail(username, ip) {
  const k = keys(username, ip);
  const at = new Date();
  await (await attempts()).insertMany([{ key: k.user, at }, { key: k.ip, at }]);
}

// A good sign-in clears that user name's failures.
async function success(username) {
  await (await attempts()).deleteMany({ key: keys(username).user });
}

module.exports = { check, fail, success, WINDOW_MS, MAX_PER_USER, MAX_PER_IP };
