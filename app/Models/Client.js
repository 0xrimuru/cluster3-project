// Client model - sample customers (lpa_clients equivalent).
// Fields mirror the lpa_clients table in the LPA spec (lpa_ecomms.sql):
// ID (code), first name, last name, address, phone, status.
let clients = [
  { id: 1, code: 'CL-001', firstName: 'Riverside College', lastName: 'Library',     address: '12 River Rd, Indooroopilly QLD 4068',  phone: '(07) 3100 2200', status: 'active' },
  { id: 2, code: 'CL-002', firstName: 'DevWorks',          lastName: 'Pty Ltd',     address: '88 Ann St, Brisbane City QLD 4000',    phone: '(07) 3211 4545', status: 'active' },
  { id: 3, code: 'CL-003', firstName: 'Logic Peripherals', lastName: 'Australia',   address: '123 Queen St, Brisbane City QLD 4000', phone: '(07) 3000 1234', status: 'active' },
  { id: 4, code: 'CL-004', firstName: 'Northgate',         lastName: 'High School', address: '5 Ridge St, Northgate QLD 4013',       phone: '(07) 3266 7788', status: 'active' },
  { id: 5, code: 'CL-005', firstName: 'Brisbane Coders',   lastName: 'Guild',       address: '40 Grey St, South Brisbane QLD 4101',  phone: '(07) 3400 9911', status: 'disabled' },
];
class Client {
  static all() { return clients; }
  static findByCode(code) { return clients.find(c => c.code === code); }
  static fullName(c) { return c ? (c.firstName + ' ' + c.lastName) : ''; }
  static search(q) {
    if (!q) return clients;
    const s = q.trim().toLowerCase();
    return clients.filter(c => (c.firstName + ' ' + c.lastName + ' ' + c.code + ' ' + (c.address || '')).toLowerCase().includes(s));
  }
}
module.exports = Client;
