// Client model - sample customers (lpa_clients equivalent).
let clients = [
  { id: 1, code: 'CL-001', firstName: 'Riverside College', lastName: 'Library', phone: '(07) 3100 2200', status: 'active' },
  { id: 2, code: 'CL-002', firstName: 'DevWorks',           lastName: 'Pty Ltd', phone: '(07) 3211 4545', status: 'active' },
  { id: 3, code: 'CL-003', firstName: 'Logic Peripherals',lastName: 'Australia',phone: '(07) 3000 1234', status: 'active' },
  { id: 4, code: 'CL-004', firstName: 'Northgate',          lastName: 'High School', phone: '(07) 3266 7788', status: 'active' },
  { id: 5, code: 'CL-005', firstName: 'Brisbane Coders',    lastName: 'Guild',   phone: '(07) 3400 9911', status: 'disabled' },
];
class Client {
  static all() { return clients; }
  static search(q) {
    if (!q) return clients;
    const s = q.trim().toLowerCase();
    return clients.filter(c => (c.firstName + ' ' + c.lastName + ' ' + c.code).toLowerCase().includes(s));
  }
}
module.exports = Client;
