// Invoice model - sample sales invoices (moves to the database in the DB block).
// Fields mirror the lpa_invoices table in the LPA spec (lpa_ecomms.sql):
// invoice no, date, client ID (links to lpa_clients), client name, amount, status.
// The client name is looked up from the Client model so the two never disagree.
const Client = require('./Client');

let invoices = [
  { id: 1, number: 'INV-1001', date: '2026-07-28', clientId: 'CL-001', amount: 184.00, status: 'active' },
  { id: 2, number: 'INV-1002', date: '2026-07-29', clientId: 'CL-002', amount: 97.00,  status: 'active' },
  { id: 3, number: 'INV-1003', date: '2026-07-30', clientId: 'CL-003', amount: 265.50, status: 'active' },
  { id: 4, number: 'INV-1004', date: '2026-08-01', clientId: 'CL-004', amount: 45.00,  status: 'active' },
  { id: 5, number: 'INV-1005', date: '2026-08-03', clientId: 'CL-002', amount: 123.00, status: 'active' },
  { id: 6, number: 'INV-1006', date: '2026-08-04', clientId: 'CL-005', amount: 89.00,  status: 'active' },
].map(withClient);

// Attach the client's name and address (denormalised, like lpa_inv_client_name / _address).
function withClient(inv) {
  const c = Client.findByCode(inv.clientId);
  return Object.assign(inv, { client: Client.fullName(c), clientAddress: c ? c.address : '' });
}

class Invoice {
  static all() { return invoices; }
  static search(q) {
    if (!q) return invoices;
    const s = q.trim().toLowerCase();
    return invoices.filter(i =>
      i.client.toLowerCase().includes(s) || i.number.toLowerCase().includes(s) || i.clientId.toLowerCase().includes(s));
  }
  static total(list) { return (list || invoices).reduce((sum, i) => sum + i.amount, 0); }
}
module.exports = Invoice;
