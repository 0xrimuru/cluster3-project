// ICTPRG537 (Phase 9 / security) - security tests for the TWO secured applications:
// the LPA web app (policy-based access control, code-access security, sign-in protection,
// encryption at rest and in transit, injection protection) and the LPA Android app.
//   npm run db:setup && npm run nosql:setup && npm start
//   BASE=http://localhost:3000 node docs/phase9/security-tests.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const { spawn, execFileSync } = require('child_process');
const APP = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(APP, '.env'), quiet: true });
const db = require(APP + '/config/database');
const nosql = require(APP + '/config/nosql');
const policy = require(APP + '/app/Security/policy');
const { encrypt, decrypt, blindIndex } = require(APP + '/app/Security/crypto');
const BASE = process.env.BASE || 'http://localhost:3000';
const PW = 'Lpa#2026';
const results = [];
const jar = {}, csrf = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

function rec(id, title, steps, expected, actual, pass) {
  const result = pass === null ? 'N/A' : (pass ? 'PASS' : 'FAIL');
  results.push({ id, title, steps, expected, actual, result });
  console.log(`${result.padEnd(4)}  ${id}  ${title}  ->  ${actual}`);
}
async function req(who, method, p, { form, json, accept, raw } = {}, base = BASE) {
  const headers = { cookie: jar[who] || '' };
  if (method !== 'GET' && csrf[who]) headers['x-csrf-token'] = csrf[who];
  let body;
  if (form) { headers['content-type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
  if (json !== undefined) { headers['content-type'] = 'application/json'; body = raw ? json : JSON.stringify(json); }
  if (accept) headers.accept = accept;
  const t = Date.now();
  const r = await fetch(base + p, { method, redirect: 'manual', headers, body });
  const text = await r.text();
  return { status: r.status, loc: r.headers.get('location'), headers: r.headers, text, ms: Date.now() - t, json: () => JSON.parse(text) };
}
const get = (w, p, o, b) => req(w, 'GET', p, o, b);
const post = (w, p, o, b) => req(w, 'POST', p, o, b);
const J = { accept: 'application/json' };
async function rawLogin(username, password, base = BASE) {
  const t = Date.now();
  const r = await fetch(base + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password }).toString() });
  return { r, ms: Date.now() - t, loc: r.headers.get('location') || '' };
}
async function login(who, username, password = PW, base = BASE) {
  const { r } = await rawLogin(username, password, base);
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  jar[who] = sc.map(c => c.split(';')[0]).filter(c => !c.endsWith('=')).join('; ');
  const page = await fetch(base + '/more', { headers: { cookie: jar[who] } }).then(x => x.text());
  csrf[who] = (page.match(/name="csrf-token" content="([0-9a-f]+)"/) || [])[1] || '';
  return !!jar[who];
}
function startServer(script, port, env = {}) {
  const child = spawn(process.execPath, [script], { cwd: APP, env: Object.assign({}, process.env, { PORT: String(port) }, env), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  return { child, log: () => out };
}
const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

(async () => {
  const attempts = await nosql.col('login_attempts');
  await attempts.deleteMany({});
  await login('admin', 'palvim'); await login('staff', 'mchang'); await login('cust', 'aturner');

  // ---------- S-01 policy-based access control ----------
  const matrix = [
    ['cust', 'GET', '/products', 403], ['cust', 'GET', '/sales', 403], ['cust', 'GET', '/users', 403], ['cust', 'GET', '/security', 403], ['cust', 'GET', '/shop', 200],
    ['staff', 'GET', '/products', 200], ['staff', 'GET', '/products/new', 403], ['staff', 'GET', '/users', 403], ['staff', 'GET', '/activity', 403], ['staff', 'GET', '/reviews', 200], ['staff', 'GET', '/cart', 403],
    ['admin', 'GET', '/users', 200], ['admin', 'GET', '/security', 200], ['admin', 'GET', '/activity', 200], ['admin', 'GET', '/sales/new', 200], ['admin', 'GET', '/checkout', 403],
  ];
  const before = await (await nosql.col('activity_log')).countDocuments({ type: 'ACCESS_DENIED' });
  const wrong = [];
  for (const [w, m, p, exp] of matrix) { const r = await req(w, m, p); if (r.status !== exp) wrong.push(`${w} ${p} ${r.status}`); }
  const del = await req('staff', 'DELETE', '/products/LPA-001', J);
  await sleep(300);
  const denied = await (await nosql.col('activity_log')).countDocuments({ type: 'ACCESS_DENIED' }) - before;
  rec('S-01', 'Policy-based access control', `${matrix.length} page requests by customer / staff / admin + staff DELETE /products/LPA-001`,
    'Each user group reaches only the pages its permissions allow (403 otherwise); every refusal logged as ACCESS_DENIED',
    `${matrix.length - wrong.length}/${matrix.length} as expected${wrong.length ? ' (wrong: ' + wrong.join('; ') + ')' : ''}; staff delete -> ${del.status}; ${denied} ACCESS_DENIED events`,
    wrong.length === 0 && del.status === 403 && denied >= 10);

  // ---------- S-02 deny by default + policy file ----------
  const admin = { group: 'administrator', status: 'active' };
  const inactiveAdmin = { group: 'administrator', status: 'inactive' };
  const m = policy.matrix();
  rec('S-02', 'Deny by default', 'Ask the policy engine for an unknown permission, for an inactive administrator, and with no user',
    'All three refused; policy file says defaultDecision "deny"',
    `unknown permission -> ${policy.can(admin, 'stock.destroy_everything')}; inactive admin -> ${policy.can(inactiveAdmin, 'stock.manage')}; no user -> ${policy.can(null, 'shop.view')}; ${m.rows.length} permissions x ${m.groups.length} groups, default ${policy.POLICY.defaultDecision}`,
    !policy.can(admin, 'stock.destroy_everything') && !policy.can(inactiveAdmin, 'stock.manage') && !policy.can(null, 'shop.view') && policy.POLICY.defaultDecision === 'deny');

  // ---------- S-03 ownership rules ----------
  const otherOrder = await get('cust', '/orders/INV-1001');
  const otherReview = String((await (await nosql.col('product_reviews')).findOne({ 'author.clientId': 'CL-002' }))._id);
  const editOther = await post('cust', `/reviews/${otherReview}?_method=PUT`, { form: { rating: '1', title: 'Hacked title', comment: 'Changing somebody else review.' } });
  const stillOk = (await (await nosql.col('product_reviews')).findOne({ _id: new (require('mongodb').ObjectId)(otherReview) })).title !== 'Hacked title';
  rec('S-03', 'Ownership: own orders and own reviews only', "Customer opens another client's invoice (INV-1001) and edits another client's review",
    'Both answered "not found" (404) - the data is not shown or changed', `order -> ${otherOrder.status}; edit review -> ${editOther.status}; review unchanged = ${stillOk}`,
    otherOrder.status === 404 && editOther.status === 404 && stillOk);

  // ---------- S-04 brute-force lockout ----------
  const tries = [];
  for (let i = 0; i < 5; i++) tries.push((await rawLogin('mchang', 'wrong-guess-' + i)).loc);
  const sixth = await rawLogin('mchang', PW);
  const ghost = [];
  for (let i = 0; i < 6; i++) ghost.push((await rawLogin('no-such-user', 'x' + i)).loc);
  await sleep(300);
  const lockedEvent = await (await nosql.col('activity_log')).findOne({ type: 'LOGIN_LOCKED', user: 'mchang' });
  const keys = await attempts.distinct('key');
  await attempts.deleteMany({ key: 'user:mchang' }); // = the 15 minutes passing
  const after = await rawLogin('mchang', PW);
  rec('S-04', 'Brute-force protection (lockout)', '5 wrong passwords for mchang, then the RIGHT password; same for a user name that does not exist; then the 15-minute window passes',
    '6th attempt refused even with the right password ("Too many failed sign-ins"); same answer for the unknown user; LOGIN_LOCKED logged; IP stored only as a hash; sign-in works after the window',
    `5 wrong -> error=2; right password -> ${sixth.loc.replace(/&u=.*/, '')}; unknown user 6th -> ${ghost[5].replace(/&u=.*/, '')}; logged = ${!!lockedEvent}; keys ${keys.map(k => k.slice(0, 12)).join(', ')}; after window -> ${after.loc}`,
    tries.every(l => /error=2/.test(l)) && /error=3/.test(sixth.loc) && /error=3/.test(ghost[5]) && !!lockedEvent && keys.every(k => /^user:|^ip:[0-9a-f]{32}$/.test(k)) && after.loc === '/');
  await attempts.deleteMany({});

  // ---------- S-05 no user enumeration by timing ----------
  const tKnown = [], tUnknown = [];
  for (let i = 0; i < 4; i++) { tKnown.push((await rawLogin('aturner', 'Wrong' + i + 'pass')).ms); tUnknown.push((await rawLogin('ghost' + i, 'Wrong' + i + 'pass')).ms); }
  await attempts.deleteMany({});
  const mk = median(tKnown), mu = median(tUnknown);
  rec('S-05', 'Wrong user name takes as long as wrong password', 'Time 4 failed sign-ins for a real user and 4 for unknown user names',
    'Similar times (the password is checked against a dummy hash for unknown users), so attackers cannot find valid user names',
    `real user median ${mk} ms; unknown user median ${mu} ms`, Math.abs(mk - mu) <= Math.max(15, 0.5 * Math.max(mk, mu)));

  // ---------- S-06 password rules + change password ----------
  const reg1 = await post('anon', '/register', { form: { firstName: 'Kim', lastName: 'Lee', address: '1 Main St, Brisbane QLD 4000', phone: '0400 222 333', username: 'kimlee', password: 'Password1', confirmPassword: 'Password1', privacy: 'yes' } });
  const reg2 = await post('anon', '/register', { form: { firstName: 'Kim', lastName: 'Lee', address: '1 Main St, Brisbane QLD 4000', phone: '0400 222 333', username: 'kimlee', password: 'kimlee2026', confirmPassword: 'kimlee2026', privacy: 'yes' } });
  await login('cust2', 'aturner');
  const badCur = await post('cust', '/account/password?_method=PUT', { form: { currentPassword: 'not-it-1', newPassword: 'Peripheral#77', confirmPassword: 'Peripheral#77' } });
  const ok = await post('cust', '/account/password?_method=PUT', { form: { currentPassword: PW, newPassword: 'Peripheral#77', confirmPassword: 'Peripheral#77' } });
  const otherSession = await get('cust2', '/orders');
  const thisSession = await get('cust', '/orders');
  const newPw = await rawLogin('aturner', 'Peripheral#77');
  const oldPw = await rawLogin('aturner', PW);
  await post('cust', '/account/password?_method=PUT', { form: { currentPassword: 'Peripheral#77', newPassword: PW, confirmPassword: PW } }); // back to the demo password
  await attempts.deleteMany({});
  rec('S-06', 'Password rules and changing your password', 'Register with "Password1" and with the user name in the password; change password with a wrong current password, then correctly',
    'Common / user-name passwords refused; wrong current password refused; after the change the OTHER session is signed out, this one stays; only the new password works',
    `common -> ${reg1.status} ${/too common/.test(reg1.text)}; contains user name -> ${reg2.status} ${/user name/.test(reg2.text)}; wrong current -> ${badCur.status}; change -> ${ok.status}; other session -> ${otherSession.status}; this session -> ${thisSession.status}; new password -> ${newPw.loc}; old password -> ${oldPw.loc.replace(/&u=.*/, '')}`,
    reg1.status === 400 && /too common/.test(reg1.text) && reg2.status === 400 && /user name/.test(reg2.text) && badCur.status === 400 && ok.status === 302 && otherSession.status === 302 && thisSession.status === 200 && newPw.loc === '/shop' && /error=2/.test(oldPw.loc));

  // ---------- S-07 encryption at rest (MySQL) ----------
  const row = (await db.query('SELECT lpa_client_phone AS p, lpa_client_phone_idx AS i FROM lpa_clients WHERE lpa_client_ID = ?', ['CL-004']))[0];
  const page = (await get('staff', '/clients')).text;
  const byPhone = (await get('staff', '/clients?q=' + encodeURIComponent('(07) 3266 7788'))).text;
  const e1 = encrypt('(07) 3266 7788'), e2 = encrypt('(07) 3266 7788');
  let tamper = ''; try { decrypt(e1.slice(0, -3) + (e1.endsWith('A') ? 'B' : 'A') + e1.slice(-2)); } catch (e) { tamper = 'rejected'; }
  rec('S-07', 'Client phone numbers encrypted in MySQL', 'Read lpa_clients.lpa_client_phone directly; open Clients; search by phone; encrypt the same number twice; change one character of a ciphertext',
    'Database holds only AES-256-GCM ciphertext; the page shows the real number; exact phone search works (blind index); same number -> different ciphertext (random IV); changed ciphertext rejected',
    `stored "${row.p.slice(0, 26)}..." (digits visible = ${/3266/.test(row.p)}); page shows number = ${page.includes('(07) 3266 7788')}; phone search finds CL-004 = ${byPhone.includes('CL-004') && !byPhone.includes('CL-001')}; two ciphertexts differ = ${e1 !== e2}; index = HMAC (${row.i === blindIndex('0732667788')}); tampered -> ${tamper || 'accepted!'}`,
    row.p.startsWith('v1.') && !/3266/.test(row.p) && page.includes('(07) 3266 7788') && byPhone.includes('CL-004') && !byPhone.includes('CL-001') && e1 !== e2 && row.i === blindIndex('0732667788') && tamper === 'rejected');

  // ---------- S-08 injection protection ----------
  const nosqlInj = await req('anon', 'POST', '/login', { json: { username: { $ne: '' }, password: { $ne: '' } }, accept: 'application/json' });
  const proto = await req('anon', 'POST', '/login', { json: '{"username":"palvim","__proto__":{"isAdmin":true}}', raw: true, accept: 'application/json' });
  const qObj = await get('staff', '/products?q[$ne]=x', J);
  const sqlInj = await get('staff', '/clients?q=' + encodeURIComponent("' OR '1'='1' -- "));
  await sleep(300);
  const secEvents = await (await nosql.col('activity_log')).countDocuments({ type: 'SECURITY' });
  rec('S-08', 'Injection protection', 'JSON login with {"$ne":""}; JSON with __proto__; query ?q[$ne]=x; client search for \' OR \'1\'=\'1\' --',
    '$-operators and __proto__ refused (400, logged as SECURITY); nested query values are not parsed into objects; SQL text treated as a plain value (no clients found)',
    `$ne -> ${nosqlInj.status}; __proto__ -> ${proto.status}; ?q[$ne] -> ${qObj.status} (${Array.isArray(qObj.json()) ? qObj.json().length + ' items, plain list' : 'not a list'}); SQL -> ${(sqlInj.text.match(/CL-00\d/g) || []).length} clients; SECURITY events ${secEvents}`,
    nosqlInj.status === 400 && proto.status === 400 && qObj.status === 200 && (sqlInj.text.match(/CL-00\d/g) || []).length === 0 && secEvents >= 2);

  // ---------- S-09 code-access security (Node permission model) ----------
  const sb = startServer('scripts/secure-start.js', 3196);
  await sleep(3500);
  const sbOk = await login('sb', 'palvim', PW, 'http://localhost:3196');
  const sec = await get('sb', '/security', J, 'http://localhost:3196');
  const sbStatus = sec.status === 200 ? sec.json().status.sandbox : {};
  const products = await get('sb', '/products', {}, 'http://localhost:3196');
  sb.child.kill();
  // the same rules applied to a hostile script
  const probe = path.join(os.tmpdir(), 'lpa-probe.js');
  fs.writeFileSync(probe, `const out = [];
    const t = (n, f) => { try { f(); out.push(n + ': ALLOWED'); } catch (e) { out.push(n + ': ' + e.code); } };
    t('read ${process.platform === 'win32' ? 'C:/Windows/win.ini' : '/etc/passwd'}', () => require('fs').readFileSync('${process.platform === 'win32' ? 'C:/Windows/win.ini' : '/etc/passwd'}'));
    t('change server.js', () => require('fs').appendFileSync(${JSON.stringify(path.join(APP, 'server.js'))}, ''));
    t('run a program', () => require('child_process').execSync('${process.platform === 'win32' ? 'whoami' : 'id'}'));
    t('read .env', () => require('fs').readFileSync(${JSON.stringify(path.join(APP, '.env'))}));
    console.log(out.join('; '));`);
  const flag = Number(process.versions.node.split('.')[0]) >= 22 ? '--permission' : '--experimental-permission';
  const probeOut = execFileSync(process.execPath, [flag, `--allow-fs-read=${APP}${path.sep}`, `--allow-fs-read=${probe}`, `--allow-fs-write=${path.join(APP, 'logs')}${path.sep}`, probe]).toString().trim();
  fs.unlinkSync(probe);
  rec('S-09', 'Code-access security (npm run start:secure)', 'Start the app under the permission policy, sign in and use it; run a hostile script under the same policy',
    'App works normally; Security page reports the policy enforced; reading system files, changing the code and running programs are denied',
    `sign-in ${sbOk}; /products ${products.status}; sandbox enabled ${sbStatus.enabled}, ok ${sbStatus.ok}; probe: ${probeOut}`,
    sbOk && products.status === 200 && sbStatus.enabled && sbStatus.ok && /passwd: ERR_ACCESS_DENIED|win.ini: ERR_ACCESS_DENIED/.test(probeOut) && /server.js: ERR_ACCESS_DENIED/.test(probeOut) && /program: ERR_ACCESS_DENIED/.test(probeOut));

  // ---------- S-10 HTTPS ----------
  const certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lpa-cert-'));
  const pems = require('selfsigned').generate([{ name: 'commonName', value: 'localhost' }], { keySize: 2048, days: 2, algorithm: 'sha256' });
  fs.writeFileSync(path.join(certDir, 'k.pem'), pems.private); fs.writeFileSync(path.join(certDir, 'c.pem'), pems.cert);
  const hs = startServer('server.js', 3197, { HTTPS_KEY: path.join(certDir, 'k.pem'), HTTPS_CERT: path.join(certDir, 'c.pem') });
  await sleep(3000);
  const tls = await new Promise(resolve => {
    const r = https.request({ host: 'localhost', port: 3197, path: '/login', method: 'POST', rejectUnauthorized: false, headers: { 'content-type': 'application/x-www-form-urlencoded' } }, res => {
      resolve({ status: res.statusCode, proto: res.socket.getProtocol(), hsts: res.headers['strict-transport-security'], cookie: (res.headers['set-cookie'] || []).join(' ') });
      res.resume();
    });
    r.on('error', e => resolve({ error: e.message })); r.end('username=mchang&password=' + encodeURIComponent(PW));
  });
  let plain = '';
  try { await fetch('http://localhost:3197/login'); plain = 'answered!'; } catch (e) { plain = 'refused'; }
  hs.child.kill(); fs.rmSync(certDir, { recursive: true, force: true });
  rec('S-10', 'Encryption in transit (HTTPS)', 'Start the app with a certificate; sign in over HTTPS; try plain HTTP on the same port',
    'TLS 1.2 or 1.3; HSTS header; session cookie marked Secure; plain HTTP not answered',
    `${tls.proto}; HSTS "${tls.hsts}"; cookie Secure = ${/; Secure/.test(tls.cookie)}; plain HTTP ${plain}`,
    /TLSv1\.[23]/.test(tls.proto || '') && /max-age=/.test(tls.hsts || '') && /; Secure/.test(tls.cookie) && plain === 'refused');

  // ---------- S-11 second application: Android app ----------
  const M = path.join(APP, 'mobile-app', 'app', 'src', 'main');
  if (fs.existsSync(M)) {
    const man = fs.readFileSync(path.join(M, 'AndroidManifest.xml'), 'utf8');
    const nsc = fs.readFileSync(path.join(M, 'res', 'xml', 'network_security_config.xml'), 'utf8');
    const java = fs.readFileSync(path.join(M, 'java', 'au', 'com', 'lpa', 'ecomms', 'MainActivity.java'), 'utf8');
    const gradle = fs.readFileSync(path.join(APP, 'mobile-app', 'app', 'build.gradle'), 'utf8');
    const checks = {
      'no backup': /allowBackup="false"/.test(man) && /dataExtractionRules/.test(man),
      'HTTPS only (cleartext only to dev PC)': /base-config cleartextTrafficPermitted="false"/.test(nsc) && !/usesCleartextTraffic="true"/.test(man),
      'WebView activity not exported': /\.MainActivity"\s+android:exported="false"/.test(man),
      'no file/content access': /setAllowFileAccess\(false\)/.test(java) && /setAllowContentAccess\(false\)/.test(java),
      'no mixed content': /MIXED_CONTENT_NEVER_ALLOW/.test(java),
      'bad certificates cancelled': /onReceivedSslError[\s\S]{0,200}handler\.cancel\(\)/.test(java),
      'navigation allow-list': /isLpaUrl/.test(java) && /shouldOverrideUrlLoading/.test(java),
      'no JavaScript bridge': !/addJavascriptInterface\(/.test(java),
      'release: R8 + not debuggable + HTTPS URL': /minifyEnabled true/.test(gradle) && /debuggable false/.test(gradle) && /"https:\/\//.test(gradle),
    };
    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    rec('S-11', 'Second application secured: LPA Android app', 'Check the Android manifest, network security config, WebView code and release build settings',
      'All 9 protections present (lint: 0 security issues)', `${Object.keys(checks).length - failed.length}/${Object.keys(checks).length}${failed.length ? ' missing: ' + failed.join(', ') : ''}`, failed.length === 0);
  } else rec('S-11', 'Second application secured: LPA Android app', 'mobile-app folder', 'present', 'mobile-app not found', null);

  await db.pool.end(); await nosql.close();
  fs.writeFileSync(path.join(__dirname, 'security-test-results.json'), JSON.stringify(results, null, 2));
  const p = results.filter(x => x.result === 'PASS').length, na = results.filter(x => x.result === 'N/A').length;
  console.log(`\n${p} PASS, ${results.length - p - na} FAIL${na ? ', ' + na + ' N/A' : ''} of ${results.length}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
