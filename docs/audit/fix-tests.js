// Regression tests for the bugs found by the code audit of 4 Nov 2026 (docs/audit/README.md).
// Each test reproduces the original problem; before the fixes these gave a 500 error or a wrong result.
//   npm run db:setup && npm run nosql:setup && npm start
//   BASE=http://localhost:3000 node docs/audit/fix-tests.js
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3000';
const jar = {}, csrf = {};
const results = [];

function rec(id, title, expected, actual, pass) {
  results.push({ id, title, expected, actual, result: pass ? 'PASS' : 'FAIL' });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${title}  ->  ${actual}`);
}
async function req(who, method, p, { form, json, cookie } = {}) {
  const headers = { cookie: cookie !== undefined ? cookie : (jar[who] || ''), accept: json !== undefined ? 'application/json' : 'text/html' };
  if (method !== 'GET' && csrf[who]) headers['x-csrf-token'] = csrf[who];
  let body;
  if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
  if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
  const r = await fetch(BASE + p, { method, redirect: 'manual', headers, body });
  const text = await r.text();
  return { status: r.status, loc: r.headers.get('location'), text };
}
async function login(who, username) {
  const r = await fetch(BASE + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password: 'Lpa#2026' }).toString() });
  jar[who] = (r.headers.getSetCookie() || []).map(c => c.split(';')[0]).filter(c => !c.endsWith('=')).join('; ');
  const page = await fetch(BASE + '/more', { headers: { cookie: jar[who] } }).then(x => x.text());
  csrf[who] = (page.match(/name="csrf-token" content="([0-9a-f]+)"/) || [])[1] || '';
}

(async () => {
  await login('admin', 'palvim');
  await login('cust', 'aturner');

  // F-01 customer login without a client record (checkout used to crash)
  const u = await req('admin', 'POST', '/users', { form: { username: 'nocli1', firstName: 'No', lastName: 'Client', group: 'customer', status: 'active', password: 'Shop#2026xy' } });
  rec('F-01', 'Admin cannot make a customer login without a client record', '400 with "Register" message; no user saved',
    `${u.status}; message = ${/created with Register/.test(u.text)}`, u.status === 400 && /created with Register/.test(u.text));

  // F-02 re-using the Stock ID of a deleted item (used to be a 500)
  const item = { sku: 'AUD-T1', title: 'Audit test item', brand: 'LPA', category: 'General', price: '1.00', quantity: '1', status: 'active' };
  await req('admin', 'POST', '/products', { json: item });
  await req('admin', 'DELETE', '/products/AUD-T1', { json: {} });
  const again = await req('admin', 'POST', '/products', { json: item });
  rec('F-02', 'Re-using a deleted item\'s Stock ID gives a clear message', '409 "already exists", not 500', `${again.status} ${again.text.slice(0, 80)}`, again.status === 409 && /already exists/.test(again.text));

  // F-03 two orders at the same moment get different invoice numbers
  // different items, so the stock row locks do not queue the three saves one after the other
  const make = sku => req('admin', 'POST', '/sales', { json: { clientId: 'CL-001', items: [{ sku, qty: 1 }] } });
  const pair = await Promise.all(['LPA-001', 'LPA-002', 'LPA-005'].map(make));
  const numbers = pair.map(r => (r.text.match(/INV-\d+/) || [''])[0]);
  rec('F-03', 'Invoices saved at the same moment get different numbers', 'all 201, numbers all different',
    `${pair.map(r => r.status).join('/')}; ${numbers.join(', ')}`, pair.every(r => r.status === 201) && new Set(numbers).size === numbers.length);

  // F-04 editing must not blank the product name
  const blank = await req('admin', 'PUT', '/products/LPA-001', { json: { title: '   ' } });
  rec('F-04', 'Editing cannot save a product with no name', '400', `${blank.status}`, blank.status === 400);

  // F-05 impossible date and an invoice too big for the database column
  const feb30 = await req('admin', 'POST', '/sales', { json: { clientId: 'CL-001', date: '2026-02-30', items: [{ sku: 'LPA-002', qty: 1 }] } });
  const huge = await req('admin', 'POST', '/products', { json: { sku: 'AUD-BIG', title: 'Big', brand: 'LPA', price: '99999.99', quantity: '20', status: 'active' } });
  const tooBig = await req('admin', 'POST', '/sales', { json: { clientId: 'CL-001', items: [{ sku: 'AUD-BIG', qty: 11 }] } });
  rec('F-05', 'Invalid date (30 Feb) and an over-limit total are refused with a message', 'both 400 (not 500)',
    `30 Feb ${feb30.status}; $1.1m invoice ${tooBig.status} (item ${huge.status})`, feb30.status === 400 && tooBig.status === 400 && /at most/.test(tooBig.text));

  // F-06 a damaged session cookie must not break every page
  const bad = await req('x', 'GET', '/login', { cookie: 'lpa_sid=%E0%A4%A' });
  rec('F-06', 'A damaged session cookie still shows the sign-in page', '200', `${bad.status}`, bad.status === 200);

  // F-07 repeated query keys on the pricing mashup
  const cur = await req('admin', 'GET', '/mashups/pricing?currency=usd&currency=eur');
  rec('F-07', 'Pricing page copes with ?currency given twice', '200 (not 500)', `${cur.status}`, cur.status === 200);

  // F-08 logout only by POST with the CSRF token (a link from another site cannot sign you out)
  const getOut = await req('cust', 'GET', '/logout');
  const still = await req('cust', 'GET', '/orders');
  const noToken = await fetch(BASE + '/logout', { method: 'POST', redirect: 'manual', headers: { cookie: jar.cust } });
  const postOut = await req('cust', 'POST', '/logout', { form: {} });
  const after = await req('cust', 'GET', '/orders');
  rec('F-08', 'Logout needs a POST with the CSRF token', 'GET does nothing; POST without token 403; with token -> signed out',
    `GET ${getOut.status} (orders still ${still.status}); no token ${noToken.status}; POST ${postOut.status} -> ${postOut.loc}; orders now ${after.status} -> ${after.loc}`,
    getOut.status === 404 && still.status === 200 && noToken.status === 403 && postOut.loc === '/login' && after.loc === '/login');

  fs.writeFileSync(path.join(__dirname, 'fix-test-results.json'), JSON.stringify(results, null, 2));
  const failed = results.filter(r => r.result !== 'PASS').length;
  console.log(`\n${results.length - failed} PASS, ${failed} FAIL of ${results.length}`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
