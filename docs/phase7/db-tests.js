// ICTDBS507 (Phase 7) - database integration tests.
// Checks every CRUD operation through the web app AND directly in MySQL, plus validation,
// SQL-injection attempts, transactions (rollback + two buyers at once), foreign keys,
// persistence after a restart, "database down" handling, credentials and the export.
//   npm run db:setup  ->  npm start  ->  BASE=http://localhost:3000 node docs/phase7/db-tests.js
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const APP = path.resolve(__dirname, '../..');
const db = require(APP + '/config/database.js');
const BASE = process.env.BASE || 'http://localhost:3000';
const results = [];
const jar = {}, csrf = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

function rec(id, title, steps, sql, expected, actual, pass) {
  results.push({ id, title, steps, sql, expected, actual, result: pass ? 'PASS' : 'FAIL' });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${title}  ->  ${actual}`);
}
async function req(who, method, p, { form, json, accept } = {}, base = BASE) {
  const headers = { cookie: jar[who] || '' };
  if (method !== 'GET' && csrf[who]) headers['x-csrf-token'] = csrf[who];
  let body;
  if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
  if (json !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
  if (accept) headers.accept = accept;
  const r = await fetch(base + p, { method, redirect: 'manual', headers, body });
  const text = await r.text();
  return { status: r.status, loc: r.headers.get('location'), text, json: () => JSON.parse(text) };
}
const get = (w, p, o, b) => req(w, 'GET', p, o, b);
const post = (w, p, o, b) => req(w, 'POST', p, o, b);
const J = { accept: 'application/json' };
async function login(who, username, password = 'Lpa#2026', base = BASE) {
  const r = await fetch(base + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password }).toString() });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  jar[who] = sc.map(c => c.split(';')[0]).filter(c => !c.endsWith('=')).join('; ');
  if (jar[who]) {
    const page = await fetch(base + '/more', { headers: { cookie: jar[who] } }).then(x => x.text());
    csrf[who] = (page.match(/name="csrf-token" content="([0-9a-f]+)"/) || [])[1] || '';
  }
  return r;
}
const one = async (sql, params) => (await db.query(sql, params))[0];
function startServer(port, env = {}) {
  const child = spawn(process.execPath, ['server.js'], { cwd: APP, env: Object.assign({}, process.env, { PORT: String(port) }, env), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  return { child, log: () => out, url: `http://localhost:${port}` };
}

