// Invoice model - sample sales invoices (moves to the database in the DB block).
let invoices = [
  { id: 1, number: 'INV-1001', date: '2026-07-28', client: 'Riverside College Library', amount: 184.00 },
  { id: 2, number: 'INV-1002', date: '2026-07-29', client: 'DevWorks Pty Ltd',          amount: 97.00  },
  { id: 3, number: 'INV-1003', date: '2026-07-30', client: 'Logic Peripherals Australia', amount: 265.50 },
  { id: 4, number: 'INV-1004', date: '2026-08-01', client: 'Northgate High School',     amount: 45.00  },
  { id: 5, number: 'INV-1005', date: '2026-08-03', client: 'DevWorks Pty Ltd',          amount: 123.00 },
  { id: 6, number: 'INV-1006', date: '2026-08-04', client: 'Brisbane Coders Guild',     amount: 89.00  },
];

class Invoice {
  static all() { return invoices; }
  static search(q) {
    if (!q) return invoices;
    const s = q.trim().toLowerCase();
    return invoices.filter(i =>
      i.client.toLowerCase().includes(s) || i.number.toLowerCase().includes(s));
  }
  static total(list) { return (list || invoices).reduce((sum, i) => sum + i.amount, 0); }
}
module.exports = Invoice;
