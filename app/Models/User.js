// User model - lpa_users equivalent. Staff, administrators and registered customers.
// Passwords are never stored in plain text: each one is hashed with scrypt and a
// random salt (Node's built-in crypto). The security block (ICTPRG537) builds on this.
const crypto = require('crypto');

const GROUPS = ['administrator', 'user', 'customer'];
const LABEL = { administrator: 'Administrator', user: 'Staff', customer: 'Customer' };

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(plain), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(plain, stored) {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const test = crypto.scryptSync(String(plain), salt, 64);
  const known = Buffer.from(hash, 'hex');
  return known.length === test.length && crypto.timingSafeEqual(known, test);
}

// Seed accounts (demo password for all: Lpa#2026)
let users = [
  { id: 'U-001', username: 'palvim', firstName: 'Pedro',   lastName: 'Alvim',  group: 'administrator', status: 'active' },
  { id: 'U-002', username: 'mchang', firstName: 'Michael', lastName: 'Chang',  group: 'user',          status: 'active' },
  { id: 'U-003', username: 'aturner', firstName: 'Alex',   lastName: 'Turner', group: 'customer',      status: 'active', clientId: 'CL-006' },
].map(u => Object.assign(u, { passwordHash: hashPassword('Lpa#2026') }));
let nextNum = 4;

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
// Password rule: at least 8 characters with a letter and a number.
function passwordProblem(p) {
  if (!p || p.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Password must contain a letter and a number.';
  return null;
}

class User {
  static get GROUPS() { return GROUPS; }
  static label(group) { return LABEL[group] || group; }
  static all() { return users.filter(u => u.status !== 'deleted'); }
  static find(id) { return users.find(u => u.id === id && u.status !== 'deleted'); }
  static findByUsername(name) {
    const n = String(name || '').trim().toLowerCase();
    return users.find(u => u.username === n && u.status !== 'deleted');
  }
  static fullName(u) { return u ? `${u.firstName} ${u.lastName}` : ''; }

  static search(q) {
    const list = User.all();
    if (!q) return list;
    const s = q.trim().toLowerCase();
    return list.filter(u => [u.id, u.username, u.firstName, u.lastName, u.group].join(' ').toLowerCase().includes(s));
  }

  // Returns the user when the credentials are right and the account is active.
  static authenticate(username, password) {
    const u = User.findByUsername(username);
    if (!u || u.status !== 'active') return null;
    return verifyPassword(password, u.passwordHash) ? u : null;
  }

  // Validate input for create (isNew) or update. Returns a list of messages.
  static validate(data, { isNew, selfId } = {}) {
    const errors = [];
    const username = String(data.username || '').trim().toLowerCase();
    if (!USERNAME_RE.test(username)) errors.push('User name must be 3-30 characters: lower-case letters, numbers, dot, dash or underscore.');
    const clash = User.findByUsername(username);
    if (clash && clash.id !== selfId) errors.push('That user name is already taken.');
    if (!String(data.firstName || '').trim()) errors.push('First name is required.');
    if (!String(data.lastName || '').trim()) errors.push('Last name is required.');
    if (data.group !== undefined && !GROUPS.includes(data.group)) errors.push('Choose a valid user group.');
    if (isNew || data.password) {
      const p = passwordProblem(data.password);
      if (p) errors.push(p);
      if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) errors.push('Password and confirm password must match.');
    }
    return errors;
  }

  static create(data) {
    const u = {
      id: 'U-' + String(nextNum++).padStart(3, '0'),
      username: String(data.username).trim().toLowerCase(),
      firstName: String(data.firstName).trim(),
      lastName: String(data.lastName).trim(),
      group: GROUPS.includes(data.group) ? data.group : 'customer',
      status: data.status === 'inactive' ? 'inactive' : 'active',
      clientId: data.clientId,
      passwordHash: hashPassword(data.password),
    };
    users.push(u);
    return u;
  }

  static update(id, data) {
    const u = User.find(id);
    if (!u) return null;
    if (data.username) u.username = String(data.username).trim().toLowerCase();
    if (data.firstName !== undefined) u.firstName = String(data.firstName).trim();
    if (data.lastName !== undefined) u.lastName = String(data.lastName).trim();
    if (GROUPS.includes(data.group)) u.group = data.group;
    if (data.status) u.status = data.status === 'inactive' ? 'inactive' : 'active';
    if (data.password) u.passwordHash = hashPassword(data.password); // blank = keep current password
    return u;
  }

  // Soft delete: the record stays for the audit trail but can no longer sign in.
  static remove(id) {
    const u = User.find(id);
    if (!u) return false;
    u.status = 'deleted';
    return true;
  }
}

module.exports = User;
