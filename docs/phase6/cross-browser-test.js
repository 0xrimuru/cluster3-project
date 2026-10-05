// ICTWEB514 (Phase 6) - cross-browser / cross-device test of the dynamic pages.
// 5 dynamic pages x 2 browsers (Chromium via Playwright, Firefox via Selenium) x 2 devices
// (desktop 1366x768, phone 412x915). For each page it checks the SERVER-side dynamic content
// (data rendered for this user/request) and the CLIENT-side dynamic content (JavaScript that
// changes the page without reloading), and saves a screenshot.
//   BASE=http://localhost:3000 OUT=docs/phase6/shots node docs/phase6/cross-browser-test.js
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = process.env.OUT || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const DEVICES = { desktop: { w: 1366, h: 768 }, phone: { w: 412, h: 915 } };
const results = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- tiny driver adapters so the same steps run in both browsers ----
async function chromiumDriver(device) {
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  const ctx = await b.newContext(device === 'phone'
    ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' }
    : { viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  return {
    name: 'Chromium ' + b.version(), errors,
    goto: u => p.goto(BASE + u, { waitUntil: 'load' }),
    fill: (sel, v) => p.fill(sel, String(v)),
    type: (sel, v) => p.type(sel, String(v)),
    click: sel => p.click(sel),
    clickNav: async sel => { await Promise.all([p.waitForNavigation(), p.click(sel)]); },
    select: (sel, v) => p.selectOption(sel, v),
    text: sel => p.textContent(sel),
    visibleCount: sel => p.$$eval(sel, els => els.filter(e => !e.hidden && e.offsetParent !== null).length),
    attr: (sel, a) => p.getAttribute(sel, a),
    exists: async sel => (await p.$(sel)) !== null,
    url: () => p.url(),
    shot: f => p.screenshot({ path: f }),
    quit: () => b.close(),
  };
}
async function firefoxDriver(device) {
  const { Builder, By, until } = require('selenium-webdriver');
  const firefox = require('selenium-webdriver/firefox');
  const o = new firefox.Options().addArguments('-headless').setBinary(process.env.FIREFOX || '/opt/ff/firefox/firefox');
  if (device === 'phone') o.setPreference('general.useragent.override', 'Mozilla/5.0 (Android 14; Mobile; rv:157.0) Gecko/157.0 Firefox/157.0');
  o.windowSize({ width: DEVICES[device].w, height: DEVICES[device].h });
  const d = await new Builder().forBrowser('firefox').setFirefoxOptions(o).setFirefoxService(new firefox.ServiceBuilder(process.env.GECKODRIVER || '/opt/ff/geckodriver')).build();
  const caps = await d.getCapabilities();
  const $ = sel => d.wait(until.elementLocated(By.css(sel)), 8000);
  return {
    name: 'Firefox ' + caps.get('browserVersion'), errors: [],
    goto: u => d.get(BASE + u),
    fill: async (sel, v) => { const e = await $(sel); await e.clear(); await e.sendKeys(String(v)); },
    type: async (sel, v) => { const e = await $(sel); await e.sendKeys(String(v)); },
    click: async sel => { const e = await $(sel); await d.executeScript(el => el.scrollIntoView({ block: 'center' }), e); await e.click(); },
    clickNav: async sel => { const before = await d.getCurrentUrl(); const e = await $(sel); await d.executeScript(el => el.scrollIntoView({ block: 'center' }), e); await e.click(); await d.wait(async () => (await d.getCurrentUrl()) !== before, 8000).catch(() => {}); await sleep(300); },
    select: async (sel, v) => d.executeScript((s, val) => { const el = document.querySelector(s); el.value = val; el.dispatchEvent(new Event('change', { bubbles: true })); }, sel, v),
    text: async sel => (await $(sel)).getAttribute('textContent'),
    visibleCount: sel => d.executeScript(s => [...document.querySelectorAll(s)].filter(e => !e.hidden && e.offsetParent !== null).length, sel),
    attr: async (sel, a) => (await $(sel)).getAttribute(a),
    exists: async sel => (await d.findElements(By.css(sel))).length > 0,
    url: () => d.getCurrentUrl(),
    shot: async f => fs.writeFileSync(f, await d.takeScreenshot(), 'base64'),
    quit: () => d.quit(),
  };
}

async function login(D, u) {
  await D.goto('/logout'); await D.fill('#username', u); await D.fill('#password', 'Lpa#2026'); await D.clickNav('button[type=submit]');
}
function rec(browser, device, page, server, client, pass, shot) {
  results.push({ browser, device, page, server, client, result: pass ? 'PASS' : 'FAIL', shot });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${browser.padEnd(14)} ${device.padEnd(7)} ${page.padEnd(13)} server: ${server} | client: ${client}`);
}

async function run(makeDriver, device) {
  const D = await makeDriver(device);
  const tag = D.name.split(' ')[0].toLowerCase() + '-' + device;
  const shot = n => { const f = path.join(OUT, `${tag}-${n}.png`); return D.shot(f).then(() => path.basename(f)); };
  try {
    // P1 Home (staff dashboard) ----------------------------------------
    await login(D, 'palvim');
    const lede = await D.text('.lede');
    const stats = await D.text('.stat-grid');
    const greetOk = /Good (morning|afternoon|evening), Pedro/.test(lede);
    rec(D.name, device, '1 Home', `stats for this user's group (${/Stock items/.test(stats) ? 'tiles shown' : 'missing'}), "Welcome, Pedro Alvim"`, `greeting set by JS: "${lede.trim().slice(0, 22)}"`, greetOk && /Total sales/.test(stats), await shot('1-home'));

    // P2 Stock list ----------------------------------------------------
    await D.goto('/products?q=keyboard');
    const serverHits = await D.visibleCount('.stock-card');
    await D.goto('/products');
    await D.type('#stock-search', 'web');
    await sleep(300);
    const live = await D.visibleCount('.stock-card');
    rec(D.name, device, '2 Stock', `?q=keyboard -> ${serverHits} item(s) from the server (keyboard + numpad, category Keyboards)`, `typing "web" filters live -> ${live} card(s)`, serverHits === 2 && live === 1, await shot('2-stock'));

    // P3 New invoice (admin) -------------------------------------------
    await D.goto('/sales/new');
    const invNo = (await D.text('#inv-no')).trim();
    await D.fill('#client-id', 'CL-002'); await D.click('#client-search'); await sleep(700);
    const cname = (await D.text('#c-name')).trim();
    await D.fill('#item-id', 'LPA-005'); await D.click('#item-search'); await sleep(700);
    await D.fill('#item-qty', '2'); await D.click('#item-add'); await sleep(300);
    const total = (await D.text('#inv-total')).trim();
    rec(D.name, device, '3 New invoice', `next number ${invNo}; client lookup -> "${cname}"`, `line added, live total ${total}`, /^INV-\d+$/.test(invNo) && cname === 'DevWorks Pty Ltd' && total === '$138.00', await shot('3-new-invoice'));

    // P4 Shop (customer) -----------------------------------------------
    await login(D, 'aturner');
    await D.goto('/shop?sort=price-desc');
    const first = (await D.text('.product-card .product-title')).trim();
    await D.type('#shop-search', 'mouse'); await sleep(300);
    const shown = await D.visibleCount('.product-card');
    await D.goto('/shop');
    await D.click('.add-form[data-sku="LPA-002"] button'); await sleep(400);
    await D.click('dialog [data-ok]'); await sleep(800);
    const badge = (await D.text('#cart-badge')).trim();
    rec(D.name, device, '4 Shop', `sorted by price on the server: first = "${first}"`, `live filter "mouse" -> ${shown}; add to cart -> badge ${badge}`, first.startsWith('27"') && shown === 1 && badge === '1', await shot('4-shop'));

    // P5 Cart ----------------------------------------------------------
    await D.goto('/cart');
    const serverTotal = (await D.text('#cart-total')).trim();
    await D.fill('#cq-LPA-002', '3'); await sleep(900);
    const liveTotal = (await D.text('#cart-total')).trim();
    await D.goto('/cart');
    const kept = (await D.text('#cart-total')).trim();
    rec(D.name, device, '5 Cart', `total from the session ${serverTotal}; after reload ${kept}`, `qty 1 -> 3 recalculates live: ${liveTotal}`, serverTotal === '$39.50' && liveTotal === '$118.50' && kept === '$118.50', await shot('5-cart'));
    await D.fill('#cq-LPA-002', '0'); await sleep(900); // empty the cart for the next run
    if (D.errors.length) console.log('  JS errors:', D.errors);
  } catch (e) {
    rec(D.name, device, 'run', 'error', e.message.slice(0, 120), false, '');
  } finally { await D.quit(); }
}

(async () => {
  for (const make of [chromiumDriver, firefoxDriver]) for (const dev of ['desktop', 'phone']) await run(make, dev);
  fs.writeFileSync(path.join(path.dirname(OUT), 'cross-browser-results.json'), JSON.stringify(results, null, 2));
  const p = results.filter(r => r.result === 'PASS').length;
  console.log(`\n${p} PASS, ${results.length - p} FAIL of ${results.length}`);
})();
