// ICTPRG537 - injection attacks: BEFORE (unsafe code) and AFTER (the fix used in LPA eComms).
// The unsafe versions exist ONLY in this demo file - they are never used by the app.
// Each case runs the same attack against both versions and records what happened.
//   npm start   then   BASE=http://localhost:3000 node docs/phase9/injection-demo.js
const fs = require('fs');
const path = require('path');
const APP = path.resolve(__dirname, '../..');
const ejs = require('ejs');
const db = require(APP + '/config/database');
const nosql = require(APP + '/config/nosql');
const BASE = process.env.BASE || 'http://localhost:3000';
const out = [];
const show = (id, attack, input, before, after, fixed) => {
  out.push({ id, attack, input, before, after, result: fixed ? 'FIXED' : 'NOT FIXED' });
  console.log(`\n${id}  ${attack}\n  input : ${input}\n  BEFORE: ${before}\n  AFTER : ${after}\n  => ${fixed ? 'FIXED' : 'NOT FIXED'}`);
};

(async () => {
  // ---------- 1. SQL injection: search ----------
  const evil = "' OR '1'='1";
  const unsafeSearch = async name => (await db.pool.query(`SELECT lpa_user_username AS u FROM lpa_users WHERE lpa_user_username = '${name}'`))[0]; // BEFORE: text glued into SQL
  const safeSearch = async name => db.query('SELECT lpa_user_username AS u FROM lpa_users WHERE lpa_user_username = ?', [name]);         // AFTER: ? placeholder
  const b1 = await unsafeSearch(evil), a1 = await safeSearch(evil);
  show('INJ-1', 'SQL injection - find user', evil,
    `"...WHERE lpa_user_username = '' OR '1'='1'" -> ${b1.length} rows (${b1.map(r => r.u).join(', ')}) - every account leaked`,
    `placeholder: the whole text is one value -> ${a1.length} rows`, b1.length > 1 && a1.length === 0);

  // ---------- 2. SQL injection: log in without the password ----------
  const evil2 = "palvim' -- ";
  const unsafeLogin = async (u, p) => (await db.pool.query(`SELECT lpa_user_ID AS id FROM lpa_users WHERE lpa_user_username = '${u}' AND lpa_user_password = '${p}'`))[0];
  const b2 = await unsafeLogin(evil2, 'anything');
  const a2 = await fetch(BASE + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: evil2, password: 'anything' }).toString() });
  show('INJ-2', 'SQL injection - log in as administrator without a password', `user "${evil2}", password "anything"`,
    `"-- " comments out the password check -> ${b2.length ? 'row for ' + b2[0].id + ' returned = signed in as palvim' : 'no row'}`,
    `real login page -> ${a2.status} ${a2.headers.get('location')} (refused)`, b2.length === 1 && /error=2/.test(a2.headers.get('location') || ''));

  // ---------- 3. NoSQL (MongoDB) operator injection ----------
  const reviews = await nosql.col('product_reviews');
  const body = JSON.parse('{"clientId": {"$ne": null}}');                         // what an attacker sends as JSON
  const b3 = await reviews.countDocuments({ 'author.clientId': body.clientId });  // BEFORE: object used as the value
  const a3local = await reviews.countDocuments({ 'author.clientId': String(body.clientId) }); // AFTER (1): forced to text
  const a3 = await fetch(BASE + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ username: { $ne: '' }, password: { $ne: '' } }) });
  show('INJ-3', 'NoSQL injection - $ne operator instead of a value', '{"clientId": {"$ne": null}}',
    `{ 'author.clientId': {$ne: null} } matches ${b3} reviews (all of them)`,
    `value forced to text -> ${a3local} matches; the app refuses $-keys outright: POST /login with {"username":{"$ne":""}} -> ${a3.status}`, b3 > 1 && a3local === 0 && a3.status === 400);

  // ---------- 4. Cross-site scripting (HTML injection) ----------
  const title = '<img src=x onerror="alert(document.cookie)">';
  const before4 = ejs.render('<h3><%- title %></h3>', { title });  // BEFORE: raw output
  const after4 = ejs.render('<h3><%= title %></h3>', { title });   // AFTER: escaped (used everywhere in the views)
  show('INJ-4', 'Cross-site scripting in a review title', title, before4, after4, before4.includes('<img') && !after4.includes('<img'));

  // ---------- 5. Log injection ----------
  const user = 'nobody"\n05/10/2026 09:00:00 | 127.0.0.1 | LOGIN palvim (administrator)';
  const before5 = `LOGIN FAILED for user "${user}"`.split('\n');
  await fetch(BASE + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: user, password: 'x' }).toString() });
  await new Promise(r => setTimeout(r, 400));
  const logged = await (await nosql.col('activity_log')).find({ message: /LOGIN FAILED for user "nobody/ }).sort({ at: -1 }).limit(1).next();
  show('INJ-5', 'Log injection - fake a successful admin login line', JSON.stringify(user),
    `written as ${before5.length} lines - line 2 looks like "${before5[1].trim()}"`,
    `stored as ONE line: "${logged ? logged.message.slice(0, 90) : 'not found'}..."`, before5.length === 2 && logged && !/\n/.test(logged.message));

  // ---------- 6. Prototype pollution ----------
  const polluted = {};
  const unsafeMerge = (t, s) => { for (const k in s) { if (typeof s[k] === 'object') { t[k] = t[k] || {}; unsafeMerge(t[k], s[k]); } else t[k] = s[k]; } return t; };
  unsafeMerge({}, JSON.parse('{"__proto__": {"isAdmin": true}}'));
  const before6 = ({}).isAdmin === true;
  delete Object.prototype.isAdmin;
  const a6 = await fetch(BASE + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: '{"username":"palvim","__proto__":{"isAdmin":true}}' });
  show('INJ-6', 'Prototype pollution through JSON', '{"__proto__": {"isAdmin": true}}',
    `a naive merge makes EVERY object have isAdmin = ${before6}`, `the app refuses the request -> ${a6.status}; ({}).isAdmin = ${({}).isAdmin}`, before6 && a6.status === 400 && polluted.isAdmin === undefined);

  fs.writeFileSync(path.join(__dirname, 'injection-demo-results.json'), JSON.stringify(out, null, 2));
  console.log(`\n${out.filter(o => o.result === 'FIXED').length} of ${out.length} attacks fixed`);
  await db.pool.end(); await nosql.close();
})().catch(e => { console.error(e); process.exit(1); });
