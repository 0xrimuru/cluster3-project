// Product (stock item) model - the "M" of MVC, stored in the lpa_stock table (MySQL).
// Each item has a Stock ID (SKU, the primary key), name, brand, category, description,
// image, on-hand quantity, price and status (a = active, d = disabled, x = deleted).
// All SQL uses ? placeholders, so typed input can never change the query (no SQL injection).
const { query, like } = require('../../config/database');

const PLACEHOLDER_IMAGE = '/images/products/placeholder.png';
const STATUS_TO_DB = { active: 'a', disabled: 'd' };
const STATUS_FROM_DB = { a: 'active', d: 'disabled', x: 'deleted' };

// Columns renamed to the names the views already use.
const COLUMNS = `lpa_stock_ID AS sku, lpa_stock_name AS title, lpa_stock_brand AS brand,
  lpa_stock_category AS category, lpa_stock_desc AS description, lpa_stock_image AS image,
  lpa_stock_onhand AS quantity, lpa_stock_price AS price, lpa_stock_status AS status`;

function toProduct(row) {
  if (!row) return null;
  row.status = STATUS_FROM_DB[row.status] || 'active';
  row.id = row.sku; // the Stock ID is also the id used in URLs: /products/LPA-001
  return row;
}
const normSku = v => String(v || '').trim().toUpperCase();
const normQty = v => { const n = parseInt(v, 10); return (isNaN(n) || n < 0) ? 0 : n; };
const normStatus = v => STATUS_TO_DB[v] || 'a';
const stockLevel = q => (q <= 0 ? 'out' : (q <= 5 ? 'low' : 'in'));

const SORTS = {
  featured: 'lpa_stock_ID',
  'price-asc': 'lpa_stock_price ASC, lpa_stock_name',
  'price-desc': 'lpa_stock_price DESC, lpa_stock_name',
  name: 'lpa_stock_name',
};

class Product {
  static get SORTS() { return Object.keys(SORTS); }
  static level(product) { return stockLevel(product.quantity); }

  // Every item except deleted ones (staff Stock page). Optional search text.
  static async all({ q } = {}, conn) {
    let sql = `SELECT ${COLUMNS} FROM lpa_stock WHERE lpa_stock_status <> 'x'`;
    const params = [];
    if (q) {
      sql += ' AND CONCAT_WS(\' \', lpa_stock_ID, lpa_stock_name, lpa_stock_brand, lpa_stock_category) LIKE ?';
      params.push(like(q));
    }
    return (await query(sql + ' ORDER BY lpa_stock_ID', params, conn)).map(toProduct);
  }

  // What customers can buy: active items only, with search, category filter and sort done in SQL.
  static async forSale({ q, category, sort } = {}) {
    let sql = `SELECT ${COLUMNS} FROM lpa_stock WHERE lpa_stock_status = 'a'`;
    const params = [];
    if (q) {
      sql += ' AND CONCAT_WS(\' \', lpa_stock_name, lpa_stock_brand, lpa_stock_category, lpa_stock_desc) LIKE ?';
      params.push(like(q));
    }
    if (category) { sql += ' AND lpa_stock_category = ?'; params.push(category); }
    sql += ' ORDER BY ' + (SORTS[sort] || SORTS.featured); // chosen from a fixed list, never from raw input
    return (await query(sql, params)).map(toProduct);
  }

  static async categories() {
    const rows = await query("SELECT DISTINCT lpa_stock_category AS c FROM lpa_stock WHERE lpa_stock_status = 'a' ORDER BY c");
    return rows.map(r => r.c);
  }

  // Find one item by Stock ID (deleted items are not found).
  static async findBySku(sku, conn) {
    const rows = await query(`SELECT ${COLUMNS} FROM lpa_stock WHERE lpa_stock_ID = ? AND lpa_stock_status <> 'x'`, [normSku(sku)], conn);
    return toProduct(rows[0]);
  }

  // Several items in one query (used to rebuild the cart): WHERE lpa_stock_ID IN (?, ?, ...)
  static async findMany(skus) {
    const list = [...new Set((skus || []).map(normSku))].filter(Boolean);
    if (!list.length) return [];
    const marks = list.map(() => '?').join(', ');
    return (await query(`SELECT ${COLUMNS} FROM lpa_stock WHERE lpa_stock_ID IN (${marks}) AND lpa_stock_status <> 'x'`, list)).map(toProduct);
  }

  // Lock the row until the transaction ends, so two sales cannot take the same stock.
  static async lockForUpdate(sku, conn) {
    const rows = await query(`SELECT ${COLUMNS} FROM lpa_stock WHERE lpa_stock_ID = ? FOR UPDATE`, [normSku(sku)], conn);
    return toProduct(rows[0]);
  }

