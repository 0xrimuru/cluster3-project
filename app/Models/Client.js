// Client model - LPA's customers, stored in the lpa_clients table (MySQL).
// Columns: ID (code), first name, last name, address, phone, status (a = active, d = disabled).
// Business clients are kept by staff; web-store customers get a client record when they
// register, so their orders become normal invoices.
const { query } = require('../../config/database');

const COLUMNS = `lpa_client_ID AS code, lpa_client_firstname AS firstName, lpa_client_lastname AS lastName,
  lpa_client_address AS address, lpa_client_phone AS phone, lpa_client_status AS status`;
const toClient = r => (r ? Object.assign(r, { id: r.code, status: r.status === 'a' ? 'active' : 'disabled' }) : null);
const like = s => '%' + String(s).replace(/[\\%_]/g, c => '\\' + c) + '%';

class Client {
  static fullName(c) { return c ? (c.firstName + ' ' + c.lastName) : ''; }

  static async all() { return (await query(`SELECT ${COLUMNS} FROM lpa_clients ORDER BY lpa_client_ID`)).map(toClient); }

  static async findByCode(code, conn) {
    const rows = await query(`SELECT ${COLUMNS} FROM lpa_clients WHERE lpa_client_ID = ?`, [String(code || '').trim().toUpperCase()], conn);
    return toClient(rows[0]);
  }

  // Search by name, ID, address or phone.
  static async search(q) {
    if (!q || !q.trim()) return Client.all();
    const rows = await query(`SELECT ${COLUMNS} FROM lpa_clients
      WHERE CONCAT_WS(' ', lpa_client_firstname, lpa_client_lastname, lpa_client_ID, lpa_client_address, lpa_client_phone) LIKE ?
      ORDER BY lpa_client_ID`, [like(q.trim())]);
    return rows.map(toClient);
  }

  // INSERT a new client with the next code (CL-007, CL-008 ...). Runs inside the caller's
  // transaction when registering, so the client and the user account are saved together.
  static async create({ firstName, lastName, address, phone }, conn) {
    const rows = await query("SELECT COALESCE(MAX(CAST(SUBSTRING(lpa_client_ID, 4) AS UNSIGNED)), 0) + 1 AS n FROM lpa_clients WHERE lpa_client_ID REGEXP '^CL-[0-9]+$' FOR UPDATE", [], conn);
    const code = 'CL-' + String(rows[0].n).padStart(3, '0');
    await query(`INSERT INTO lpa_clients (lpa_client_ID, lpa_client_firstname, lpa_client_lastname, lpa_client_address, lpa_client_phone, lpa_client_status)
      VALUES (?, ?, ?, ?, ?, 'a')`, [code, String(firstName || '').trim(), String(lastName || '').trim(), String(address || '').trim(), String(phone || '').trim()], conn);
    return Client.findByCode(code, conn);
  }

  // Customers can update their delivery address / phone at checkout (blank = keep).
  static async update(code, data, conn) {
    const address = String(data.address || '').trim();
    const phone = String(data.phone || '').trim();
    await query(`UPDATE lpa_clients SET lpa_client_address = IF(? = '', lpa_client_address, ?),
      lpa_client_phone = IF(? = '', lpa_client_phone, ?) WHERE lpa_client_ID = ?`, [address, address, phone, phone, code], conn);
    return Client.findByCode(code, conn);
  }
}
module.exports = Client;
