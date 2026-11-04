// Invoice model - sales invoices (lpa_invoices) and their line items (lpa_invoice_items).
// The client name / address are copied onto the invoice when it is created (they are what
// was printed on the day), and each line keeps the price charged at the time of sale.
// Line amounts and the invoice amount are always calculated here, never typed in.
const { query, nowLocal, like } = require('../../config/database');

const round2 = n => Math.round(n * 100) / 100;

// List columns + the number of units on each invoice (sub-query on the items table).
const LIST = `SELECT i.lpa_inv_no AS number, DATE_FORMAT(i.lpa_inv_date, '%Y-%m-%d') AS date,
    i.lpa_inv_client_ID AS clientId, i.lpa_inv_client_name AS client, i.lpa_inv_client_address AS clientAddress,
    i.lpa_inv_amount AS amount, i.lpa_inv_payment AS payment, 'active' AS status,
    (SELECT COALESCE(SUM(t.lpa_invitem_qty), 0) FROM lpa_invoice_items t WHERE t.lpa_invitem_inv_no = i.lpa_inv_no) AS units
  FROM lpa_invoices i WHERE i.lpa_inv_status = 'a'`;
const fixUnits = rows => rows.map(r => Object.assign(r, { units: Number(r.units) }));

class Invoice {
  static async all() { return fixUnits(await query(`${LIST} ORDER BY i.lpa_inv_no`)); }

  // One invoice with its line items (two queries), or null.
  static async find(number, conn) {
    const no = String(number || '').trim().toUpperCase();
    const rows = await query(`${LIST} AND i.lpa_inv_no = ?`, [no], conn);
    if (!rows.length) return null;
    const inv = fixUnits(rows)[0];
    inv.items = await query(`SELECT lpa_invitem_stock_ID AS sku, lpa_invitem_stock_name AS name, lpa_invitem_qty AS qty,
        lpa_invitem_stock_price AS price, lpa_invitem_stock_amount AS amount
      FROM lpa_invoice_items WHERE lpa_invitem_inv_no = ? ORDER BY lpa_invitem_no`, [no], conn);
    return inv;
  }

  // A customer's own orders, newest first.
  static async forClient(clientId, limit) {
    let sql = `${LIST} AND i.lpa_inv_client_ID = ? ORDER BY i.lpa_inv_date DESC, i.lpa_inv_no DESC`;
    if (limit) sql += ' LIMIT ' + Math.max(1, parseInt(limit, 10) || 1);
    return fixUnits(await query(sql, [clientId]));
  }

  static async nextNumber(conn) {
    const rows = await query("SELECT COALESCE(MAX(CAST(SUBSTRING(lpa_inv_no, 5) AS UNSIGNED)), 1000) + 1 AS n FROM lpa_invoices WHERE lpa_inv_no REGEXP '^INV-[0-9]+$' FOR UPDATE", [], conn); // lock: two checkouts at once never get the same number
    return 'INV-' + rows[0].n;
  }

  // Search by invoice number, client name, client ID, client address or date (YYYY-MM-DD).
  static async search(q) {
    if (!q || !q.trim()) return Invoice.all();
    return fixUnits(await query(`${LIST} AND CONCAT_WS(' ', i.lpa_inv_no, i.lpa_inv_client_name, i.lpa_inv_client_ID,
        i.lpa_inv_client_address, DATE_FORMAT(i.lpa_inv_date, '%Y-%m-%d')) LIKE ? ORDER BY i.lpa_inv_no`, [like(q.trim())]));
  }

  // Has this client bought this product (on an active invoice)? Used for "verified" reviews.
  static async hasBought(clientId, sku) {
    const rows = await query(`SELECT 1 AS yes FROM lpa_invoice_items t JOIN lpa_invoices i ON i.lpa_inv_no = t.lpa_invitem_inv_no
      WHERE i.lpa_inv_client_ID = ? AND t.lpa_invitem_stock_ID = ? AND i.lpa_inv_status = 'a' LIMIT 1`, [clientId, String(sku || '').toUpperCase()]);
    return rows.length > 0;
  }

  static round2(n) { return round2(n); }
  static total(list) { return round2((list || []).reduce((sum, i) => sum + i.amount, 0)); }

  // Total sales, worked out by the database (dashboard).
  static async stats() {
    const rows = await query("SELECT COUNT(*) AS invoices, COALESCE(SUM(lpa_inv_amount), 0) AS sales FROM lpa_invoices WHERE lpa_inv_status = 'a'");
    return { invoices: Number(rows[0].invoices), sales: round2(Number(rows[0].sales)) };
  }

  // INSERT the invoice and its items. Must run inside a transaction (conn) together with the
  // stock changes. client = the Client record; items = [{ sku, name, qty, price }] (validated).
  static async create({ client, items, payment, date }, conn) {
    const number = await Invoice.nextNumber(conn);
    const lines = items.map(i => Object.assign({}, i, { amount: round2(i.qty * i.price) }));
    const amount = round2(lines.reduce((s, l) => s + l.amount, 0));
    const when = date ? `${date} ${nowLocal().slice(11)}` : nowLocal();
    await query(`INSERT INTO lpa_invoices (lpa_inv_no, lpa_inv_date, lpa_inv_client_ID, lpa_inv_client_name,
        lpa_inv_client_address, lpa_inv_amount, lpa_inv_payment, lpa_inv_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'a')`,
      [number, when, client.code, `${client.firstName} ${client.lastName}`, client.address, amount, payment || 'Account'], conn);
    for (const l of lines) {
      await query(`INSERT INTO lpa_invoice_items (lpa_invitem_inv_no, lpa_invitem_stock_ID, lpa_invitem_stock_name,
          lpa_invitem_qty, lpa_invitem_stock_price, lpa_invitem_stock_amount) VALUES (?, ?, ?, ?, ?, ?)`,
        [number, l.sku, l.name, l.qty, l.price, l.amount], conn);
    }
    return { number, amount, items: lines };
  }

  // Soft delete (status x) - the record stays for the audit trail. Returns the invoice, or null.
  static async remove(number, conn) {
    const inv = await Invoice.find(number, conn);
    if (!inv) return null;
    // "AND status = 'a'" + affectedRows: if two people delete at the same moment, only one wins
    const r = await query("UPDATE lpa_invoices SET lpa_inv_status = 'x' WHERE lpa_inv_no = ? AND lpa_inv_status = 'a'", [inv.number], conn);
    return r.affectedRows === 1 ? inv : null;
  }
}
module.exports = Invoice;
