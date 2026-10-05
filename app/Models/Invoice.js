// Invoice model - sales invoices with their line items (moves to the database in the DB block).
// Fields mirror the LPA spec (lpa_ecomms.sql):
//   lpa_invoices      -> number, date, clientId, client (name), clientAddress, amount, status
//   lpa_invoice_items -> items[]: sku, name, qty, price (price charged at the time of sale), amount
// The client name/address are copied from the Client record when the invoice is created,
// exactly like lpa_inv_client_name / lpa_inv_client_address.
const Client = require('./Client');

const round2 = n => Math.round(n * 100) / 100;

// Seed invoices. Line prices are the prices charged on the day (some older/promo prices).
let invoices = [
  { number: 'INV-1001', date: '2026-07-28', clientId: 'CL-001', payment: 'Account', items: [
      { sku: 'LPA-001', name: 'Mechanical Keyboard MK-87', qty: 1, price: 89.00 },
      { sku: 'LPA-008', name: 'USB-C to HDMI Cable 2m',    qty: 5, price: 19.00 } ] },
  { number: 'INV-1002', date: '2026-07-29', clientId: 'CL-002', payment: 'Account', items: [
      { sku: 'LPA-002', name: 'Wireless Optical Mouse WM-200', qty: 2, price: 39.50 },
      { sku: 'LPA-008', name: 'USB-C to HDMI Cable 2m',        qty: 1, price: 18.00 } ] },
  { number: 'INV-1003', date: '2026-07-30', clientId: 'CL-003', payment: 'Account', items: [
      { sku: 'LPA-006', name: 'Noise-Cancelling Headset HS-90', qty: 1, price: 119.00 },
      { sku: 'LPA-005', name: '1080p HD Webcam CV-10',         qty: 1, price: 69.00 },
      { sku: 'LPA-002', name: 'Wireless Optical Mouse WM-200', qty: 1, price: 39.50 },
      { sku: 'LPA-008', name: 'USB-C to HDMI Cable 2m',        qty: 2, price: 19.00 } ] },
  { number: 'INV-1004', date: '2026-08-01', clientId: 'CL-004', payment: 'Account', items: [
      { sku: 'LPA-007', name: 'Mechanical Numpad NP-22', qty: 1, price: 26.00 },
      { sku: 'LPA-008', name: 'USB-C to HDMI Cable 2m',  qty: 1, price: 19.00 } ] },
  { number: 'INV-1005', date: '2026-08-03', clientId: 'CL-002', payment: 'Account', items: [
      { sku: 'LPA-001', name: 'Mechanical Keyboard MK-87', qty: 1, price: 89.00 },
      { sku: 'LPA-007', name: 'Mechanical Numpad NP-22',   qty: 1, price: 34.00 } ] },
  { number: 'INV-1006', date: '2026-08-04', clientId: 'CL-005', payment: 'Account', items: [
      { sku: 'LPA-001', name: 'Mechanical Keyboard MK-87', qty: 1, price: 89.00 } ] },
].map(inv => finalise(Object.assign({ status: 'active' }, inv)));
let nextNo = 1007;

// Line amounts and the invoice amount are always calculated from the items, never typed in.
function finalise(inv) {
  inv.items.forEach(i => { i.amount = round2(i.qty * i.price); });
  inv.amount = round2(inv.items.reduce((s, i) => s + i.amount, 0));
  const c = Client.findByCode(inv.clientId);
  inv.client = inv.client || Client.fullName(c);
  inv.clientAddress = inv.clientAddress || (c ? c.address : '');
  return inv;
}

class Invoice {
  static all() { return invoices.filter(i => i.status !== 'deleted'); }
  static find(number) { return Invoice.all().find(i => i.number === String(number || '').toUpperCase()); }
  static forClient(clientId) { return Invoice.all().filter(i => i.clientId === clientId).slice().reverse(); }
  static nextNumber() { return 'INV-' + nextNo; }

  // Search by invoice number, client name, client ID, client address or date.
  static search(q) {
    const list = Invoice.all();
    if (!q) return list;
    const s = q.trim().toLowerCase();
    return list.filter(i => [i.number, i.client, i.clientId, i.clientAddress, i.date].join(' ').toLowerCase().includes(s));
  }
  static total(list) { return round2((list || Invoice.all()).reduce((sum, i) => sum + i.amount, 0)); }

  // items: [{ sku, name, qty, price }] - already validated by the caller (client + stock checks)
  static create({ clientId, items, payment, date }) {
    const c = Client.findByCode(clientId);
    const inv = finalise({
      number: 'INV-' + nextNo++,
      date: date || new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' }), // YYYY-MM-DD
      clientId: c.code, client: Client.fullName(c), clientAddress: c.address,
      payment: payment || 'Account', status: 'active',
      items: items.map(i => ({ sku: i.sku, name: i.name, qty: i.qty, price: i.price })),
    });
    invoices.push(inv);
    return inv;
  }

  // Soft delete (keeps the record for the audit trail). Returns the removed invoice.
  static remove(number) {
    const inv = Invoice.find(number);
    if (!inv) return null;
    inv.status = 'deleted';
    return inv;
  }
}
module.exports = Invoice;
