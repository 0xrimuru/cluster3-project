// StockLedger model - an in-memory audit trail of every stock adjustment
// (who, what item, operation, reason, before -> after, when).
let nextId = 5;
let entries = [
  { id: 1, sku: 'LPA-BK-007', title: "You Don't Know JS", user: 'Michael Chang', operation: 'add',       reason: 'Restocked from primary shipment', before: 5,  after: 15, at: '10:25 AM' },
  { id: 2, sku: 'LPA-BK-005', title: 'Refactoring',        user: 'Pedro Alvim',   operation: 'add',       reason: 'Restocked from primary shipment', before: 12, after: 20, at: '10:40 AM' },
  { id: 3, sku: 'LPA-BK-003', title: 'Eloquent JavaScript',user: 'Pedro Alvim',   operation: 'remove',    reason: 'Damaged / write-off',             before: 2,  after: 0,  at: '11:15 AM' },
  { id: 4, sku: 'LPA-BK-006', title: 'Design Patterns',    user: 'Michael Chang', operation: 'reconcile', reason: 'Physical inventory count',         before: 5,  after: 3,  at: '11:54 AM' },
];

class StockLedger {
  static all() { return entries.slice().reverse(); } // most recent first
  static forSku(sku) { return entries.filter(e => e.sku === sku).reverse(); }
  static record({ sku, title, user, operation, reason, before, after }) {
    const e = { id: nextId++, sku, title, user: user || 'Pedro Alvim', operation, reason: reason || '', before, after, at: '' };
    entries.push(e);
    return e;
  }
}
module.exports = StockLedger;
