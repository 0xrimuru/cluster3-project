// ICTPRG554 (Phase 8 / NoSQL) - MongoDB tests.
// Checks: authentication + least privilege, TLS, field encryption, data types (validators),
// indexes and query plans, insert one / many (throughput), find one / many / by index / text,
// update, delete, unique index, change-stream trigger, TTL expiry, sessions across restarts,
// page permissions and "MongoDB down" handling.
//   npm run db:setup && npm run nosql:setup && npm start
//   BASE=http://localhost:3000 node docs/phase8/nosql-tests.js
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const APP = path.resolve(__dirname, '../..');
require('dotenv').config({ path: path.join(APP, '.env'), quiet: true });
const { MongoClient, ObjectId } = require('mongodb');
const { encrypt, decrypt, hashToken } = require(APP + '/app/Security/crypto');
const BASE = process.env.BASE || 'http://localhost:3000';
const APP_URL = process.env.MONGO_URL;
const ADMIN_URL = process.env.MONGO_ADMIN_URL;
const OPTS = process.env.MONGO_OPTIONS || '';
const HOST = process.env.MONGO_HOST || '127.0.0.1:27017';
const results = [];
const jar = {}, csrf = {}, token = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

function rec(id, title, steps, query, expected, actual, pass) {
  const result = pass === null ? 'N/A' : (pass ? 'PASS' : 'FAIL');
  results.push({ id, title, steps, query, expected, actual, result });
  console.log(`${result.padEnd(4)}  ${id}  ${title}  ->  ${actual}`);
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
async function login(who, username, base = BASE) {
  const r = await fetch(base + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username, password: 'Lpa#2026' }).toString() });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  jar[who] = sc.map(c => c.split(';')[0]).filter(c => !c.endsWith('=')).join('; ');
  token[who] = (jar[who].match(/lpa_sid=([0-9a-f]+)/) || [])[1];
  const page = await fetch(base + '/more', { headers: { cookie: jar[who] } }).then(x => x.text());
  csrf[who] = (page.match(/name="csrf-token" content="([0-9a-f]+)"/) || [])[1] || '';
}
function startServer(port, env = {}) {
  const child = spawn(process.execPath, ['server.js'], { cwd: APP, env: Object.assign({}, process.env, { PORT: String(port) }, env), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  return { child, log: () => out, url: `http://localhost:${port}` };
}
const withOpts = u => u + (OPTS ? (u.includes('?') ? '&' : '?') + OPTS : '');
const planStages = plan => JSON.stringify(plan.queryPlanner.winningPlan).match(/"stage":"[A-Z_]+"/g).map(s => s.slice(9, -1));
const planIndex = plan => (JSON.stringify(plan.queryPlanner.winningPlan).match(/"indexName":"([^"]+)"/) || [])[1] || '-';

(async () => {
  const admin = new MongoClient(ADMIN_URL); await admin.connect();
  const app = new MongoClient(APP_URL); await app.connect();
  const A = admin.db('lpa_nosql'), D = app.db('lpa_nosql');

  // ---------- 1. authentication + least privilege ----------
  const st = await D.command({ connectionStatus: 1, showPrivileges: true });
  const user = st.authInfo.authenticatedUsers[0];
  const actions = [...new Set(st.authInfo.authenticatedUserPrivileges.filter(p => p.resource.db === 'lpa_nosql').flatMap(p => p.actions))].sort();
  let dropErr = '', userErr = '', anonErr = '', badPwErr = '';
  await A.collection('auth_probe').insertOne({ probe: true }); // a throw-away collection to try to drop
  try { await D.collection('auth_probe').drop(); } catch (e) { dropErr = e.codeName; }
  await A.collection('auth_probe').drop().catch(() => {});
  try { await D.command({ createUser: 'hacker', pwd: 'x12345678', roles: ['readWrite'] }); } catch (e) { userErr = e.codeName; }
  const anon = new MongoClient(withOpts(`mongodb://${HOST}/?directConnection=true`), { serverSelectionTimeoutMS: 3000 });
  try { await anon.connect(); await anon.db('lpa_nosql').collection('product_reviews').findOne(); } catch (e) { anonErr = e.codeName || e.name; } finally { await anon.close().catch(() => {}); }
  const bad = new MongoClient(APP_URL.replace(/(lpa_nosql_app:)[^@]+@/, '$1wrong-password@'), { serverSelectionTimeoutMS: 3000 });
  try { await bad.connect(); await bad.db('lpa_nosql').collection('product_reviews').findOne(); } catch (e) { badPwErr = e.codeName || e.name; } finally { await bad.close().catch(() => {}); }
  rec('N-01', 'Login required and least privilege', 'Connect as the app; try to drop a collection and create a user; connect with no login and with a wrong password',
    'connectionStatus; drop(); createUser; find() without auth', 'App = lpa_nosql_app (SCRAM) with find/insert/update/remove only; drop + createUser refused; no-login and wrong password refused',
    `${user && user.user}@${user && user.db}; actions ${actions.join(', ')}; drop -> ${dropErr || 'ALLOWED'}; createUser -> ${userErr || 'ALLOWED'}; no login -> ${anonErr || 'ALLOWED'}; wrong password -> ${badPwErr || 'ALLOWED'}`,
    user && user.user === 'lpa_nosql_app' && !actions.includes('dropCollection') && dropErr === 'Unauthorized' && userErr === 'Unauthorized' && anonErr === 'Unauthorized' && /AuthenticationFailed|MongoServerError/.test(badPwErr));

  // ---------- 2. TLS ----------
  if (/tls=true/i.test(APP_URL)) {
    let plainErr = '';
    const plain = new MongoClient(APP_URL.replace(/[&?]tls=true/i, '').replace(/[&?]tlsCAFile=[^&]+/i, ''), { serverSelectionTimeoutMS: 3000 });
    try { await plain.connect(); await plain.db('lpa_nosql').command({ ping: 1 }); } catch (e) { plainErr = e.name; } finally { await plain.close().catch(() => {}); }
    rec('N-02', 'Encryption in transit (TLS)', 'Connect with TLS (the app) and without TLS', 'net.tls.mode: requireTLS', 'TLS connection works; plain-text connection refused',
      `TLS ok = ${!!user}; without TLS -> ${plainErr || 'ALLOWED'}`, !!user && !!plainErr);
  } else {
    rec('N-02', 'Encryption in transit (TLS)', 'Check MONGO_URL', 'n/a', 'TLS on when MongoDB is not on the same computer', 'TLS not configured (MongoDB on localhost only)', null);
  }

  // ---------- 3. field encryption + hashed session tokens ----------
  await login('cust', 'aturner');
  await login('admin', 'palvim');
  await login('staff', 'mchang');
  await sleep(300);
  const ev = await A.collection('activity_log').findOne({ type: 'LOGIN', user: 'aturner' }, { sort: { at: -1 } });
  const plainIp = decrypt(ev.ipEnc);
  const tampered = ev.ipEnc.slice(0, -2) + (ev.ipEnc.slice(-2) === 'AA' ? 'BB' : 'AA');
  let tamperErr = ''; try { decrypt(tampered); } catch (e) { tamperErr = e.message.slice(0, 40); }
  const sess = await A.collection('sessions').findOne({ _id: hashToken(token.cust) });
  const rawTokenStored = await A.collection('sessions').countDocuments({ _id: token.cust });
  rec('N-03', 'Personal data encrypted; session tokens hashed', 'Read the stored login event and session straight from MongoDB',
    'activity_log.ipEnc (AES-256-GCM); sessions._id = SHA-256(token)', 'IP stored only encrypted and decrypts with the key; a changed ciphertext is rejected; the cookie token is not stored',
    `stored "${ev.ipEnc.slice(0, 22)}..." -> "${plainIp}"; plain IP in doc = ${JSON.stringify(ev).includes(plainIp + '"')}; tampered -> ${tamperErr || 'accepted!'}; session found by hash = ${!!sess}; raw token stored = ${rawTokenStored > 0}`,
    ev.ipEnc.startsWith('v1.') && !!plainIp && !JSON.stringify(ev).includes('"' + plainIp + '"') && !!tamperErr && !!sess && rawTokenStored === 0);

  // ---------- 4. data types: $jsonSchema validators ----------
  const bads = [
    { sku: 'LPA-001', author: { userId: 'U-003', clientId: 'CL-099', name: 'Test' }, rating: 7, title: 'Too many stars', comment: 'Rating outside 1-5 must fail.', status: 'published', helpful: { count: 0, voters: [] }, createdAt: new Date(), updatedAt: new Date() },
    { sku: 'LPA-001', author: { userId: 'U-003', clientId: 'CL-098', name: 'Test' }, rating: '5', title: 'String rating', comment: 'Rating as text must fail.', status: 'published', helpful: { count: 0, voters: [] }, createdAt: new Date(), updatedAt: new Date() },
    { sku: 'LPA-001', author: { userId: 'U-003', clientId: 'CL-097', name: 'Test' }, rating: 4, title: 'No dates', comment: 'Missing required fields must fail.', status: 'published', helpful: { count: 0, voters: [] } },
  ];
  const codes = [];
  for (const b of bads) { try { await D.collection('product_reviews').insertOne(b); codes.push('saved!'); } catch (e) { codes.push(e.code); } }
  const info = await A.listCollections({ name: 'product_reviews' }).next();
  const props = info.options.validator.$jsonSchema.properties;
  rec('N-04', 'Data types enforced by the database', 'Insert reviews straight into MongoDB with rating 7, rating "5" (text) and no dates',
    '$jsonSchema validator (validationAction: error)', 'All 3 refused with DocumentValidationFailure (121)',
    `codes ${codes.join(', ')}; rating = ${props.rating.bsonType} ${props.rating.minimum}-${props.rating.maximum}, tags = ${props.tags.bsonType} (max ${props.tags.maxItems})`, codes.every(c => c === 121));

  // ---------- 5. indexes ----------
  const ix = {};
  for (const c of ['sessions', 'activity_log', 'product_reviews']) ix[c] = await A.collection(c).indexes();
  const ttlS = ix.sessions.find(i => i.name === 'ttl_expiresAt'), ttlA = ix.activity_log.find(i => i.name === 'ttl_at');
  const uniq = ix.product_reviews.find(i => i.name === 'one_review_per_client'), text = ix.product_reviews.find(i => i.name === 'text_search');
  rec('N-05', 'Indexes built (incl. TTL, unique, text)', 'List the indexes of each collection', 'db.collection.getIndexes()',
    'TTL on sessions.expiresAt (0 s) and activity_log.at (365 days); unique one review per client; text index',
    Object.entries(ix).map(([c, l]) => `${c}: ${l.map(i => i.name).join(', ')}`).join(' | ') + `; TTL ${ttlS && ttlS.expireAfterSeconds}s / ${ttlA && ttlA.expireAfterSeconds / 86400} days`,
    ttlS && ttlS.expireAfterSeconds === 0 && ttlA && ttlA.expireAfterSeconds === 31536000 && uniq && uniq.unique && !!text);

  // ---------- 6. queries use the indexes (explain) ----------
  const p1 = await D.collection('product_reviews').find({ sku: 'LPA-001', status: 'published' }).sort({ createdAt: -1 }).explain('queryPlanner');
  const p2 = await D.collection('activity_log').find({ type: 'LOGIN' }).sort({ at: -1 }).explain('queryPlanner');
  const p3 = await D.collection('product_reviews').find({ $text: { $search: 'quiet' } }).explain('queryPlanner');
  const p4 = await D.collection('product_reviews').find({ comment: /quiet/ }).explain('queryPlanner');
  rec('N-06', 'Queries are answered from indexes', 'explain() the product-page, activity-filter and text-search queries; compare with an un-indexed regex',
    'find({sku, status}).sort({createdAt:-1}); find({type}).sort({at:-1}); $text; {comment: /quiet/}', 'IXSCAN / TEXT on the right index (no COLLSCAN); the regex query needs a COLLSCAN',
    `reviews ${planStages(p1).join('>')} (${planIndex(p1)}); activity ${planStages(p2).join('>')} (${planIndex(p2)}); text ${planStages(p3).includes('TEXT_MATCH') ? 'TEXT' : planStages(p3).join('>')}; regex ${planStages(p4).join('>')}`,
    planIndex(p1) === 'sku_status_newest' && planIndex(p2) === 'type_at' && planStages(p3).some(s => /TEXT/.test(s)) && planStages(p4).includes('COLLSCAN'));

  // ---------- 7. insert many + throughput ----------
  const N = 1000;
  const docs = Array.from({ length: N }, (_, i) => ({ at: new Date(), type: 'OTHER', user: 'loadtest', message: `Load test event ${i}`, ipEnc: null, meta: { run: 'N-07', i } }));
  let t = Date.now();
  const many = await D.collection('activity_log', { writeConcern: { w: 1 } }).insertMany(docs, { ordered: false });
  const insMs = Date.now() - t;
  t = Date.now();
  const back = await D.collection('activity_log').find({ user: 'loadtest' }).toArray();
  const readMs = Date.now() - t;
  const del = await D.collection('activity_log').deleteMany({ user: 'loadtest' });
  rec('N-07', 'Insert many + read/write throughput', `insertMany ${N} activity events (unordered), read them back by index, deleteMany`,
    'insertMany(docs, {ordered:false}); find({user}); deleteMany({user})', `${N} inserted, ${N} read, ${N} deleted`,
    `${many.insertedCount} inserted in ${insMs} ms (${Math.round(N / Math.max(insMs, 1) * 1000)} writes/s); ${back.length} read in ${readMs} ms (${Math.round(N / Math.max(readMs, 1) * 1000)} reads/s); ${del.deletedCount} deleted`,
    many.insertedCount === N && back.length === N && del.deletedCount === N);

  // ---------- 8. insert one through the web: customer buys and reviews ----------
  const notBought = await post('cust', '/shop/LPA-004/reviews', { form: { rating: '5', title: 'Not bought', comment: 'I never bought this dock.' } });
  await post('cust', '/cart', { form: { sku: 'LPA-005', qty: '1' }, accept: 'application/json' });
  const co = await post('cust', '/checkout', { form: { address: '7 Park Rd, Milton QLD 4064', phone: '0412 345 678', payment: 'Visa', expectedTotal: '69' } });
  const before = await D.collection('product_ratings').findOne({ _id: 'LPA-005' });
  let r = await post('cust', '/shop/LPA-005/reviews', { form: { rating: '3', title: 'Good webcam, average mic', comment: 'Picture is sharp in daylight; the microphone picks up keyboard noise.', tags: 'video quality, Microphone, video quality' } });
  const mine = await D.collection('product_reviews').findOne({ sku: 'LPA-005', 'author.userId': 'U-003' });
  let after = null;
  for (let i = 0; i < 20 && !(after && after.count === before.count + 1); i++) { await sleep(100); after = await D.collection('product_ratings').findOne({ _id: 'LPA-005' }); }
  rec('N-08', 'Insert one review from the web page', 'Customer reviews a dock she never bought; then buys the webcam and reviews it (tags repeated, mixed case)',
    'insertOne(review) + trigger -> product_ratings', 'First refused (400); review saved with verified=true, tags cleaned to a unique list; product rating updated',
    `not bought -> ${notBought.status}; order ${co.status} -> ${co.loc}; review -> ${r.status}; doc: ${mine ? `${mine.rating} stars, tags [${mine.tags.join(', ')}], verified ${mine.verified}, author ${mine.author.name}` : 'missing'}; rating ${before.avg} (${before.count}) -> ${after && after.avg} (${after && after.count})`,
    notBought.status === 400 && r.status === 302 && mine && mine.verified && mine.tags.length === 2 && mine.tags[1] === 'microphone' && after && after.count === before.count + 1);
  const reviewId = mine && String(mine._id);

  // ---------- 9. unique index ----------
  r = await post('cust', '/shop/LPA-005/reviews', { form: { rating: '5', title: 'Second try', comment: 'A second review of the same product.' } });
  let dupCode = '';
  try { await D.collection('product_reviews').insertOne(Object.assign({}, mine, { _id: new ObjectId() })); } catch (e) { dupCode = e.code; }
  rec('N-09', 'One review per customer per product', 'Post a second review of the webcam; insert a copy straight into MongoDB',
    'unique index { sku, author.clientId }', 'Web: refused with "already reviewed"; database: duplicate key error 11000',
    `web ${r.status} "${/already reviewed/.test(r.text) ? 'already reviewed...' : r.text.slice(0, 40)}"; database -> ${dupCode}`, r.status === 400 && /already reviewed/.test(r.text) && dupCode === 11000);

  // ---------- 10. find one / many / text ----------
  const one = await get('cust', '/shop/LPA-005', J);
  const textHits = (await get('staff', '/reviews?q=' + encodeURIComponent('noise'), J)).json().reviews;
  const low = (await get('staff', '/reviews?maxRating=2', J)).json().reviews;
  const shop = (await get('cust', '/shop', J)).json();
  rec('N-10', 'Find one, find many, text search, filter by index', 'Open the webcam page (JSON); staff search reviews for "noise"; filter 2 stars or less; shop list with ratings',
    'findOne / find({sku}) / $text / {rating:{$lte:2}} / product_ratings {_id:{$in}}', 'Webcam page has its reviews + summary; text search finds the reviews that mention noise; filter finds the 2-star review; shop shows ratings',
    `webcam: ${one.json().reviews.length} reviews, avg ${one.json().summary.avg}; "noise": ${textHits.map(x => x.sku).join(', ')}; <=2 stars: ${low.map(x => x.sku + ' ' + x.rating).join(', ')}; shop items with rating: ${shop.filter(p => p.rating).length}/${shop.length}`,
    one.json().reviews.length >= 2 && textHits.length >= 2 && textHits.some(x => x.sku === 'LPA-005') && low.every(x => x.rating <= 2) && low.length >= 1 && shop.some(p => p.rating));

  // ---------- 11. update: edit + helpful votes (atomic) ----------
  const beforeEdit = await D.collection('product_reviews').findOne({ _id: new ObjectId(reviewId) });
  await sleep(1100);
  r = await post('cust', `/reviews/${reviewId}?_method=PUT`, { form: { rating: '4', title: 'Good webcam, average mic', comment: 'Picture is sharp in daylight; the microphone picks up keyboard noise. Support fixed it with a firmware update.', tags: 'video quality, firmware' } });
  const edited = await D.collection('product_reviews').findOne({ _id: new ObjectId(reviewId) });
  const votes = await Promise.all([post('staff', `/reviews/${reviewId}/helpful`, { accept: 'application/json' }), post('staff', `/reviews/${reviewId}/helpful`, { accept: 'application/json' }), post('admin', `/reviews/${reviewId}/helpful`, { accept: 'application/json' })]);
  const own = await post('cust', `/reviews/${reviewId}/helpful`, { accept: 'application/json' });
  const voted = await D.collection('product_reviews').findOne({ _id: new ObjectId(reviewId) });
  rec('N-11', 'Update: edit a review; helpful votes counted once', 'Customer edits her review (3 -> 4 stars); staff clicks Helpful twice at the same moment, admin once; customer votes on her own review',
    'findOneAndUpdate($set); updateOne({voters:{$ne:id}}, {$inc, $addToSet})', 'Edit saved with a new updatedAt; helpful = 2 (one per person); own vote refused',
    `${r.status}; rating ${beforeEdit.rating} -> ${edited.rating}; updatedAt changed = ${edited.updatedAt > beforeEdit.updatedAt}; votes ${votes.map(v => v.status).join('/')}; own ${own.status}; helpful = ${voted.helpful.count} (${voted.helpful.voters.join(', ')})`,
    r.status === 302 && edited.rating === 4 && edited.updatedAt > beforeEdit.updatedAt && voted.helpful.count === 2 && own.status === 409);

  // ---------- 12. change-stream trigger (database-level) ----------
  const hello = await admin.db('admin').command({ hello: 1 });
  if (hello.setName) {
    const r8before = await A.collection('product_ratings').findOne({ _id: 'LPA-008' });
    const t0 = Date.now();
    const ins = await A.collection('product_reviews').insertOne({ sku: 'LPA-008', author: { userId: null, clientId: 'CL-003', name: 'Logic Peripherals Australia' }, rating: 1, title: 'Cable arrived broken', comment: 'Connector was bent out of the box. Inserted directly into MongoDB by the test.', tags: [], verified: true, status: 'published', helpful: { count: 0, voters: [] }, createdAt: new Date(), updatedAt: new Date() });
    let r8 = null, alert = null;
    for (let i = 0; i < 40; i++) {
      await sleep(100);
      r8 = await A.collection('product_ratings').findOne({ _id: 'LPA-008' });
      alert = await A.collection('activity_log').findOne({ type: 'REVIEW_ALERT', 'meta.reviewId': String(ins.insertedId) });
      if (r8.count === r8before.count + 1 && alert) break;
    }
    const ms = Date.now() - t0;
    const tokenDoc = await A.collection('system_state').findOne({ _id: 'rating-trigger' });
    rec('N-12', 'Change-stream trigger reacts to database changes', 'Insert a 1-star review straight into MongoDB (no app code involved)',
      'collection.watch() on product_reviews (replica set ' + hello.setName + ')', 'Within seconds: product_ratings for LPA-008 rebuilt and a REVIEW_ALERT logged; resume token saved',
      `rating ${r8before.avg} (${r8before.count}) -> ${r8.avg} (${r8.count}) in ${ms} ms; alert = ${alert ? `"${alert.message.slice(0, 45)}..."` : 'none'}; resume token saved = ${!!(tokenDoc && tokenDoc.resumeToken)}`,
      r8.count === r8before.count + 1 && !!alert && !!(tokenDoc && tokenDoc.resumeToken));
    await A.collection('product_reviews').deleteOne({ _id: ins.insertedId });
  } else {
    rec('N-12', 'Change-stream trigger reacts to database changes', 'Check for a replica set', 'hello.setName', 'Replica set needed for change streams', 'standalone server - trigger runs inside the app (inline mode)', null);
  }

  // ---------- 13. delete ----------
  const otherId = String((await D.collection('product_reviews').findOne({ sku: 'LPA-002', 'author.clientId': 'CL-003' }))._id);
  const notMine = await post('cust', `/reviews/${otherId}?_method=DELETE`);
  const rBefore = await A.collection('product_ratings').findOne({ _id: 'LPA-005' });
  r = await post('cust', `/reviews/${reviewId}?_method=DELETE`);
  const gone = await A.collection('product_reviews').countDocuments({ _id: new ObjectId(reviewId) });
  let rAfter = null;
  for (let i = 0; i < 20; i++) { await sleep(100); rAfter = await A.collection('product_ratings').findOne({ _id: 'LPA-005' }); if (rAfter && rAfter.count === rBefore.count - 1) break; }
  rec('N-13', 'Delete: authors delete only their own review', "Customer tries to delete another client's review; then deletes her own",
    'findOneAndDelete({_id, author.userId}) + trigger (pre-image)', 'Other review: 404 (kept); own review removed; webcam rating rebuilt without it',
    `other -> ${notMine.status}; own -> ${r.status}; still in DB = ${gone}; webcam ${rBefore.avg} (${rBefore.count}) -> ${rAfter && rAfter.avg} (${rAfter && rAfter.count})`,
    notMine.status === 404 && r.status === 302 && gone === 0 && rAfter && rAfter.count === rBefore.count - 1);

  // ---------- 14. moderation + permissions ----------
  const hide = await post('staff', `/reviews/${otherId}/status?_method=PUT`, { form: { status: 'hidden' } });
  const visible = (await get('cust', '/shop/LPA-002', J)).json().reviews.some(x => x.id === otherId);
  await post('staff', `/reviews/${otherId}/status?_method=PUT`, { form: { status: 'published' } });
  const custMod = await get('cust', '/reviews');
  const staffLog = await get('staff', '/activity');
  const custLog = await get('cust', '/activity', J);
  rec('N-14', 'Moderation and page permissions', 'Staff hides a review; customer opens Reviews moderation and the Activity log; staff opens the Activity log',
    'updateOne({$set:{status}}); requireRole', 'Hidden review disappears from the shop; customer and staff blocked from pages that are not theirs (403)',
    `hide ${hide.status}; still visible to customers = ${visible}; customer /reviews ${custMod.status}; staff /activity ${staffLog.status}; customer /activity ${custLog.status}`,
    hide.status === 302 && !visible && custMod.status === 403 && staffLog.status === 403 && custLog.status === 403);

  // ---------- 15. sessions: survive a restart, end on logout / deactivation ----------
  await post('cust', '/cart', { form: { sku: 'LPA-007', qty: '2' }, accept: 'application/json' });
  const s1 = startServer(3194);
  await sleep(1800);
  const cartNew = await get('cust', '/cart', {}, s1.url);
  const kept = /Mechanical Numpad NP-22/.test(cartNew.text);
  await post('cust', '/cart/LPA-007', { form: { qty: '0' }, accept: 'application/json' }, s1.url);
  s1.child.kill();
  await login('cust2', 'aturner');
  const countBefore = await A.collection('sessions').countDocuments({ userId: 'U-003' });
  await get('cust2', '/logout');
  const afterLogout = await A.collection('sessions').countDocuments({ userId: 'U-003' });
  await post('admin', '/users/U-003?_method=PUT', { form: { username: 'aturner', firstName: 'Alex', lastName: 'Turner', group: 'customer', status: 'inactive' } });
  const afterDeactivate = await A.collection('sessions').countDocuments({ userId: 'U-003' });
  await post('admin', '/users/U-003?_method=PUT', { form: { username: 'aturner', firstName: 'Alex', lastName: 'Turner', group: 'customer', status: 'active' } });
  rec('N-15', 'Sessions stored in MongoDB', 'Add to cart, then open the cart on a NEW app process; sign out; deactivate the user',
    'insertOne / findOne(_id: hash) / deleteOne / deleteMany({userId})', 'Cart still there after the restart; logout deletes that session; deactivation deletes all of the user\'s sessions',
    `cart after restart ${cartNew.status}, numpad kept = ${kept}; sessions ${countBefore} -> logout ${afterLogout} -> deactivate ${afterDeactivate}`,
    kept && afterLogout === countBefore - 1 && afterDeactivate === 0);

  // ---------- 16. TTL expiry ----------
  const expiredTok = 'f'.repeat(64);
  await D.collection('sessions').insertOne({ _id: hashToken(expiredTok), userId: 'U-002', cart: [], csrf: 'x'.repeat(48), createdAt: new Date(Date.now() - 3 * 3600e3), lastSeen: new Date(Date.now() - 3 * 3600e3), expiresAt: new Date(Date.now() - 60e3), ipEnc: null, agent: 'ttl-test' });
  const refused = await fetch(BASE + '/products', { redirect: 'manual', headers: { cookie: 'lpa_sid=' + expiredTok } });
  const t1 = Date.now();
  let left = 1;
  while (left && Date.now() - t1 < 75e3) { await sleep(2000); left = await A.collection('sessions').countDocuments({ _id: hashToken(expiredTok) }); }
  rec('N-16', 'TTL index removes expired sessions', 'Store a session that expired a minute ago; use its cookie; wait for the TTL monitor',
    'index { expiresAt: 1 } expireAfterSeconds: 0', 'Expired cookie refused at once (redirect to login); MongoDB deletes the document by itself (TTL monitor runs every 60 s)',
    `cookie -> ${refused.status} ${refused.headers.get('location')}; document deleted after ${left ? '>75' : Math.round((Date.now() - t1) / 1000)} s`, refused.status === 302 && left === 0);

  // ---------- 17. MongoDB unavailable ----------
  const s2 = startServer(3195, { MONGO_URL: APP_URL.replace(/(lpa_nosql_app:)[^@]+@/, '$1wrong@') });
  await sleep(4500);
  const down = await fetch(s2.url + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'username=palvim&password=Lpa%232026' });
  const dt = await down.text();
  s2.child.kill();
  rec('N-17', 'Clear message when MongoDB is not available', 'Start the app with a wrong MongoDB password; try to sign in',
    'AuthenticationFailed (18)', 'Console warning; 503 "database is not available"; no technical details',
    `warning = ${/MongoDB NOT connected/.test(s2.log())}; status ${down.status}; message = ${/database is not available/.test(dt)}; leaks = ${/Mongo|lpa_nosql|at .*\.js/.test(dt)}`,
    /MongoDB NOT connected/.test(s2.log()) && down.status === 503 && /database is not available/.test(dt) && !/Mongo|lpa_nosql|at .*\.js/.test(dt));

  await app.close(); await admin.close();
  fs.writeFileSync(path.join(__dirname, 'nosql-test-results.json'), JSON.stringify(results, null, 2));
  const p = results.filter(x => x.result === 'PASS').length, na = results.filter(x => x.result === 'N/A').length;
  console.log(`\n${p} PASS, ${results.length - p - na} FAIL${na ? ', ' + na + ' N/A' : ''} of ${results.length}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
