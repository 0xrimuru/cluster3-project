// Phase 5 (ICTPRG546) - use-case test run against the LPA eComms prototype.
// Each test: id, use case, steps, test data, expected, actual, PASS/FAIL.
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:3000';
const results = [];
let cookie = '';

function rec(id, title, steps, data, expected, actual, pass, ms) {
  results.push({ id, title, steps, data, expected, actual, result: pass ? 'PASS' : 'FAIL', ms });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${title}  ->  ${actual}`);
}
async function get(path, opts = {}) {
  const t = Date.now();
  const r = await fetch(BASE + path, { redirect: 'manual', headers: Object.assign({ cookie }, opts.headers || {}) });
  const body = (r.status === 200 && !(opts.headers || {}).accept) ? await r.text() : (opts.headers ? await r.text() : '');
  return { r, body, ms: Date.now() - t };
}
async function form(path, fields, method) {
  const body = new URLSearchParams(fields).toString();
  const url = method ? `${path}?_method=${method}` : path;
  return fetch(BASE + url, { method: 'POST', redirect: 'manual', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body });
}
const count = (html, re) => (html.match(re) || []).length;

(async () => {
  // UC-03 protected page without login
  let x = await get('/products');
  rec('UC-03', 'Protected page requires sign-in', 'Open /products without signing in', 'none', 'Redirect (302) to /login', `${x.r.status} -> ${x.r.headers.get('location')}`, x.r.status === 302 && x.r.headers.get('location') === '/login');

  // UC-02 blank password
  let r = await form('/login', { username: 'jsmith', password: '' });
  rec('UC-02', 'Login rejected with blank password', 'Enter username, leave password blank, press Login', 'jsmith / (blank)', 'Stay on login page with an error message', `${r.status} -> ${r.headers.get('location')}`, r.status === 302 && r.headers.get('location') === '/login?error=1');

  // UC-01 valid login
  r = await form('/login', { username: 'jsmith', password: 'Lpa#2026' });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')];
  cookie = sc.map(c => c.split(';')[0]).join('; ');
  rec('UC-01', 'Login with username and password', 'Enter username and password, press Login', 'jsmith / Lpa#2026', 'Signed in and taken to the Home page', `${r.status} -> ${r.headers.get('location')}; cookies: ${sc.map(c => c.split('=')[0]).join(', ')}`, r.status === 302 && r.headers.get('location') === '/' && /otb_auth=1/.test(cookie));

  // UC-05 home stats
  x = await get('/');
  const stats = ['8', '3', '1', '6', '$803.50'].every(v => x.body.includes(v)) && x.body.includes('Stock items') && /promo\.mp4/.test(x.body);
  rec('UC-05', 'Home page shows business summary + promo video', 'Open Home', 'seed data', '8 items, 3 low, 1 out, 6 invoices, $803.50 total sales; video present', stats ? '8 / 3 / 1 / 6 / $803.50 shown; promo video embedded' : 'values missing', stats);

  // UC-24 performance
  const times = [];
  for (let i = 0; i < 5; i++) { const t = await get('/'); times.push(t.ms); }
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  rec('UC-24', 'Home page response time', 'Request Home 5 times, average the time', '5 requests', 'Average under 500 ms', `average ${avg} ms (max ${Math.max(...times)} ms)`, avg < 500);

  // UC-06 stock list
  x = await get('/products');
  const skus = count(x.body, /LPA-00\d/g);
  const allEight = [1,2,3,4,5,6,7,8].every(n => x.body.includes(`LPA-00${n}`));
  rec('UC-06', 'Stock list shows all items with key fields', 'Open Stock', 'seed data (8 items)', 'All 8 items listed with SKU, name, price, qty and status badge', allEight ? `8 of 8 SKUs listed; badges: In/Low/Out present = ${/In stock/.test(x.body) && /Low stock/.test(x.body) && /Out of stock/.test(x.body)}` : `${skus} SKUs`, allEight && /Out of stock/.test(x.body));

  // UC-07 search
  x = await get('/products?q=webcam');
  const hits = [1,2,3,4,5,6,7,8].filter(n => x.body.includes(`LPA-00${n}`));
  rec('UC-07', 'Search stock', 'Type "webcam" in search, press Search', 'q = webcam', 'Only 1080p HD Webcam CV-10 (LPA-005) shown', `${hits.length} result(s): ${hits.map(n => 'LPA-00' + n).join(', ')}`, hits.length === 1 && hits[0] === 5);

  // UC-08 add item
  r = await form('/products', { sku: 'LPA-009', title: 'Wireless Presenter WP-5', brand: 'Orbit', category: 'Accessories', price: '29.90', quantity: '10', status: 'active', description: 'Laser presenter with USB receiver.' });
  const newLoc = r.headers.get('location') || '';
  x = await get(newLoc);
  rec('UC-08', 'Add a new stock item', 'Stock > Add item, fill the form, Save', 'LPA-009 Wireless Presenter WP-5, $29.90, qty 10', 'Item saved and its detail page shown', `${r.status} -> ${newLoc}; detail shows "${x.body.includes('Wireless Presenter WP-5') ? 'Wireless Presenter WP-5' : '?'}"`, r.status === 302 && /\/products\/\d+/.test(newLoc) && x.body.includes('Wireless Presenter WP-5'));
  const newId = newLoc.split('/').pop();

  // UC-09 server-side check for missing name
  r = await form('/products', { title: '', brand: '', price: '5' });
  const errBody = await r.text();
  rec('UC-09a', 'Add item with no name is rejected (server)', 'Submit the add form with name and brand empty', 'title = "", brand = ""', 'Not saved; error "needs at least a product name and a brand"', `${r.status}; message shown = ${/product name and a brand/.test(errBody)}`, r.status === 400 && /product name and a brand/.test(errBody));

  // UC-10 edit
  r = await form(`/products/${newId}`, { title: 'Wireless Presenter WP-5', brand: 'Orbit', price: '24.90', quantity: '10', status: 'active' }, 'PUT');
  x = await get(`/products/${newId}`, { headers: { accept: 'application/json' } });
  let j = JSON.parse(x.body);
  rec('UC-10', 'Edit a stock item and save', 'Open item > Edit, change price, Save', 'price 29.90 -> 24.90', 'New price saved', `price now ${j.price}`, j.price === 24.9);

  // UC-11 disable
  r = await form(`/products/${newId}`, { status: 'disabled' }, 'PUT');
  x = await get(`/products/${newId}`, { headers: { accept: 'application/json' } }); j = JSON.parse(x.body);
  rec('UC-11', 'Disable a stock item', 'Edit item, set status Disabled, Save', 'status = disabled', 'Item status is disabled', `status now "${j.status}"`, j.status === 'disabled');

  // UC-12 adjust add + ledger
  r = await form(`/products/2/adjust`, { operation: 'add', quantity: '5', reason: 'Restocked from primary shipment' });
  x = await get('/products/2', { headers: { accept: 'application/json' } }); j = JSON.parse(x.body);
  const led = await get('/stock/ledger');
  const ledOk = /Wireless Optical Mouse WM-200/.test(led.body) && /jsmith/.test(led.body);
  rec('UC-12', 'Stock adjustment - add', 'Item WM-200 > Add stock 5, reason "Restocked", Submit', 'qty 7 + 5', 'On hand becomes 12; adjustment appears in audit history', `on hand ${j.quantity}; ledger entry by jsmith = ${ledOk}`, j.quantity === 12 && ledOk);

  // UC-25 ledger records signed-in user and time
  const timeOk = /jsmith[\s\S]{0,400}?\d{1,2}:\d{2}\s?[AP]M/i.test(led.body) || /\d{1,2}:\d{2}\s?[AP]M[\s\S]{0,400}?jsmith/i.test(led.body);
  rec('UC-25', 'Audit history records who and when', 'After UC-12, open Stock > Audit history', 'signed in as jsmith', 'Newest entry shows user jsmith and a time', `user jsmith shown = ${/jsmith/.test(led.body)}; time shown = ${timeOk}`, /jsmith/.test(led.body) && timeOk);

  // UC-13 remove more than on hand
  r = await form(`/products/8/adjust`, { operation: 'remove', quantity: '50', reason: 'Damaged / write-off' });
  x = await get('/products/8', { headers: { accept: 'application/json' } }); j = JSON.parse(x.body);
  rec('UC-13', 'Stock can never go negative', 'Item LPA-008 (on hand 2) > Remove 50', 'qty 2 - 50', 'On hand stops at 0 (not -48)', `on hand ${j.quantity}`, j.quantity === 0);

  // UC-14 reconcile
  r = await form(`/products/8/adjust`, { operation: 'reconcile', quantity: '10', reason: 'Physical inventory count' });
  x = await get('/products/8', { headers: { accept: 'application/json' } }); j = JSON.parse(x.body);
  rec('UC-14', 'Stock reconcile to a counted total', 'Item LPA-008 > Reconcile to 10', 'counted = 10', 'On hand set to exactly 10', `on hand ${j.quantity}`, j.quantity === 10);

  // UC-15 delete
  r = await form(`/products/${newId}`, {}, 'DELETE');
  x = await get(`/products/${newId}`);
  rec('UC-15', 'Delete a stock item', 'Open LPA-009 > Delete > confirm', `item id ${newId}`, 'Item removed; opening it again returns Not found (404)', `delete ${r.status} -> ${r.headers.get('location')}; reopen = ${x.r.status}`, r.status === 302 && x.r.status === 404);

  // UC-16 sales
  x = await get('/sales');
  const invCount = count(x.body, /INV-10\d\d/g);
  rec('UC-16', 'Sales & Invoicing lists invoices with total', 'Open Sales', 'seed data (6 invoices)', '6 invoices with Date, Client, Amount; Total $803.50', `${invCount} invoices; headers Date/Client/Amount = ${/<th>Date<\/th>/.test(x.body) && /<th>Client<\/th>/.test(x.body)}; total $803.50 = ${x.body.includes('$803.50')}`, invCount === 6 && x.body.includes('$803.50'));

  // UC-17 search invoices
  x = await get('/sales?q=DevWorks');
  const n2 = count(x.body, /INV-10\d\d/g);
  rec('UC-17', 'Search invoices by client', 'Type "DevWorks" in search, press Search', 'q = DevWorks', '2 invoices (INV-1002, INV-1005); total $220.00', `${n2} invoices; total $220.00 = ${x.body.includes('$220.00')}`, n2 === 2 && x.body.includes('$220.00'));

  // UC-18 clients with address + search by suburb
  x = await get('/clients');
  const addrOk = /address/i.test(x.body) && x.body.includes('Indooroopilly');
  const s = await get('/clients?q=Northgate');
  rec('UC-18', 'Client records with address; search', 'Open Clients; search "Northgate"', 'q = Northgate', 'Address column shown; 1 client (CL-004) found', `address column = ${addrOk}; results = ${count(s.body, /CL-00\d/g)}`, addrOk && count(s.body, /CL-00\d/g) === 1);

  // UC-19 referential consistency (invoice -> client)
  const APP = process.env.APPDIR || require('path').resolve(__dirname, '../..');
  const Invoice = require(APP + '/app/Models/Invoice.js');
  const Client = require(APP + '/app/Models/Client.js');
  const orphans = Invoice.all().filter(i => !i.clientId || !(Client.findByCode && Client.findByCode(i.clientId)));
  rec('UC-19', 'Every invoice points to an existing client', 'Check each invoice clientId against the client list', '6 invoices, 5 clients', '0 invoices without a valid client', orphans.length ? `${orphans.length} of ${Invoice.all().length} invoices have no valid client ID` : '0 orphan invoices', orphans.length === 0);

  // UC-20 JSON API
  x = await get('/products', { headers: { accept: 'application/json' } });
  let arr = []; try { arr = JSON.parse(x.body); } catch (e) {}
  rec('UC-20', 'Stock available as JSON (API)', 'GET /products with Accept: application/json', 'Accept: application/json', 'JSON array of stock items', `status ${x.r.status}; ${Array.isArray(arr) ? arr.length + ' items, content-type ' + x.r.headers.get('content-type').split(';')[0] : 'not JSON'}`, x.r.status === 200 && Array.isArray(arr) && arr.length >= 8);

  // UC-23 mashup pages render
  const m1 = await get('/mashups/store-locator'); const m2 = await get('/mashups/pricing');
  rec('UC-23', 'Mashup pages open', 'Open Mashups > Store locator and Pricing', 'none', 'Both pages load (200)', `store-locator ${m1.r.status}, pricing ${m2.r.status}`, m1.r.status === 200 && m2.r.status === 200);

  // --- browser-level checks ---
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
  await ctx.addCookies(cookie.split('; ').map(c => { const [name, ...v] = c.split('='); return { name, value: v.join('='), url: BASE }; }));
  const page = await ctx.newPage();

  // UC-04 masked password
  const anon = await browser.newPage();
  await anon.goto(BASE + '/login');
  const ptype = await anon.getAttribute('#password', 'type');
  rec('UC-04', 'Password is masked', 'Open login page, inspect password field', 'type "secret"', 'Characters hidden (input type = password)', `input type = "${ptype}"`, ptype === 'password');

  // UC-09b client-side validation
  await page.goto(BASE + '/products/new');
  await page.click('form button[type=submit], form input[type=submit]');
  const msg = await page.$eval('input[name=title]', el => el.validationMessage);
  const stillOnForm = page.url().endsWith('/products/new');
  rec('UC-09b', 'Add form validates before sending (client)', 'Open Add item, press Save with empty fields', 'all fields empty', 'Form not submitted; browser shows "fill out this field"', `stayed on form = ${stillOnForm}; message = "${msg}"`, stillOnForm && msg.length > 0);

  // UC-22 personalisation persists
  await page.goto(BASE + '/settings');
  const dark = await page.$('input[name="pref-theme"][value="dark"]');
  if (dark) await dark.check();
  await page.goto(BASE + '/');
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  rec('UC-22', 'Theme preference is remembered', 'Settings > choose Dark, then open Home', 'theme = dark', 'Home opens in dark theme', `data-theme = "${theme}"`, theme === 'dark');
  await page.evaluate(() => localStorage.clear());

  // UC-21 logout
  await page.goto(BASE + '/logout');
  await page.goto(BASE + '/products');
  rec('UC-21', 'Logout ends the session', 'Press Logout, then try to open Stock', 'none', 'Sent back to the login page', `landed on ${new URL(page.url()).pathname}`, new URL(page.url()).pathname === '/login');
  await browser.close();

  // UC-26 mobile (manual, on emulator)
  results.push({ id: 'UC-26', title: 'Mobile app opens the LPA interface', steps: 'Install APK on Pixel 7 emulator, open LPA eComms', data: 'emulator API 34, server on :3000', expected: 'Splash screen for ~2 s, then login page inside the app', actual: 'Static check passed (APK launch activity = SplashActivity; INTERNET permission). On-device run to be recorded.', result: 'PENDING', ms: 0 });

  const order = r => { const m = r.id.match(/UC-(\d+)(\w?)/); return Number(m[1]) * 10 + (m[2] ? m[2].charCodeAt(0) - 96 : 0); };
  results.sort((a, b) => order(a) - order(b));
  fs.writeFileSync(process.env.OUT || require('path').join(__dirname, 'test-results-after-fixes.json'), JSON.stringify(results, null, 2));
  const p = results.filter(r => r.result === 'PASS').length, f = results.filter(r => r.result === 'FAIL').length;
  console.log(`\n${p} PASS, ${f} FAIL, ${results.length - p - f} PENDING of ${results.length}`);
})().catch(e => { console.error(e); process.exit(1); });
