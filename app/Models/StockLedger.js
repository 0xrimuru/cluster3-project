// StockLedger model - the audit trail of every stock change, stored in lpa_stock_ledger.
// Each row: which item, who (user ID -> lpa_users), operation, reason, before -> after, when.
// The page shows names, so the queries JOIN the stock and user tables.
const { query, nowLocal } = require('../../config/database');

const SELECT = `SELECT l.lpa_ledger_ID AS id, l.lpa_ledger_stock_ID AS sku, s.lpa_stock_name AS title,
    CONCAT(u.lpa_user_firstname, ' ', u.lpa_user_lastname, IF(u.lpa_user_group = 'customer', ' (web order)', '')) AS user,
    l.lpa_ledger_operation AS operation, l.lpa_ledger_reason AS reason,
    l.lpa_ledger_before AS \`before\`, l.lpa_ledger_after AS \`after\`,
    DATE_FORMAT(l.lpa_ledger_at, '%d/%m/%Y %l:%i %p') AS at
  FROM lpa_stock_ledger l
  JOIN lpa_stock s ON s.lpa_stock_ID = l.lpa_ledger_stock_ID
  JOIN lpa_users u ON u.lpa_user_ID = l.lpa_ledger_user_ID`;

class StockLedger {
  static async all() { return query(`${SELECT} ORDER BY l.lpa_ledger_at DESC, l.lpa_ledger_ID DESC`); }
  static async forSku(sku) { return query(`${SELECT} WHERE l.lpa_ledger_stock_ID = ? ORDER BY l.lpa_ledger_at DESC, l.lpa_ledger_ID DESC`, [sku]); }

  // INSERT one entry (inside the same transaction as the stock change).
  static async record({ sku, userId, operation, reason, before, after }, conn) {
    const r = await query(`INSERT INTO lpa_stock_ledger (lpa_ledger_stock_ID, lpa_ledger_user_ID, lpa_ledger_operation,
        lpa_ledger_reason, lpa_ledger_before, lpa_ledger_after, lpa_ledger_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sku, userId, operation, String(reason || '').slice(0, 100), before, after, nowLocal()], conn);
    return r.insertId;
  }
}
module.exports = StockLedger;
