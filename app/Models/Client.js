// Client model - LPA's customers, stored in the lpa_clients table (MySQL).
// Columns: ID (code), first name, last name, address, phone, status (a = active, d = disabled).
// Business clients are kept by staff; web-store customers get a client record when they
// register, so their orders become normal invoices.
// The phone number is personal information: it is stored ENCRYPTED (AES-256-GCM) and found by
// an exact-match blind index (HMAC-SHA256 of its digits) - see app/Security/crypto.js.
const { query, like } = require('../../config/database');
const { encrypt, decrypt, blindIndex, isEncrypted } = require('../Security/crypto');

const COLUMNS = `lpa_client_ID AS code, lpa_client_firstname AS firstName, lpa_client_lastname AS lastName,
  lpa_client_address AS address, lpa_client_phone AS phone, lpa_client_status AS status`;
const digits = p => String(p || '').replace(/\D/g, '');
function openPhone(v) {
  if (!isEncrypted(v)) return v; // (only before db:setup has encrypted old rows)
  try { return decrypt(v); } catch (e) { return '(cannot decrypt)'; }
}
const toClient = r => (r ? Object.assign(r, { id: r.code, phone: openPhone(r.phone), status: r.status === 'a' ? 'active' : 'disabled' }) : null);

class Client {
  // Delivery details rules - the same at registration and at checkout.
  static contactErrors({ address, phone }) {
    const errors = [];
    if (!address) errors.push('Delivery address is required.');
    else if (address.length > 250) errors.push('Delivery address must be 250 characters or fewer.');
    if (!/^[0-9 ()+-]{8,20}$/.test(phone)) errors.push('Enter a valid phone number (8-20 digits, spaces, brackets, + or -).');
    return errors;
  }

  static fullName(c) { return c ? (c.firstName + ' ' + c.lastName) : ''; }

  static async all() { return (await query(`SELECT ${COLUMNS} FROM lpa_clients ORDER BY lpa_client_ID`)).map(toClient); }

  static async findByCode(code, conn) {
    const rows = await query(`SELECT ${COLUMNS} FROM lpa_clients WHERE lpa_client_ID = ?`, [String(code || '').trim().toUpperCase()], conn);
    return toClient(rows[0]);
  }

  // Search by name, ID or address (LIKE), or by the exact phone number (blind index).
  static async search(q) {
    if (!q || !q.trim()) return Client.all();
    const d = digits(q);
    const rows = await query(`SELECT ${COLUMNS} FROM lpa_clients
      WHERE CONCAT_WS(' ', lpa_client_firstname, lpa_client_lastname, lpa_client_ID, lpa_client_address) LIKE ?
         OR (? IS NOT NULL AND lpa_client_phone_idx = ?)
      ORDER BY lpa_client_ID`, [like(q.trim()), d.length >= 8 ? 1 : null, d.length >= 8 ? blindIndex(d) : null]);
    return rows.map(toClient);
  }

  // INSERT a new client with the next code (CL-007, CL-008 ...). Runs inside the caller's
  // transaction when registering, so the client and the user account are saved together.
  static async create({ firstName, lastName, address, phone }, conn) {
    const rows = await query("SELECT COALESCE(MAX(CAST(SUBSTRING(lpa_client_ID, 4) AS UNSIGNED)), 0) + 1 AS n FROM lpa_clients WHERE lpa_client_ID REGEXP '^CL-[0-9]+$' FOR UPDATE", [], conn);
    const code = 'CL-' + String(rows[0].n).padStart(3, '0');
    const ph = String(phone || '').trim();
    await query(`INSERT INTO lpa_clients (lpa_client_ID, lpa_client_firstname, lpa_client_lastname, lpa_client_address, lpa_client_phone, lpa_client_phone_idx, lpa_client_status)
      VALUES (?, ?, ?, ?, ?, ?, 'a')`, [code, String(firstName || '').trim(), String(lastName || '').trim(), String(address || '').trim(), encrypt(ph), blindIndex(digits(ph))], conn);
    return Client.findByCode(code, conn);
  }

  // Customers can update their delivery address / phone at checkout (blank = keep).
  static async update(code, data, conn) {
    const address = String(data.address || '').trim();
    const phone = String(data.phone || '').trim();
    const sets = []; const params = [];
    if (address) { sets.push('lpa_client_address = ?'); params.push(address); }
    if (phone) { sets.push('lpa_client_phone = ?', 'lpa_client_phone_idx = ?'); params.push(encrypt(phone), blindIndex(digits(phone))); }
    if (sets.length) await query(`UPDATE lpa_clients SET ${sets.join(', ')} WHERE lpa_client_ID = ?`, params.concat(code), conn);
    return Client.findByCode(code, conn);
  }
}
module.exports = Client;
