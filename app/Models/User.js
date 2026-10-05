// User model - staff, administrators and registered customers, stored in lpa_users (MySQL).
// Passwords are never stored in plain text: each one is hashed with scrypt and a random
// salt (Node's built-in crypto) and only the hash goes into lpa_user_password.
// Status: a = active, d = inactive, x = deleted (soft delete, kept for the audit trail).
const crypto = require('crypto');
const { query } = require('../../config/database');

const GROUPS = ['administrator', 'user', 'customer'];
const LABEL = { administrator: 'Administrator', user: 'Staff', customer: 'Customer' };
const STATUS_FROM_DB = { a: 'active', d: 'inactive', x: 'deleted' };

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

const COLUMNS = `lpa_user_ID AS id, lpa_user_username AS username, lpa_user_firstname AS firstName,
  lpa_user_lastname AS lastName, lpa_user_group AS \`group\`, lpa_user_client_ID AS clientId, lpa_user_status AS status`;
const toUser = r => (r ? Object.assign(r, { status: STATUS_FROM_DB[r.status] || 'active' }) : null);
const like = s => '%' + String(s).replace(/[\\%_]/g, c => '\\' + c) + '%';

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
  static fullName(u) { return u ? `${u.firstName} ${u.lastName}` : ''; }

  static async all() { return (await query(`SELECT ${COLUMNS} FROM lpa_users WHERE lpa_user_status <> 'x' ORDER BY lpa_user_ID`)).map(toUser); }

  static async find(id) {
    const rows = await query(`SELECT ${COLUMNS} FROM lpa_users WHERE lpa_user_ID = ? AND lpa_user_status <> 'x'`, [String(id || '')]);
    return toUser(rows[0]);
  }
  static async findByUsername(name, conn) {
    const rows = await query(`SELECT ${COLUMNS} FROM lpa_users WHERE lpa_user_username = ? AND lpa_user_status <> 'x'`, [String(name || '').trim().toLowerCase()], conn);
    return toUser(rows[0]);
  }

  static async search(q) {
    if (!q || !q.trim()) return User.all();
    const rows = await query(`SELECT ${COLUMNS} FROM lpa_users WHERE lpa_user_status <> 'x'
      AND CONCAT_WS(' ', lpa_user_ID, lpa_user_username, lpa_user_firstname, lpa_user_lastname, lpa_user_group) LIKE ?
      ORDER BY lpa_user_ID`, [like(q.trim())]);
    return rows.map(toUser);
  }

  // Returns the user when the credentials are right and the account is active, otherwise null.
  static async authenticate(username, password) {
    const rows = await query(`SELECT ${COLUMNS}, lpa_user_password AS passwordHash FROM lpa_users
      WHERE lpa_user_username = ? AND lpa_user_status = 'a'`, [String(username || '').trim().toLowerCase()]);
    const u = rows[0];
    if (!u || !verifyPassword(password, u.passwordHash)) return null;
    delete u.passwordHash; // the hash never leaves the model
    return toUser(u);
  }

  // Validate input for create (isNew) or update. Returns a list of messages.
  static async validate(data, { isNew, selfId } = {}) {
    const errors = [];
    const username = String(data.username || '').trim().toLowerCase();
    if (!USERNAME_RE.test(username)) errors.push('User name must be 3-30 characters: lower-case letters, numbers, dot, dash or underscore.');
    else {
      // A deleted account still holds its user name (unique key), so check every row.
      const clash = await query('SELECT lpa_user_ID AS id FROM lpa_users WHERE lpa_user_username = ?', [username]);
      if (clash.length && clash[0].id !== selfId) errors.push('That user name is already taken.');
    }
    if (!String(data.firstName || '').trim()) errors.push('First name is required.');
    if (!String(data.lastName || '').trim()) errors.push('Last name is required.');
    if (String(data.firstName || '').trim().length > 50 || String(data.lastName || '').trim().length > 50) errors.push('First and last name must be 50 characters or fewer.');
    if (data.group !== undefined && !GROUPS.includes(data.group)) errors.push('Choose a valid user group.');
    if (isNew || data.password) {
      const p = passwordProblem(data.password);
      if (p) errors.push(p);
      if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) errors.push('Password and confirm password must match.');
    }
    return errors;
  }

  // INSERT with the next ID (U-004 ...). conn = the caller's transaction (registration).
  static async create(data, conn) {
    const rows = await query("SELECT COALESCE(MAX(CAST(SUBSTRING(lpa_user_ID, 3) AS UNSIGNED)), 0) + 1 AS n FROM lpa_users WHERE lpa_user_ID REGEXP '^U-[0-9]+$' FOR UPDATE", [], conn);
    const id = 'U-' + String(rows[0].n).padStart(3, '0');
    await query(`INSERT INTO lpa_users (lpa_user_ID, lpa_user_username, lpa_user_password, lpa_user_firstname,
        lpa_user_lastname, lpa_user_group, lpa_user_client_ID, lpa_user_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, String(data.username).trim().toLowerCase(), hashPassword(data.password), String(data.firstName).trim(),
       String(data.lastName).trim(), GROUPS.includes(data.group) ? data.group : 'customer', data.clientId || null,
       data.status === 'inactive' ? 'd' : 'a'], conn);
    return { id, username: String(data.username).trim().toLowerCase(), group: GROUPS.includes(data.group) ? data.group : 'customer' };
  }

  // UPDATE. A blank password keeps the current one.
  static async update(id, data) {
    const sets = [];
    const params = [];
    const set = (col, val) => { sets.push(`${col} = ?`); params.push(val); };
    if (data.username) set('lpa_user_username', String(data.username).trim().toLowerCase());
    if (data.firstName !== undefined) set('lpa_user_firstname', String(data.firstName).trim());
    if (data.lastName !== undefined) set('lpa_user_lastname', String(data.lastName).trim());
    if (GROUPS.includes(data.group)) set('lpa_user_group', data.group);
    if (data.status) set('lpa_user_status', data.status === 'inactive' ? 'd' : 'a');
    if (data.password) set('lpa_user_password', hashPassword(data.password));
    if (!sets.length) return User.find(id);
    params.push(id);
    await query(`UPDATE lpa_users SET ${sets.join(', ')} WHERE lpa_user_ID = ? AND lpa_user_status <> 'x'`, params);
    return User.find(id);
  }

  // Soft delete: the record stays (the stock ledger refers to it) but can no longer sign in.
  static async remove(id) {
    const r = await query("UPDATE lpa_users SET lpa_user_status = 'x' WHERE lpa_user_ID = ? AND lpa_user_status <> 'x'", [id]);
    return r.affectedRows === 1;
  }
}

User.hashPassword = hashPassword;
module.exports = User;
