// LPA eComms - use-case tests (Phase 5 validation, re-run after the requirements revision).
// Each test records: id, use case, steps, test data, expected, actual, PASS/FAIL.
// Run against a FRESH database (the tests change the data):
//   npm run db:setup   then   npm start   then   BASE=http://localhost:3000 node docs/phase5/run-tests.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3000';
const APP = process.env.APPDIR || path.resolve(__dirname, '../..');
const PASSWORD = 'Lpa#2026';
const results = [];
const jar = {}; // user -> cookie header
const csrf = {}; // user -> CSRF token (read from the page, like the browser does)

function rec(id, title, steps, data, expected, actual, pass) {
  results.push({ id, title, steps, data, expected, actual, result: pass ? 'PASS' : 'FAIL' });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${title}  ->  ${actual}`);
}
async function req(who, method, p, { form, json, accept } = {}, extra = {}) {
  const headers = { cookie: jar[who] || '' };
  if (method !== 'GET' && csrf[who] && !extra.noCsrf) headers['x-csrf-token'] = csrf[who];
  let body;
  if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
  if (json !== undefined) { headers['content-type'] = 'application/json'; body = typeof json === 'string' ? json : JSON.stringify(json); }
  if (accept) headers.accept = accept;
  const t = Date.now();
  const r = await fetch(BASE + p, { method, redirect: 'manual', headers, body });
  const text = await r.text();
  return { status: r.status, loc: r.headers.get('location'), text, ms: Date.now() - t, headers: r.headers, json: () => JSON.parse(text) };
}
const get = (who, p, o) => req(who, 'GET', p, o);
const post = (who, p, o) => req(who, 'POST', p, o);
const J = { accept: 'application/json' };
async function login(who, username, password = PASSWORD) {
  const r = await fetch(BASE + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password }).toString() });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  jar[who] = sc.map(c => c.split(';')[0]).filter(c => !c.endsWith('=')).join('; ');
  if (jar[who]) {
    const page = await fetch(BASE + '/more', { headers: { cookie: jar[who] } }).then(x => x.text());
    csrf[who] = (page.match(/name="csrf-token" content="([0-9a-f]+)"/) || [])[1] || '';
  }
  return { status: r.status, loc: r.headers.get('location'), setCookie: sc };
}
const count = (html, re) => (html.match(re) || []).length;
const firstLedger = html => { const m = html.match(/<ul class="ledger big">([\s\S]*?)<\/li>/); return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/&middot;/g, '·').replace(/&rarr;/g, '→').replace(/\s+/g, ' ').trim() : ''; };

(async () => {
  // ---------- sign-in ----------
  let x = await get('anon', '/products');
  rec('UC-03', 'Protected page requires sign-in', 'Open /products without signing in', 'none', 'Redirect (302) to /login', `${x.status} -> ${x.loc}`, x.status === 302 && x.loc === '/login');

  let r = await post('anon', '/login', { form: { username: 'palvim', password: '' } });
  rec('UC-02', 'Login rejected with blank password', 'Enter user name, leave password blank, press Login', 'palvim / (blank)', 'Stay on login page with "Please enter a username and password"', `${r.status} -> ${r.loc}`, r.status === 302 && r.loc === '/login?error=1');

  const runStart = new Date(Date.now() - 1000); // activity events from this run (MongoDB activity_log)
  r = await post('anon', '/login', { form: { username: 'palvim', password: 'wrong-pass1' } });
  const failCookie = (r.headers.get('set-cookie') || '').includes('lpa_sid=');
  rec('UC-02b', 'Login rejected with wrong password', 'Enter a valid user name with a wrong password', 'palvim / wrong-pass1', 'Not signed in; "Login failed" message; attempt logged', `${r.status} -> ${r.loc}; session cookie set = ${failCookie}`, r.status === 302 && /error=2/.test(r.loc) && !failCookie);

  const a = await login('admin', 'palvim');
  const sid = a.setCookie.find(c => c.startsWith('lpa_sid=')) || '';
  rec('UC-01', 'Login with user name and password', 'Enter user name and password, press Login', 'palvim / Lpa#2026', 'Signed in (HttpOnly session cookie) and taken to Home', `${a.status} -> ${a.loc}; cookie HttpOnly = ${/HttpOnly/i.test(sid)}, random token = ${/lpa_sid=[0-9a-f]{64}/.test(sid)}`, a.status === 302 && a.loc === '/' && /HttpOnly/i.test(sid) && /lpa_sid=[0-9a-f]{64}/.test(sid));
  await login('staff', 'mchang');
  await login('cust', 'aturner');

  // ---------- home + personalisation ----------
  x = await get('admin', '/');
  const stats = ['8', '3', '1', '6', '$803.50'].every(v => x.text.includes(v)) && x.text.includes('Stock items') && /promo\.mp4/.test(x.text);
  rec('UC-05', 'Home page shows business summary + promo video', 'Sign in as staff/admin, open Home', 'seed data', '8 items, 3 low, 1 out, 6 invoices, $803.50 total sales; video present', stats ? '8 / 3 / 1 / 6 / $803.50 shown; promo video embedded' : 'values missing', stats);

  const welcomeAdmin = /Welcome, <strong>Pedro Alvim<\/strong>/.test(x.text) && x.text.includes('Administrator');
  const sx = await get('staff', '/more'); const cx = await get('cust', '/');
  const custNav = ['/shop', '/cart', '/orders'].every(h => cx.text.includes(`href="${h}"`)) && !cx.text.includes('href="/products"');
  rec('UC-29', 'Personalised header and menus by user group', 'Sign in as admin, staff and customer; look at header and menus', 'palvim / mchang / aturner', 'Welcome + name + group; customers get Shop/Cart/Orders; Users only for admins', `admin welcome = ${welcomeAdmin}; staff More has Users = ${sx.text.includes('href="/users"')}; customer nav = ${custNav}; customer welcome = ${/Welcome, <strong>Alex Turner/.test(cx.text)}`,
    welcomeAdmin && !sx.text.includes('href="/users"') && custNav && /Welcome, <strong>Alex Turner/.test(cx.text));

  const times = [];
  for (let i = 0; i < 5; i++) times.push((await get('admin', '/')).ms);
  const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
  rec('UC-24', 'Home page response time', 'Request Home 5 times, average the time', '5 requests', 'Average under 500 ms', `average ${avg} ms (max ${Math.max(...times)} ms)`, avg < 500);

  // ---------- access control ----------
  const checks = [['staff', '/users'], ['staff', '/products/new'], ['staff', '/sales/new'], ['cust', '/products'], ['cust', '/sales'], ['cust', '/clients'], ['cust', '/api/stock/LPA-001'], ['admin', '/cart']];
  const codes = [];
  for (const [who, p] of checks) codes.push(`${who} ${p} ${(await get(who, p)).status}`);
  const staffOk = (await get('staff', '/products')).status === 200;
  rec('UC-28', 'Pages limited by user group', 'Open admin pages as staff, staff pages as a customer', checks.map(c => c.join(' ')).join('; '), 'All refused with 403; staff can still view stock', `${codes.join('; ')}; staff /products ${staffOk ? 200 : 'refused'}`, codes.every(c => c.endsWith(' 403')) && staffOk);

  // ---------- stock (staff view, admin manage) ----------
  x = await get('staff', '/products');
  const allEight = [1, 2, 3, 4, 5, 6, 7, 8].every(n => x.text.includes(`LPA-00${n}`));
  rec('UC-06', 'Stock list shows all items with key fields', 'Open Stock', 'seed data (8 items)', 'All 8 items listed with SKU, name, price, qty and status badge', `${allEight ? '8 of 8' : 'missing'} SKUs; In/Low/Out badges = ${/In stock/.test(x.text) && /Low stock/.test(x.text) && /Out of stock/.test(x.text)}`, allEight && /Out of stock/.test(x.text));

  x = await get('staff', '/products?q=webcam');
  const hits = [1, 2, 3, 4, 5, 6, 7, 8].filter(n => x.text.includes(`LPA-00${n}`));
  rec('UC-07', 'Search stock', 'Type "webcam" in search, press Search', 'q = webcam', 'Only 1080p HD Webcam CV-10 (LPA-005) shown', `${hits.length} result(s): ${hits.map(n => 'LPA-00' + n).join(', ')}`, hits.length === 1 && hits[0] === 5);

  r = await post('admin', '/products', { form: { sku: 'LPA-009', title: 'Wireless Presenter WP-5', brand: 'Orbit', category: 'Accessories', price: '29.90', quantity: '10', status: 'active', description: 'Laser presenter with USB receiver.' } });
  const newId = (r.loc || '').split('/').pop();
  x = await get('admin', r.loc || '/');
  rec('UC-08', 'Add a new stock item (administrator)', 'Stock > Add item, fill the form, Save', 'LPA-009 Wireless Presenter WP-5, $29.90, qty 10', 'Item saved and its detail page shown', `${r.status} -> ${r.loc}; detail shows item = ${x.text.includes('Wireless Presenter WP-5')}`, r.status === 302 && /\/products\/LPA-009$/.test(r.loc || '') && x.text.includes('Wireless Presenter WP-5'));

  r = await post('admin', '/products', { form: { title: '', brand: '', price: '5' } });
  const dup = await post('admin', '/products', { form: { sku: 'lpa-001', title: 'Copy', brand: 'X', price: '1' } });
  rec('UC-09a', 'Invalid stock item rejected by the server', 'Submit with no name; then with an existing Stock ID', 'title = ""; SKU = lpa-001', 'Not saved (400) with a clear message each time', `empty name ${r.status} "${/product name and a brand/.test(r.text)}"; duplicate ID ${dup.status} "${/already exists/.test(dup.text)}"`, r.status === 400 && dup.status === 400 && /already exists/.test(dup.text));

  await post('admin', `/products/${newId}?_method=PUT`, { form: { title: 'Wireless Presenter WP-5', brand: 'Orbit', price: '24.90', quantity: '10', status: 'active' } });
  let j = (await get('admin', `/products/${newId}`, J)).json();
  rec('UC-10', 'Edit a stock item and save', 'Open item > Edit, change price, Save', 'price 29.90 -> 24.90', 'New price saved', `price now ${j.price}`, j.price === 24.9);

  await post('admin', `/products/${newId}?_method=PUT`, { form: { status: 'disabled' } });
  j = (await get('admin', `/products/${newId}`, J)).json();
  rec('UC-11', 'Disable a stock item', 'Edit item, set status Disabled, Save', 'status = disabled', 'Item status is disabled (and it leaves the shop)', `status now "${j.status}"`, j.status === 'disabled');

  await post('staff', '/products/LPA-002/adjust', { form: { operation: 'add', quantity: '5', reason: 'Restocked from primary shipment' } });
  j = (await get('staff', '/products/LPA-002', J)).json();
  const led = await get('staff', '/stock/ledger');
  const top = firstLedger(led.text);
  rec('UC-12', 'Stock adjustment - add (staff)', 'Signed in as staff: item WM-200 > Add stock 5, reason "Restocked", Submit', 'qty 7 + 5', 'On hand becomes 12; newest audit entry is this adjustment', `on hand ${j.quantity}; newest entry = "${top.slice(0, 70)}..."`, j.quantity === 12 && /Wireless Optical Mouse WM-200/.test(top));
  rec('UC-25', 'Audit history records who and when', 'After UC-12, open Stock > Audit history', 'signed in as mchang (Michael Chang)', 'Newest entry shows the signed-in user and a time', `user shown = ${/Michael Chang/.test(top)}; time shown = ${/\d{1,2}:\d{2}\s?[AP]M/i.test(top)}`, /Michael Chang/.test(top) && /\d{1,2}:\d{2}\s?[AP]M/i.test(top));

  await post('staff', '/products/LPA-008/adjust', { form: { operation: 'remove', quantity: '50', reason: 'Damaged / write-off' } });
  j = (await get('staff', '/products/LPA-008', J)).json();
  rec('UC-13', 'Stock can never go negative', 'Item LPA-008 (on hand 2) > Remove 50', 'qty 2 - 50', 'On hand stops at 0 (not -48)', `on hand ${j.quantity}`, j.quantity === 0);

  await post('staff', '/products/LPA-008/adjust', { form: { operation: 'reconcile', quantity: '10', reason: 'Physical inventory count' } });
  j = (await get('staff', '/products/LPA-008', J)).json();
  rec('UC-14', 'Stock reconcile to a counted total', 'Item LPA-008 > Reconcile to 10', 'counted = 10', 'On hand set to exactly 10', `on hand ${j.quantity}`, j.quantity === 10);

  r = await post('admin', `/products/${newId}?_method=DELETE`);
  x = await get('admin', `/products/${newId}`);
  const listed = (await get('admin', '/products')).text.includes('LPA-009');
  rec('UC-15', 'Delete a stock item (administrator)', 'Open LPA-009 > Delete > confirm', `item id ${newId}`, 'Item hidden from stock (soft delete, history kept); opening it returns 404', `delete ${r.status} -> ${r.loc}; reopen = ${x.status}; still listed = ${listed}`, r.status === 302 && x.status === 404 && !listed);

  // ---------- sales (before any new orders) ----------
  x = await get('staff', '/sales');
  rec('UC-16', 'Sales & Invoicing lists invoices with total', 'Open Sales', 'seed data (6 invoices)', '6 invoices with Date, Client, Amount; Total $803.50', `${count(x.text, /href="\/sales\/INV-10\d\d"/g)} invoices; total $803.50 = ${x.text.includes('$803.50')}`, count(x.text, /href="\/sales\/INV-10\d\d"/g) === 6 && x.text.includes('$803.50'));
  x = await get('staff', '/sales?q=DevWorks');
  const byDate = await get('staff', '/sales?q=2026-08-01');
  rec('UC-17', 'Search invoices (client, date)', 'Search "DevWorks"; then search "2026-08-01"', 'q = DevWorks; q = 2026-08-01', 'DevWorks: 2 invoices, total $220.00; date: 1 invoice (INV-1004)', `DevWorks ${count(x.text, /href="\/sales\/INV/g)} / $220.00 = ${x.text.includes('$220.00')}; date ${count(byDate.text, /href="\/sales\/INV/g)}`, count(x.text, /href="\/sales\/INV/g) === 2 && x.text.includes('$220.00') && count(byDate.text, /href="\/sales\/INV/g) === 1);

  x = await get('staff', '/clients');
  const s = await get('staff', '/clients?q=Northgate');
  rec('UC-18', 'Client records with address; search', 'Open Clients; search "Northgate"', 'q = Northgate', 'Address shown; 1 client (CL-004) found', `address shown = ${x.text.includes('Indooroopilly')}; results = ${count(s.text, /CL-00\d/g)}`, x.text.includes('Indooroopilly') && count(s.text, /CL-00\d/g) === 1);

  x = await get('staff', '/products', J);
  let arr = []; try { arr = JSON.parse(x.text); } catch (e) {}
  rec('UC-20', 'Stock available as JSON (API)', 'GET /products with Accept: application/json', 'Accept: application/json', 'JSON array of stock items', `status ${x.status}; ${Array.isArray(arr) ? arr.length + ' items' : 'not JSON'}`, x.status === 200 && Array.isArray(arr) && arr.length >= 8);

  const m1 = await get('cust', '/mashups/store-locator'), m2 = await get('cust', '/mashups/pricing'), about = await get('cust', '/mashups');
  rec('UC-23', 'Mashup pages and About LPA open', 'Open More > About LPA, Store locator, Pricing', 'none', 'All load (200); About shows LPA mission', `store-locator ${m1.status}, pricing ${m2.status}, about ${about.status}, mission = ${/Our mission/.test(about.text)}`, m1.status === 200 && m2.status === 200 && /Our mission/.test(about.text));

  const help = await Promise.all(['admin', 'staff', 'cust'].map(w => get(w, '/help')));
  rec('UC-44', 'Help guide for each user group', 'Open More > Help as admin, staff and customer', '3 roles', 'Help explains each menu; your own group is highlighted', help.map((h, i) => `${['admin', 'staff', 'cust'][i]} ${h.status}`).join(', ') + `; highlight = ${help.every(h => /help-block is-you/.test(h.text))}`, help.every(h => h.status === 200 && /help-block is-you/.test(h.text)));

  // ---------- data integrity ----------
  // read the live data from the running server (not the model files)
  const liveInv = [];
  for (const i of (await get('staff', '/sales', J)).json().invoices) liveInv.push((await get('staff', '/sales/' + i.number, J)).json());
  const liveClients = (await get('staff', '/clients')).text;
  const orphans = liveInv.filter(i => !i.clientId || !liveClients.includes(i.clientId));
  rec('UC-19', 'Every invoice points to an existing client', 'Check each invoice clientId against the client list', '6 invoices', '0 invoices without a valid client', `${orphans.length} orphan invoice(s)`, orphans.length === 0);
  const bad = liveInv.filter(i => !i.items.length || Math.abs(i.items.reduce((t, l) => t + l.qty * l.price, 0) - i.amount) > 0.001);
  rec('UC-27', 'Invoices have line items that add up', 'For each invoice compare the amount with the sum of its line items', `${liveInv.length} invoices`, 'Every invoice has >= 1 item and amount = sum of (qty x price)', `${bad.length} invoice(s) wrong; ${liveInv.reduce((n, i) => n + i.items.length, 0)} line items checked`, bad.length === 0);

  // ---------- registration ----------
  r = await post('anon', '/register', { form: { firstName: 'Sam', lastName: 'Rivera', address: '22 Wharf St, Brisbane City QLD 4000', phone: '0400 111 222', username: 'aturner', password: 'short', confirmPassword: 'other' } });
  rec('UC-31', 'Registration rejects bad input', 'Register with a taken user name, short password and mismatched confirmation', 'aturner / "short" / "other"', 'Not saved (400) with a message for each problem', `${r.status}; taken = ${/already taken/.test(r.text)}, length = ${/at least 8/.test(r.text)}, match = ${/must match/.test(r.text)}`, r.status === 400 && /already taken/.test(r.text) && /at least 8/.test(r.text) && /must match/.test(r.text));
  r = await post('anon', '/register', { form: { firstName: 'Sam', lastName: 'Rivera', address: '22 Wharf St, Brisbane City QLD 4000', phone: '0400 111 222', username: 'srivera', password: 'Shop2026x', confirmPassword: 'Shop2026x', privacy: 'yes' } });
  const reg = await login('sam', 'srivera', 'Shop2026x');
  const samClient = ((await get('staff', '/clients?q=Rivera')).text.match(/CL-\d{3}/) || [])[0];
  rec('UC-30', 'Customer registration', 'Login page > Create an account; fill in details; Register; then sign in', 'Sam Rivera / srivera / Shop2026x', 'Account + client record created; customer can sign in and lands in the shop', `register ${r.status} -> ${r.loc}; client ${samClient || 'none'}; login -> ${reg.loc}`, r.status === 302 && /registered=1/.test(r.loc) && !!samClient && reg.loc === '/shop');

  // ---------- passwords ----------
  // read the stored hashes straight from the lpa_users table (what an attacker would see in a leak)
  const db = require(APP + '/config/database.js');
  const stored = await db.query('SELECT lpa_user_username AS username, lpa_user_password AS hash FROM lpa_users');
  const plain = stored.filter(u => !/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(u.hash) || u.hash.includes(PASSWORD));
  const uniqueSalts = new Set(stored.map(u => u.hash.split('$')[1])).size === stored.length;
  rec('UC-43', 'Passwords are stored as salted hashes', 'SELECT lpa_user_password FROM lpa_users', `${stored.length} users`, 'Every password is a scrypt hash with its own salt; no plain text', `${plain.length} plain/invalid; salts unique = ${uniqueSalts}`, plain.length === 0 && uniqueSalts);
  await db.pool.end();

  // ---------- web store ----------
  x = await get('cust', '/shop?sort=price-asc', J);
  const shop = x.json();
  const prices = shop.map(p => p.price);
  const sorted = prices.every((v, i) => i === 0 || v >= prices[i - 1]);
  rec('UC-32', 'Shop lists active items, sortable by price', 'Shop > sort "Price: low to high"', 'sort = price-asc', 'Only active items (no disabled headset); prices in ascending order', `${shop.length} items; headset shown = ${shop.some(p => p.sku === 'LPA-006')}; ascending = ${sorted} (${prices.join(', ')})`, sorted && !shop.some(p => p.sku === 'LPA-006') && shop.length === 7);

  r = await post('cust', '/cart', { json: { sku: 'LPA-004', qty: 5 }, accept: 'application/json' });
  const r2 = await post('cust', '/cart', { json: { sku: 'LPA-004', qty: 2 }, accept: 'application/json' });
  const r3 = await post('cust', '/cart', { json: { sku: 'LPA-003', qty: 1 }, accept: 'application/json' });
  rec('UC-33', 'Cart quantity limited to stock on hand', 'Add 5 of the dock (4 on hand); add 2; add the out-of-stock monitor', 'LPA-004 x5, x2; LPA-003 x1', '5 refused; 2 accepted; monitor refused (out of stock)', `x5 ${r.status} "${(JSON.parse(r.text).error || '')}"; x2 ${r2.status} (cart ${JSON.parse(r2.text).count}); monitor ${r3.status}`, r.status === 409 && r2.status === 200 && r3.status === 409);

  await post('cust', '/cart', { json: { sku: 'LPA-005', qty: 1 }, accept: 'application/json' });
  r = await post('cust', '/cart/LPA-005', { json: { qty: 3 }, accept: 'application/json' });
  const upd = JSON.parse(r.text);
  const over = await post('cust', '/cart/LPA-004', { json: { qty: 99 }, accept: 'application/json' });
  rec('UC-35', 'Cart totals recalculated on the server', 'Cart: change webcam qty to 3; then set dock qty to 99', 'LPA-005 qty 3; LPA-004 qty 99', 'Total = 2 x $149 + 3 x $69 = $505.00, GST $45.91; qty 99 refused', `total $${upd.total} GST $${upd.gst}; qty 99 -> ${over.status}`, upd.total === 505 && upd.gst === 45.91 && over.status === 400);

  r = await post('cust', '/checkout', { form: { address: '7 Park Rd, Milton QLD 4064', phone: '0412 345 678', payment: '' } });
  rec('UC-36', 'Checkout needs a payment option', 'Checkout without choosing a payment option', 'payment = (none)', 'Order not placed (400): "Choose a payment option"', `${r.status}; message = ${/Choose a payment option/.test(r.text)}`, r.status === 400 && /Choose a payment option/.test(r.text));

  const dockBefore = (await get('admin', '/api/stock/LPA-004', J)).json().onHand;
  r = await post('cust', '/checkout', { form: { address: '7 Park Rd, Milton QLD 4064', phone: '0412 345 678', payment: 'Visa', expectedTotal: '505.00' } });
  const orderNo = (r.loc || '').split('/').pop().split('?')[0];
  const ov = await get('admin', '/sales/' + orderNo, J); const order = ov.status === 200 ? ov.json() : null;
  const dockAfter = (await get('admin', '/api/stock/LPA-004', J)).json().onHand;
  const cartAfter = (await get('cust', '/cart')).text;
  const myOrders = (await get('cust', '/orders')).text;
  const ledgerSold = firstLedger((await get('admin', '/stock/ledger')).text);
  rec('UC-37', 'Place an order', 'Checkout > choose Visa > Place order > confirm', 'cart: 2 x LPA-004, 3 x LPA-005', 'Invoice for CL-006 ($505.00), stock reduced, audit entry "Sold", cart emptied, shown in My orders',
    `${r.status} -> ${r.loc}; ${order ? order.number + ' ' + order.clientId + ' $' + order.amount.toFixed(2) : 'no invoice'}; dock ${dockBefore} -> ${dockAfter}; cart empty = ${/Your cart is empty/.test(cartAfter)}; in My orders = ${myOrders.includes(orderNo)}; audit "${ledgerSold.match(/Sold - INV-\d+/) || ''}"`,
    r.status === 302 && order && order.clientId === 'CL-006' && order.amount === 505 && dockAfter === dockBefore - 2 && /Your cart is empty/.test(cartAfter) && myOrders.includes(orderNo) && ledgerSold.includes('Sold - ' + orderNo));

  const other = await get('cust', '/orders/INV-1001');
  const samSees = await get('sam', '/orders/' + orderNo);
  rec('UC-38', 'Customers see only their own orders', "Open someone else's order as a customer", 'aturner -> INV-1001; srivera -> ' + orderNo, 'Not found (404) both times', `aturner/INV-1001 ${other.status}; srivera/${orderNo} ${samSees.status}`, other.status === 404 && samSees.status === 404);

  // ---------- new invoice (administrator) ----------
  const cl = (await get('admin', '/api/clients/cl-004', J)).json();
  const st = (await get('admin', '/api/stock/lpa-002', J)).json();
  const mouseBefore = st.onHand;
  r = await post('admin', '/sales', { json: { clientId: 'CL-004', date: '2026-10-05', items: [{ sku: 'LPA-002', qty: 2, price: 0.01 }, { sku: 'LPA-007', qty: 1 }] }, accept: 'application/json' });
  const created = r.status === 201 ? (await get('admin', '/sales/' + r.json().number, J)).json() : null;
  const mouseAfter = (await get('admin', '/api/stock/LPA-002', J)).json().onHand;
  rec('UC-39', 'New invoice (administrator)', 'Sales > Add: search client CL-004, add LPA-002 x2 and LPA-007 x1, Save', 'sent a fake price of $0.01 for LPA-002', 'Invoice saved with catalogue prices ($39.50 x2 + $34.00 = $113.00); stock reduced',
    `lookups: ${cl.name} / ${st.name}; ${r.status} ${created ? created.number + ' $' + created.amount.toFixed(2) : ''}; mouse ${mouseBefore} -> ${mouseAfter}`, r.status === 201 && created && created.amount === 113 && mouseAfter === mouseBefore - 2);

  r = await post('admin', '/sales', { json: { clientId: 'CL-005', items: [{ sku: 'LPA-008', qty: 500 }] }, accept: 'application/json' });
  const errs = r.status === 400 ? r.json().errors : [];
  rec('UC-40', 'New invoice rejects bad input', 'Save an invoice for disabled client CL-005 with 500 cables', 'CL-005; LPA-008 x500', 'Refused (400): client disabled; not enough stock', `${r.status}; ${errs.join(' | ')}`, r.status === 400 && errs.some(e => /disabled/.test(e)) && errs.some(e => /on hand/.test(e)));

  const mouseBeforeDel = (await get('admin', '/api/stock/LPA-002', J)).json().onHand;
  r = await post('admin', `/sales/${created.number}?_method=DELETE`);
  const mouseAfterDel = (await get('admin', '/api/stock/LPA-002', J)).json().onHand;
  const gone = (await get('admin', '/sales/' + created.number)).status;
  rec('UC-41', 'Delete an invoice returns its stock', `Open ${created.number} > Delete > confirm`, created.number, 'Invoice removed (404); 2 mice back in stock', `${r.status} -> ${r.loc}; reopen ${gone}; mouse ${mouseBeforeDel} -> ${mouseAfterDel}`, r.status === 302 && gone === 404 && mouseAfterDel === mouseBeforeDel + 2);

  // ---------- users management ----------
  r = await post('admin', '/users', { form: { username: 'kpatel', firstName: 'Kiran', lastName: 'Patel', group: 'user', status: 'active', password: 'Staff2026x' } });
  const kp = { id: ((await get('admin', '/users?q=kpatel')).text.match(/U-\d{3}/) || [])[0] };
  const kpLogin1 = await login('kp', 'kpatel', 'Staff2026x');
  await post('admin', `/users/${kp.id}?_method=PUT`, { form: { username: 'kpatel', firstName: 'Kiran', lastName: 'Patel', group: 'user', status: 'inactive', password: '' } });
  const kpLogin2 = await login('kp2', 'kpatel', 'Staff2026x');
  await post('admin', `/users/${kp.id}?_method=DELETE`);
  const listedAfter = (await get('admin', '/users')).text.includes('kpatel');
  const self = await post('admin', '/users/U-001?_method=DELETE');
  rec('UC-42', 'Users management (administrator)', 'Users > Add staff user; sign in; set Inactive; Delete; try to delete own account', 'kpatel / Staff2026x', 'Added user can sign in; inactive user cannot; deleted user leaves the list; own account cannot be deleted',
    `add ${r.status}; login active -> ${kpLogin1.loc}; login inactive -> ${kpLogin2.loc}; listed after delete = ${listedAfter}; self-delete -> ${decodeURIComponent(self.loc || '')}`,
    r.status === 302 && kpLogin1.loc === '/' && /error=2/.test(kpLogin2.loc) && !listedAfter && /cannot delete your own/.test(decodeURIComponent(self.loc || '')));

  // ---------- web security (ICTWEB514) ----------
  const forged = await req('admin', 'POST', '/products', { form: { title: 'Forged', brand: 'X', price: '1' } }, { noCsrf: true });
  const forgedJson = await req('cust', 'POST', '/cart', { json: { sku: 'LPA-001', qty: 1 }, accept: 'application/json' }, { noCsrf: true });
  rec('UC-47', 'Forged requests refused (CSRF)', 'Send a POST without the page\'s CSRF token (as a forged cross-site request would)', 'admin add item; customer add to cart', 'Both refused with 403; nothing changed', `add item ${forged.status}; add to cart ${forgedJson.status}`, forged.status === 403 && forgedJson.status === 403);

  const hx = await get('admin', '/');
  const csp = hx.headers.get('content-security-policy') || '';
  const hdrOk = /default-src 'self'/.test(csp) && /script-src 'self' 'nonce-/.test(csp) && /frame-ancestors 'none'/.test(csp) && hx.headers.get('x-content-type-options') === 'nosniff' && hx.headers.get('x-frame-options') === 'DENY' && !hx.headers.get('x-powered-by');
  rec('UC-48', 'Security headers on every page', 'Read the response headers of Home', 'GET /', 'CSP (own scripts + nonce, no framing), nosniff, X-Frame-Options DENY, no X-Powered-By', `CSP = ${csp ? 'yes' : 'no'}; nosniff = ${hx.headers.get('x-content-type-options')}; frame = ${hx.headers.get('x-frame-options')}; powered-by = ${hx.headers.get('x-powered-by') || 'hidden'}`, hdrOk);

  r = await post('admin', '/products', { form: { sku: 'LPA-099', title: '<script>alert(1)</script>Test', brand: '<b>Bold</b>', price: '1', quantity: '0', status: 'disabled' } });
  const xp = await get('admin', '/products');
  const escaped = xp.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;Test') && !xp.text.includes('<script>alert(1)</script>');
  await post('admin', (r.loc || '/products/0') + '?_method=DELETE');
  rec('UC-49', 'Typed HTML/script is shown as text (XSS)', 'Add a stock item whose name contains a <script> tag; open the stock list', 'title = <script>alert(1)</script>Test', 'Shown as harmless text (escaped), never run', `escaped in page = ${escaped}`, escaped);

  // ---------- error handling + logging ----------
  r = await post('admin', '/sales', { json: '{"clientId": "CL-001", bad json', accept: 'application/json' });
  rec('UC-45', 'Errors do not leak internal details', 'Send broken JSON to /sales', '{"clientId": "CL-001", bad json', 'Plain error (400), no stack trace or file paths', `${r.status} ${r.text.slice(0, 60)}; leaks paths = ${/\/root\/|node_modules|at [A-Z]\w+\./.test(r.text)}`, r.status === 400 && !/\/root\/|node_modules|at [A-Z]\w+\./.test(r.text));

  await new Promise(r => setTimeout(r, 300)); // log writes do not block the response
  const log = (await get('admin', '/activity?limit=500', J)).json().events.filter(e => new Date(e.at) >= runStart).map(e => e.message).join('\n');
  rec('UC-46', 'Activity log records key events', 'Read the activity log (MongoDB activity_log, /activity) after the test run', 'this run', 'Failed login, logins, registration, order and invoice events written', `failed = ${/LOGIN FAILED for user "palvim"/.test(log)}, login = ${/LOGIN palvim/.test(log)}, register = ${/REGISTER srivera/.test(log)}, order = ${/ORDER INV-\d+ by aturner/.test(log)}, invoice = ${/INVOICE INV-\d+ created/.test(log)}`,
    /LOGIN FAILED for user "palvim"/.test(log) && /LOGIN palvim/.test(log) && /REGISTER srivera/.test(log) && /ORDER INV-\d+ by aturner/.test(log) && /INVOICE INV-\d+ created/.test(log));

  // ---------- browser checks ----------
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const anon = await browser.newPage();
  await anon.goto(BASE + '/login');
  const ptype = await anon.getAttribute('#password', 'type');
  rec('UC-04', 'Password is masked', 'Open login page, inspect password field', 'type "secret"', 'Characters hidden (input type = password)', `input type = "${ptype}"`, ptype === 'password');

  const asUser = async who => { const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } }); await ctx.addCookies(jar[who].split('; ').map(c => { const [name, ...v] = c.split('='); return { name, value: v.join('='), url: BASE }; })); return ctx.newPage(); };
  const page = await asUser('admin');
  await page.goto(BASE + '/products/new');
  await page.click('form button[type=submit]');
  const msg = await page.$eval('input[name=title]', el => el.validationMessage);
  rec('UC-09b', 'Add form validates before sending (client)', 'Open Add item, press Save with empty fields', 'all fields empty', 'Form not submitted; browser shows "fill out this field"', `stayed on form = ${page.url().endsWith('/products/new')}; message = "${msg}"`, page.url().endsWith('/products/new') && msg.length > 0);

  const cpage = await asUser('sam');
  await cpage.goto(BASE + '/shop');
  await cpage.locator('.add-form[data-sku="LPA-007"] button').click();
  await cpage.waitForSelector('dialog.confirm-dialog[open]');
  const dlg = await cpage.textContent('dialog.confirm-dialog');
  await cpage.click('dialog [data-cancel]');
  const badgeAfterCancel = await cpage.textContent('#cart-badge');
  await cpage.locator('.add-form[data-sku="LPA-007"] button').click();
  await cpage.click('dialog [data-ok]');
  await cpage.waitForSelector('#shop-msg:not([hidden])');
  const badge = await cpage.textContent('#cart-badge');
  rec('UC-34', 'Price shown and confirmed before adding to cart', 'Shop > Add to cart on the numpad; Cancel; then Add to cart again and confirm', 'LPA-007 x1', 'Dialog shows quantity, price and total; Cancel adds nothing; confirm adds it (badge 1)', `dialog: "${dlg.replace(/\s+/g, ' ').trim().slice(0, 80)}"; after cancel badge ${badgeAfterCancel}; after confirm badge ${badge}`, /\$34\.00/.test(dlg) && badgeAfterCancel === '0' && badge === '1');

  await page.goto(BASE + '/settings');
  await page.check('input[name="pref-theme"][value="dark"]');
  await page.goto(BASE + '/');
  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  rec('UC-22', 'Theme preference is remembered', 'Settings > choose Dark, then open Home', 'theme = dark', 'Home opens in dark theme', `data-theme = "${theme}"`, theme === 'dark');
  await page.evaluate(() => localStorage.clear());

  await page.goto(BASE + '/logout');
  await page.goto(BASE + '/products');
  rec('UC-21', 'Logout ends the session', 'Press Logout, then try to open Stock', 'none', 'Sent back to the login page', `landed on ${new URL(page.url()).pathname}`, new URL(page.url()).pathname === '/login');
  await browser.close();

  results.push({ id: 'UC-26', title: 'Mobile app opens the LPA interface', steps: 'Install APK on Pixel 7 emulator, open LPA eComms', data: 'emulator API 34, server on :3000', expected: 'Splash screen for ~2 s, then login page inside the app', actual: 'Static check passed (APK launch activity = SplashActivity; INTERNET permission). On-device run to be recorded.', result: 'PENDING' });

  const order2 = t => { const m = t.id.match(/UC-(\d+)(\w?)/); return Number(m[1]) * 10 + (m[2] ? m[2].charCodeAt(0) - 96 : 0); };
  results.sort((p, q) => order2(p) - order2(q));
  fs.writeFileSync(process.env.OUT || path.join(__dirname, 'test-results-after-revision.json'), JSON.stringify(results, null, 2));
  const P = results.filter(t => t.result === 'PASS').length, F = results.filter(t => t.result === 'FAIL').length;
  console.log(`\n${P} PASS, ${F} FAIL, ${results.length - P - F} PENDING of ${results.length}`);
})().catch(e => { console.error(e); process.exit(1); });