  // Next free Stock ID like LPA-009 (used when the form leaves Stock ID empty).
  static async nextSku(conn) {
    const rows = await query("SELECT COALESCE(MAX(CAST(SUBSTRING(lpa_stock_ID, 5) AS UNSIGNED)), 0) + 1 AS n FROM lpa_stock WHERE lpa_stock_ID REGEXP '^LPA-[0-9]+$'", [], conn);
    return 'LPA-' + String(rows[0].n).padStart(3, '0');
  }

  // INSERT. Returns the new item.
  static async create(data) {
    const sku = normSku(data.sku) || await Product.nextSku();
    await query(`INSERT INTO lpa_stock (lpa_stock_ID, lpa_stock_name, lpa_stock_brand, lpa_stock_category, lpa_stock_desc,
        lpa_stock_image, lpa_stock_onhand, lpa_stock_price, lpa_stock_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku, String(data.title).trim(), String(data.brand || '').trim(), String(data.category || '').trim() || 'General',
       String(data.description || ''), String(data.image || '').trim() || PLACEHOLDER_IMAGE,
       normQty(data.quantity), parseFloat(data.price) || 0, normStatus(data.status)]);
    return Product.findBySku(sku);
  }

  // UPDATE only the fields that were sent. The Stock ID can be changed only while no
  // invoice or ledger row refers to it (the foreign keys protect the history).
  static async update(id, data) {
    const current = await Product.findBySku(id);
    if (!current) return null;
    const sets = [];
    const params = [];
    const set = (col, val) => { sets.push(`${col} = ?`); params.push(val); };
    if (data.title !== undefined) set('lpa_stock_name', String(data.title).trim());
    if (data.brand !== undefined) set('lpa_stock_brand', String(data.brand).trim());
    if (data.category !== undefined) set('lpa_stock_category', String(data.category).trim() || 'General');
    if (data.description !== undefined) set('lpa_stock_desc', String(data.description));
    if (data.image !== undefined && String(data.image).trim()) set('lpa_stock_image', String(data.image).trim());
    if (data.price !== undefined) set('lpa_stock_price', parseFloat(data.price) || 0);
    if (data.quantity !== undefined && String(data.quantity) !== '') set('lpa_stock_onhand', normQty(data.quantity));
    if (data.status !== undefined) set('lpa_stock_status', normStatus(data.status));
    const newSku = data.sku !== undefined ? normSku(data.sku) : '';
    if (newSku && newSku !== current.sku) set('lpa_stock_ID', newSku);
    if (sets.length) {
      params.push(current.sku);
      await query(`UPDATE lpa_stock SET ${sets.join(', ')} WHERE lpa_stock_ID = ?`, params);
    }
    return Product.findBySku(newSku || current.sku);
  }

  // Stock adjustment (add / remove / reconcile) in the caller's transaction.
  static async adjust(sku, { operation, quantity }, conn) {
    const p = await Product.lockForUpdate(sku, conn);
    if (!p || p.status === 'deleted') return null;
    const before = p.quantity;
    const qty = normQty(quantity);
    let after = before;
    if (operation === 'add') after = before + qty;
    else if (operation === 'remove') after = Math.max(0, before - qty);
    else if (operation === 'reconcile') after = qty; // qty is the counted total
    await query('UPDATE lpa_stock SET lpa_stock_onhand = ? WHERE lpa_stock_ID = ?', [after, p.sku], conn);
    return { product: p, before, after, delta: after - before };
  }

  // Sell (-) or return (+) stock inside the caller's transaction. Never below zero.
  static async changeQty(sku, delta, conn) {
    const p = await Product.lockForUpdate(sku, conn);
    if (!p) return null;
    const before = p.quantity;
    const after = Math.max(0, before + delta);
    await query('UPDATE lpa_stock SET lpa_stock_onhand = ? WHERE lpa_stock_ID = ?', [after, p.sku], conn);
    return { product: p, before, after };
  }

  // Soft delete (status x): invoices and the audit history still refer to the item.
  static async remove(id) {
    const r = await query("UPDATE lpa_stock SET lpa_stock_status = 'x' WHERE lpa_stock_ID = ? AND lpa_stock_status <> 'x'", [normSku(id)]);
    return r.affectedRows === 1;
  }

  // Dashboard numbers, worked out by the database.
  static async stats() {
    const rows = await query(`SELECT COUNT(*) AS items,
        SUM(lpa_stock_onhand BETWEEN 1 AND 5) AS lowStock,
        SUM(lpa_stock_onhand = 0) AS outStock
      FROM lpa_stock WHERE lpa_stock_status <> 'x'`);
    const r = rows[0];
    return { items: Number(r.items), lowStock: Number(r.lowStock || 0), outStock: Number(r.outStock || 0) };
  }
}

module.exports = Product;
