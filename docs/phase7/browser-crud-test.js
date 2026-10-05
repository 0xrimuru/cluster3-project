// ICTDBS507 (Phase 7) - one full CRUD cycle through the web pages in TWO browsers
// (Chromium via Playwright, Firefox via Selenium). After each step the row is checked
// directly in MySQL, and a screenshot is saved to docs/phase7/shots/.
//   npm run db:setup -> npm start -> BASE=http://localhost:3000 node docs/phase7/browser-crud-test.js
const fs = require('fs');
const path = require('path');
const { chromiumDriver, firefoxDriver, login } = require('../phase6/cross-browser-test');
const db = require('../../config/database');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const row = async sku => (await db.query('SELECT lpa_stock_name AS name, lpa_stock_price AS price, lpa_stock_onhand AS qty, lpa_stock_status AS status FROM lpa_stock WHERE lpa_stock_ID = ?', [sku]))[0];
function rec(browser, step, page, database, pass, shot) {
  results.push({ browser, step, page, database, result: pass ? 'PASS' : 'FAIL', shot });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${browser.padEnd(16)} ${step.padEnd(7)} page: ${page} | MySQL: ${database}`);
}

async function cycle(makeDriver, sku) {
  const D = await makeDriver('desktop');
  const b = D.name.split(' ')[0].toLowerCase();
  const shot = async n => { const f = path.join(OUT, `${b}-${n}.png`); await D.shot(f); return path.basename(f); };
  try {
    await login(D, 'palvim');
    // CREATE
    await D.goto('/products/new');
    await D.fill('input[name=sku]', sku); await D.fill('input[name=title]', 'Ergonomic Wrist Rest WR-1');
    await D.fill('input[name=brand]', 'Orbit'); await D.fill('input[name=category]', 'Accessories');
    await D.fill('input[name=price]', '24.00'); await D.fill('input[name=quantity]', '6');
    await D.clickNav('#product-form button[type=submit]');
    let r = await row(sku);
    rec(D.name, 'Create', `${(await D.url()).replace(/^https?:\/\/[^/]+/, '')} shows "${(await D.text('h1')).trim()}"`, r ? `row ${sku}: ${r.name}, $${r.price}, ${r.qty}, ${r.status}` : 'no row', !!r && r.price === 24 && r.qty === 6, await shot('1-create'));
    // READ (list, from a SELECT ... LIKE ?)
    await D.goto('/products?q=wrist');
    const cards = await D.visibleCount('.stock-card');
    const db1 = (await db.query("SELECT COUNT(*) AS n FROM lpa_stock WHERE lpa_stock_name LIKE '%wrist%' AND lpa_stock_status <> 'x'"))[0].n;
    rec(D.name, 'Read', `search "wrist" -> ${cards} card(s)`, `${db1} matching row(s)`, cards === Number(db1) && cards >= 1, await shot('2-read'));
    // UPDATE
    await D.goto(`/products/${sku}/edit`);
    await D.fill('input[name=price]', '19.95');
    await D.clickNav('#product-form button[type=submit]');
    r = await row(sku);
    const shown = (await D.text('main')).includes('$19.95');
    rec(D.name, 'Update', `detail shows $19.95 = ${shown}`, `price now ${r.price}`, shown && r.price === 19.95, await shot('3-update'));
    // DELETE (soft) - confirm in the dialog
    await D.goto(`/products/${sku}`);
    await D.click('form[action$="_method=DELETE"] button');
    await sleep(300);
    await D.clickNav('dialog [data-ok]');
    r = await row(sku);
    const listed = (await D.text('main')).includes(sku);
    rec(D.name, 'Delete', `back on Stock list; ${sku} listed = ${listed}`, `status ${r.status} (row kept for history)`, !listed && r.status === 'x', await shot('4-delete'));
    if (D.errors.length) console.log('  JS errors:', D.errors);
  } catch (e) {
    rec(D.name, 'error', e.message.slice(0, 150), '', false, '');
  } finally { await D.quit(); }
}

(async () => {
  await cycle(chromiumDriver, 'LPA-031');
  await cycle(firefoxDriver, 'LPA-032');
  await db.pool.end();
  fs.writeFileSync(path.join(__dirname, 'browser-crud-results.json'), JSON.stringify(results, null, 2));
  const p = results.filter(r => r.result === 'PASS').length;
  console.log(`\n${p} PASS, ${results.length - p} FAIL of ${results.length}`);
})();