(async () => {
  await login('admin', 'palvim');
  await login('staff', 'mchang');
  await login('cust', 'aturner');

  // ---------- connection + credentials ----------
  const who = await one('SELECT CURRENT_USER() AS u, DATABASE() AS d, VERSION() AS v');
  const grants = (await db.query('SHOW GRANTS')).map(g => Object.values(g)[0]).join(' | ');
  let dropErr = '';
  try { await db.query('DROP TABLE lpa_stock_ledger'); } catch (e) { dropErr = e.code; }
  rec('DB-01', 'App connects with a limited account', 'config/database.js opens a pool with the .env settings; try a DROP TABLE as the app',
    'SELECT CURRENT_USER(); SHOW GRANTS; DROP TABLE lpa_stock_ledger', 'Connected as lpa_app with SELECT/INSERT/UPDATE/DELETE only; DROP refused',
    `${who.u} on ${who.d} (${who.v}); grants: ${/SELECT, INSERT, UPDATE, DELETE ON `lpa_ecomms`/.test(grants) ? 'SELECT, INSERT, UPDATE, DELETE' : grants}; DROP -> ${dropErr || 'allowed!'}`,
    /^lpa_app@/.test(who.u) && /SELECT, INSERT, UPDATE, DELETE ON `lpa_ecomms`/.test(grants) && !/ALL PRIVILEGES/.test(grants) && /DENIED/.test(dropErr));

  const ignored = fs.readFileSync(path.join(APP, '.gitignore'), 'utf8').split(/\r?\n/).includes('.env');
  const cfg = fs.readFileSync(path.join(APP, 'config/database.js'), 'utf8');
  const example = fs.readFileSync(path.join(APP, '.env.example'), 'utf8');
  const realPw = (fs.readFileSync(path.join(APP, '.env'), 'utf8').match(/^DB_PASSWORD=(.*)$/m) || [])[1];
  let tracked = 'not checked (no git here)';
  try { tracked = execFileSync('git', ['ls-files', '.env'], { cwd: APP, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() ? 'TRACKED!' : 'not tracked'; } catch (e) {}
  rec('DB-02', 'Database password is not in the code or in Git', 'Check .gitignore, config/database.js and .env.example', 'n/a',
    '.env ignored; no password in the code; example file has a placeholder only',
    `.env in .gitignore = ${ignored}; git: .env ${tracked}; password in config = ${cfg.includes(realPw)}; example placeholder = ${/DB_PASSWORD=change-me/.test(example)}`,
    ignored && !cfg.includes(realPw) && !example.includes(realPw) && /DB_PASSWORD=change-me/.test(example) && tracked !== 'TRACKED!');

  // ---------- READ ----------
  const dbCount = (await one("SELECT COUNT(*) AS n FROM lpa_stock WHERE lpa_stock_status <> 'x'")).n;
  const page = await get('staff', '/products');
  const shown = (page.text.match(/class="stock-card/g) || []).length;
  const kb = await one('SELECT lpa_stock_onhand AS q, lpa_stock_price AS p FROM lpa_stock WHERE lpa_stock_ID = ?', ['LPA-001']);
  const detail = (await get('staff', '/products/LPA-001')).text;
  rec('DB-03', 'Read: the Stock page shows the rows in lpa_stock', 'Open Stock; compare with a SELECT', "SELECT COUNT(*) FROM lpa_stock WHERE lpa_stock_status <> 'x'",
    'Same number of items; item detail shows the price and on-hand from the table',
    `table ${dbCount} rows, page ${shown} cards; LPA-001 $${kb.p.toFixed(2)} / ${kb.q} on hand shown = ${detail.includes('$' + kb.p.toFixed(2)) && detail.includes(String(kb.q))}`,
    shown === Number(dbCount) && detail.includes('$' + kb.p.toFixed(2)));

  // ---------- CREATE ----------
  let r = await post('admin', '/products', { form: { sku: 'LPA-020', title: 'Laptop Stand LS-3', brand: 'Orbit', category: 'Accessories', price: '45.00', quantity: '9', status: 'active', description: 'Aluminium laptop stand.' } });
  let row = await one('SELECT * FROM lpa_stock WHERE lpa_stock_ID = ?', ['LPA-020']);
  rec('DB-04', 'Create: Add stock item inserts a row', 'Stock > Add item (LPA-020 Laptop Stand, $45.00, 9)', 'INSERT INTO lpa_stock (...) VALUES (?, ?, ...)',
    'Redirect to the new item; the row is in lpa_stock', `${r.status} -> ${r.loc}; row = ${row ? `${row.lpa_stock_name}, $${row.lpa_stock_price}, ${row.lpa_stock_onhand}, status ${row.lpa_stock_status}` : 'missing'}`,
    r.status === 302 && row && row.lpa_stock_price === 45 && row.lpa_stock_onhand === 9 && row.lpa_stock_status === 'a');

  // ---------- UPDATE ----------
  await post('admin', '/products/LPA-020?_method=PUT', { form: { title: 'Laptop Stand LS-3', brand: 'Orbit', price: '39.95', quantity: '12', status: 'active' } });
  row = await one('SELECT lpa_stock_price AS p, lpa_stock_onhand AS q FROM lpa_stock WHERE lpa_stock_ID = ?', ['LPA-020']);
  rec('DB-05', 'Update: Edit item changes the row', 'Edit LPA-020: price 45.00 -> 39.95, quantity 9 -> 12, Save', 'UPDATE lpa_stock SET ... WHERE lpa_stock_ID = ?',
    'Row has the new price and quantity', `price ${row.p}, on hand ${row.q}`, row.p === 39.95 && row.q === 12);

  // ---------- DELETE ----------
  r = await post('admin', '/products/LPA-020?_method=DELETE');
  row = await one('SELECT lpa_stock_status AS s FROM lpa_stock WHERE lpa_stock_ID = ?', ['LPA-020']);
  const gone = !(await get('admin', '/products')).text.includes('LPA-020');
  rec('DB-06', 'Delete: item is soft-deleted', 'Open LPA-020 > Delete > confirm', "UPDATE lpa_stock SET lpa_stock_status = 'x' WHERE ...",
    'Row kept with status x (history keeps working); item no longer listed', `${r.status}; status = ${row.s}; hidden = ${gone}`, r.status === 302 && row.s === 'x' && gone);

  // ---------- validation ----------
  const before = (await one('SELECT COUNT(*) AS n FROM lpa_stock')).n;
  const v1 = await post('admin', '/products', { form: { title: 'X'.repeat(260), brand: 'Orbit', price: '10' } });
  const v2 = await post('admin', '/products', { form: { title: 'Bad price', brand: 'Orbit', price: '-5' } });
  const v3 = await post('admin', '/products', { form: { sku: 'LPA 0;1', title: 'Bad id', brand: 'Orbit', price: '5' } });
  const v4 = await post('admin', '/products', { form: { title: 'Huge', brand: 'Orbit', price: '1000000' } });
  const after = (await one('SELECT COUNT(*) AS n FROM lpa_stock')).n;
  rec('DB-07', 'Validation stops bad data before it reaches the table', 'Save items with a 260-character name, price -5, Stock ID "LPA 0;1", price 1,000,000', 'none run (rejected first)',
    'All refused (400) with a message; no rows added', `${[v1, v2, v3, v4].map(x => x.status).join('/')}; messages: ${/250 characters/.test(v1.text)}, ${/Price must be/.test(v2.text)}, ${/letters, numbers and dashes/.test(v3.text)}, ${/Price must be/.test(v4.text)}; rows ${before} -> ${after}`,
    [v1, v2, v3, v4].every(x => x.status === 400) && Number(before) === Number(after));

  // ---------- SQL injection ----------
  const inj1 = await get('staff', '/products?q=' + encodeURIComponent("' OR '1'='1"), J);
  const inj2 = await get('staff', '/sales?q=' + encodeURIComponent("x'; DROP TABLE lpa_invoices; -- "), J);
  const inj3 = await fetch(BASE + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: "palvim' -- ", password: 'anything' }).toString() });
  const tables = (await db.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'lpa_ecomms'"))[0].n;
  rec('DB-08', 'SQL injection attempts do nothing', "Search stock for ' OR '1'='1; search sales for x'; DROP TABLE lpa_invoices; --; log in as palvim' --",
    'All values sent as ? parameters (prepared statements)', '0 results, tables untouched, login refused',
    `stock results ${inj1.json().length}; sales results ${inj2.json().invoices.length}; tables ${tables}; login -> ${inj3.headers.get('location')}`,
    inj1.json().length === 0 && inj2.json().invoices.length === 0 && Number(tables) === 6 && /error=2/.test(inj3.headers.get('location') || ''));

  // ---------- transaction: all or nothing ----------
  const s5 = (await one('SELECT lpa_stock_onhand AS q FROM lpa_stock WHERE lpa_stock_ID = ?', ['LPA-005'])).q;
  const invBefore = (await one('SELECT COUNT(*) AS n FROM lpa_invoices')).n;
  const ledBefore = (await one('SELECT COUNT(*) AS n FROM lpa_stock_ledger')).n;
  r = await post('admin', '/sales', { json: { clientId: 'CL-002', items: [{ sku: 'LPA-005', qty: 2 }, { sku: 'LPA-004', qty: 999 }] }, accept: 'application/json' });
  const s5b = (await one('SELECT lpa_stock_onhand AS q FROM lpa_stock WHERE lpa_stock_ID = ?', ['LPA-005'])).q;
  const invAfter = (await one('SELECT COUNT(*) AS n FROM lpa_invoices')).n;
  const ledAfter = (await one('SELECT COUNT(*) AS n FROM lpa_stock_ledger')).n;
  rec('DB-09', 'Transaction: a failed invoice saves nothing', 'New invoice: webcam x2 (in stock) + dock x999 (only 4)', 'START TRANSACTION ... SELECT ... FOR UPDATE ... ROLLBACK',
    'Refused (400); webcam stock, invoices and ledger unchanged', `${r.status} "${(r.json().errors || []).join(' ')}"; webcam ${s5} -> ${s5b}; invoices ${invBefore} -> ${invAfter}; ledger ${ledBefore} -> ${ledAfter}`,
    r.status === 400 && s5 === s5b && invBefore === invAfter && ledBefore === ledAfter);

  // ---------- two buyers at the same moment ----------
  const left = (await one('SELECT lpa_stock_onhand AS q FROM lpa_stock WHERE lpa_stock_ID = ?', ['LPA-004'])).q;
  const both = await Promise.all([
    post('admin', '/sales', { json: { clientId: 'CL-001', items: [{ sku: 'LPA-004', qty: left }] }, accept: 'application/json' }),
    post('admin', '/sales', { json: { clientId: 'CL-003', items: [{ sku: 'LPA-004', qty: left }] }, accept: 'application/json' }),
  ]);
  const leftAfter = (await one('SELECT lpa_stock_onhand AS q FROM lpa_stock WHERE lpa_stock_ID = ?', ['LPA-004'])).q;
  const okCount = both.filter(x => x.status === 201).length;
  rec('DB-10', 'Two sales at once cannot oversell', `Send two invoices at the same moment, each for all ${left} docks`, 'SELECT ... FOR UPDATE locks the stock row until COMMIT',
    'Exactly one is saved; the other is refused; stock ends at 0 (never negative)', `statuses ${both.map(x => x.status).join(' + ')}; stock ${left} -> ${leftAfter}`,
    okCount === 1 && both.some(x => x.status === 400) && leftAfter === 0);

  // ---------- foreign keys ----------
  r = await post('admin', '/products/LPA-001?_method=PUT', { form: { sku: 'LPA-101', title: 'Mechanical Keyboard MK-87', brand: 'Vertex' } });
  const stillThere = await one('SELECT lpa_stock_ID AS id FROM lpa_stock WHERE lpa_stock_ID = ?', ['LPA-001']);
  let fkErr = '';
  try { await db.query("INSERT INTO lpa_invoices (lpa_inv_no, lpa_inv_date, lpa_inv_client_ID, lpa_inv_client_name, lpa_inv_client_address, lpa_inv_amount) VALUES ('INV-9999', NOW(), 'CL-999', 'Nobody', 'Nowhere', 1)"); } catch (e) { fkErr = e.code; }
  rec('DB-11', 'Foreign keys protect the history', 'Change the Stock ID of LPA-001 (on invoices); insert an invoice for client CL-999 (does not exist)',
    'FOREIGN KEY fk_item_stock / fk_inv_client', 'Both refused; LPA-001 unchanged', `rename -> ${r.status} "${/cannot be changed/.test(r.text) ? 'used on invoices...' : r.text.slice(0, 60)}"; LPA-001 kept = ${!!stillThere}; bad invoice -> ${fkErr}`,
    r.status === 409 && !!stillThere && fkErr === 'ER_NO_REFERENCED_ROW_2');

  // ---------- web-store order through the database ----------
  await post('cust', '/cart', { form: { sku: 'LPA-007', qty: '2' }, accept: 'application/json' });
  r = await post('cust', '/checkout', { form: { address: '7 Park Rd, Milton QLD 4064', phone: '0412 345 678', payment: 'PayPal', expectedTotal: '68' } });
  const no = (r.loc || '').split('/').pop().split('?')[0];
  const inv = await one('SELECT lpa_inv_client_ID AS c, lpa_inv_amount AS a, lpa_inv_payment AS p FROM lpa_invoices WHERE lpa_inv_no = ?', [no]);
  const items = await db.query('SELECT lpa_invitem_stock_ID AS s, lpa_invitem_qty AS q FROM lpa_invoice_items WHERE lpa_invitem_inv_no = ?', [no]);
  const led = await one("SELECT u.lpa_user_username AS u, l.lpa_ledger_before AS b, l.lpa_ledger_after AS a FROM lpa_stock_ledger l JOIN lpa_users u ON u.lpa_user_ID = l.lpa_ledger_user_ID WHERE l.lpa_ledger_reason = ?", [`Sold - ${no}`]);
  rec('DB-12', 'Checkout writes invoice, items, stock and ledger', 'Customer adds numpad x2, checks out with PayPal', 'INSERT lpa_invoices + lpa_invoice_items; UPDATE lpa_stock; INSERT lpa_stock_ledger (one transaction)',
    'Invoice for CL-006 $68.00 PayPal, 1 line, stock 15 -> 13, ledger by aturner', `${no}: ${inv ? `${inv.c} $${inv.a.toFixed(2)} ${inv.p}` : 'missing'}; lines ${items.length}; ledger ${led ? `${led.u} ${led.b} -> ${led.a}` : 'missing'}`,
    inv && inv.c === 'CL-006' && inv.a === 68 && inv.p === 'PayPal' && items.length === 1 && led && led.u === 'aturner' && led.b === 15 && led.a === 13);

  // ---------- persistence after a restart ----------
  const s1 = startServer(3191);
  await sleep(1500);
  await login('fresh', 'palvim', 'Lpa#2026', s1.url);
  const ord = await get('fresh', '/sales/' + no, J, s1.url);
  const del = await get('fresh', '/products/LPA-020', {}, s1.url);
  s1.child.kill();
  rec('DB-13', 'Data is still there after the app restarts', 'Start a NEW app process; open the order made in DB-12 and the deleted item', 'SELECT on start-up of a new process',
    'Order found with the same amount; deleted item still deleted', `new process: ${/Database connected/.test(s1.log()) ? 'connected' : 'not connected'}; ${no} -> ${ord.status} $${ord.status === 200 ? ord.json().amount.toFixed(2) : '-'}; LPA-020 -> ${del.status}`,
    ord.status === 200 && ord.json().amount === 68 && del.status === 404);

  // ---------- database down ----------
  const s2 = startServer(3192, { DB_PASSWORD: 'wrong-password' });
  await sleep(1500);
  const down = await fetch(s2.url + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'username=palvim&password=Lpa%232026' });
  const downText = await down.text();
  s2.child.kill();
  rec('DB-14', 'Clear message when the database is not available', 'Start the app with a wrong DB password, then try to log in', 'connection refused (ER_ACCESS_DENIED_ERROR)',
    'Start-up warning in the console; user sees 503 "database is not available"; no technical details', `console warning = ${/Database NOT connected/.test(s2.log())}; status ${down.status}; message = ${/database is not available/.test(downText)}; leaks = ${/ER_ACCESS|at .*\.js|lpa_app/.test(downText)}`,
    /Database NOT connected/.test(s2.log()) && down.status === 503 && /database is not available/.test(downText) && !/ER_ACCESS|at .*\.js|lpa_app/.test(downText));

  // ---------- export ----------
  execFileSync(process.execPath, ['db/export.js'], { cwd: APP });
  const dump = fs.readFileSync(path.join(APP, 'db/export.sql'), 'utf8');
  const creates = (dump.match(/CREATE TABLE/g) || []).length;
  rec('DB-15', 'Database exported to db/export.sql', 'npm run db:export', 'SHOW CREATE TABLE ?? + SELECT * FROM ??',
    '6 tables with their data; hashes only, no plain passwords', `${creates} tables; ${(dump.match(/INSERT INTO/g) || []).length} INSERT blocks; ${(dump.length / 1024).toFixed(1)} KB; plain password = ${dump.includes('Lpa#2026')}`,
    creates === 6 && !dump.includes('Lpa#2026') && dump.includes(no));

  await db.pool.end();
  fs.writeFileSync(path.join(__dirname, 'db-test-results.json'), JSON.stringify(results, null, 2));
  const p = results.filter(x => x.result === 'PASS').length;
  console.log(`\n${p} PASS, ${results.length - p} FAIL of ${results.length}`);
})().catch(e => { console.error(e); process.exit(1); });
