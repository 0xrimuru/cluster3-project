// StockLedger model - an in-memory audit trail of every stock adjustment
// (who, what item, operation, reason, before -> after, when).
let nextId = 5;
let entries = [
  { id: 1, sku: 'LPA-007', title: 'Mechanical Numpad NP-22',   user: 'Michael Chang', operation: 'add',       reason: 'Restocked from primary shipment', before: 5,  after: 15, at: '10:25 AM' },
  { id: 2, sku: 'LPA-005', title: '1080p HD Webcam CV-10',     user: 'Pedro Alvim',   operation: 'add',       reason: 'Restocked from primary shipment', before: 12, after: 20, at: '10:40 AM' },
  { id: 3, sku: 'LPA-003', title: '27" 4K UHD Monitor UM-27',  user: 'Pedro Alvim',   operation: 'remove',    reason: 'Damaged / write-off',             before: 2,  after: 0,  at: '11:15 AM' },
  { id: 4, sku: 'LPA-004', title: 'USB-C Docking Station DS-11',user: 'Michael Chang', operation: 'reconcile', reason: 'Physical inventory count',         before: 5,  after: 4,  at: '11:54 AM' },
];

class StockLedger {
  static all() { return entries.slice().reverse(); } // most recent first
  static forSku(sku) { return entries.filter(e => e.sku === sku).reverse(); }
  static record({ sku, title, user, operation, reason, before, after }) {
    const at = new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
    const e = { id: nextId++, sku, title, user: user || 'Unknown user', operation, reason: reason || '', before, after, at };
    entries.push(e);
    return e;
  }
}
module.exports = StockLedger;
