// db/nosql/setup.js - creates (or RE-creates) the LPA MongoDB database:   npm run nosql:setup
//  1. adds to .env: DATA_KEY (encryption key), MONGO_URL (app account) - .env is never committed
//  2. connects with the admin account (MONGO_ADMIN_URL); starts the replica set if mongod.cfg
//     has one that is not started yet (needed for change-stream triggers)
//  3. drops lpa_nosql and creates each collection WITH its $jsonSchema validator and indexes
//  4. inserts the starting reviews (insertMany) and builds the rating summaries
//  5. creates the app account lpa_nosql_app with a least-privilege custom role
//  6. reports whether authorization, the replica set and TLS are on
// WARNING: re-running it deletes all NoSQL data (sessions, activity log, reviews).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const ENV = path.join(ROOT, '.env');

// ---- .env helpers ----
function readEnv() { return fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8'); }
function setEnv(name, value) {
  let text = readEnv();
  const line = `${name}="${value}"`;
  text = new RegExp(`^${name}=.*$`, 'm').test(text) ? text.replace(new RegExp(`^${name}=.*$`, 'm'), line) : text.replace(/\s*$/, '\n') + line + '\n';
  fs.writeFileSync(ENV, text);
  process.env[name] = value;
}
require('dotenv').config({ path: ENV, quiet: true });
if (!process.env.DATA_KEY) { setEnv('DATA_KEY', crypto.randomBytes(32).toString('base64')); console.log('Added DATA_KEY (AES-256 key) to .env'); }

const { MongoClient } = require('mongodb');
const MODEL = require('./collections');
const SEED = require('./seed-reviews');
const DB = 'lpa_nosql';
const APP_USER = 'lpa_nosql_app';
const HOST = process.env.MONGO_HOST || '127.0.0.1:27017';
const OPTIONS = process.env.MONGO_OPTIONS || '';                 // e.g. tls=true&tlsCAFile=C:/mongo/ca.pem
const withOpts = base => base + (OPTIONS ? (base.includes('?') ? '&' : '?') + OPTIONS : '');
const ADMIN_URL = process.env.MONGO_ADMIN_URL || withOpts(`mongodb://${HOST}/?directConnection=true`);

(async () => {
  let admin = new MongoClient(ADMIN_URL, { serverSelectionTimeoutMS: 4000 });
  await admin.connect();
  const hello = await admin.db('admin').command({ hello: 1 });
  const build = await admin.db('admin').command({ buildInfo: 1 });
  console.log(`Connected to MongoDB ${build.version} at ${HOST}`);

  // ---- replica set: start it if mongod.cfg names one but it was never initiated ----
  let replicaSet = hello.setName || null;
  if (!replicaSet) {
    try { await admin.db('admin').command({ replSetGetStatus: 1 }); } catch (e) {
      if (e.code === 94) { // NotYetInitialized
        await admin.db('admin').command({ replSetInitiate: {} });
        for (let i = 0; i < 30 && !(await admin.db('admin').command({ hello: 1 })).isWritablePrimary; i++) await new Promise(r => setTimeout(r, 500));
        replicaSet = (await admin.db('admin').command({ hello: 1 })).setName;
        console.log(`Replica set "${replicaSet}" started (change-stream triggers available)`);
      }
    }
  }

  // ---- first admin account (only possible while MongoDB has no users yet) ----
  if (!process.env.MONGO_ADMIN_URL) {
    const users = await admin.db('admin').command({ usersInfo: 1 }).catch(() => ({ users: [{}] }));
    if (!users.users.length) {
      const pw = crypto.randomBytes(18).toString('base64url');
      await admin.db('admin').command({ createUser: 'lpa_admin', pwd: pw, roles: ['root'] });
      setEnv('MONGO_ADMIN_URL', withOpts(`mongodb://lpa_admin:${pw}@${HOST}/admin?directConnection=true`));
      console.log('Created MongoDB admin account lpa_admin (password saved in .env as MONGO_ADMIN_URL)');
      await admin.close();
      admin = new MongoClient(process.env.MONGO_ADMIN_URL, { serverSelectionTimeoutMS: 4000 });
      await admin.connect();
    }
  }

  // ---- collections, validators, indexes ----
  const db = admin.db(DB);
  await db.dropDatabase();
  for (const c of MODEL) {
    const opts = {};
    if (c.validator) Object.assign(opts, { validator: c.validator, validationLevel: 'strict', validationAction: 'error' });
    if (c.preAndPostImages) opts.changeStreamPreAndPostImages = { enabled: true };
    await db.createCollection(c.name, opts);
    for (const ix of c.indexes) {
      const { key, ...o } = ix;
      await db.collection(c.name).createIndex(key, o);
    }
    console.log(`Created ${c.name.padEnd(16)} validator: ${c.validator ? 'yes' : 'no '}  indexes: ${c.indexes.map(i => i.name).join(', ') || '-'}`);
  }

  // ---- starting data: insertMany (one round trip for all reviews) ----
  const res = await db.collection('product_reviews').insertMany(SEED, { ordered: true, writeConcern: { w: 'majority' } });
  console.log(`Inserted ${res.insertedCount} reviews`);
  const summary = await db.collection('product_reviews').aggregate([
    { $match: { status: 'published' } },
    { $group: { _id: '$sku', avg: { $avg: '$rating' }, count: { $sum: 1 }, r: { $push: '$rating' } } },
  ]).toArray();
  await db.collection('product_ratings').insertMany(summary.map(s => ({
    _id: s._id, avg: Math.round(s.avg * 100) / 100, count: s.count,
    stars: Object.fromEntries([1, 2, 3, 4, 5].map(n => [String(n), s.r.filter(x => x === n).length])), updatedAt: new Date(),
  })));
  console.log(`Built ${summary.length} rating summaries`);

  // ---- least-privilege role + app account ----
  const actions = ['find', 'insert', 'update', 'remove', 'changeStream', 'listCollections', 'listIndexes', 'collStats'];
  const privileges = [{ resource: { db: DB, collection: '' }, actions }];
  const roleExists = (await db.command({ rolesInfo: 'lpaAppRole' })).roles.length > 0;
  if (roleExists) await db.command({ updateRole: 'lpaAppRole', privileges, roles: [] });
  else await db.command({ createRole: 'lpaAppRole', privileges, roles: [] });
  const appPw = (process.env.MONGO_URL && decodeURIComponent((process.env.MONGO_URL.match(new RegExp(`//${APP_USER}:([^@]+)@`)) || [])[1] || '')) || crypto.randomBytes(18).toString('base64url');
  const exists = (await db.command({ usersInfo: APP_USER })).users.length > 0;
  if (exists) await db.command({ updateUser: APP_USER, pwd: appPw, roles: [{ role: 'lpaAppRole', db: DB }] });
  else await db.command({ createUser: APP_USER, pwd: appPw, roles: [{ role: 'lpaAppRole', db: DB }], mechanisms: ['SCRAM-SHA-256'] });
  setEnv('MONGO_URL', withOpts(`mongodb://${APP_USER}:${encodeURIComponent(appPw)}@${HOST}/${DB}?authSource=${DB}&directConnection=true`));
  console.log(`Account ${APP_USER} ready (role lpaAppRole: ${actions.join(', ')})`);
  await admin.close();

  // ---- security report ----
  let authOn = true;
  const anon = new MongoClient(withOpts(`mongodb://${HOST}/?directConnection=true`), { serverSelectionTimeoutMS: 4000 });
  try { await anon.connect(); await anon.db(DB).collection('product_reviews').findOne(); authOn = false; } catch (e) { authOn = e.code === 13 || /requires authentication|Unauthorized/i.test(e.message); }
  await anon.close().catch(() => {});
  console.log(`\nAuthorization (login required): ${authOn ? 'ON' : 'OFF'}`);
  console.log(`Replica set (change-stream trigger): ${replicaSet || 'none - the rating trigger runs inside the app instead'}`);
  console.log(`TLS (encryption in transit): ${/tls=true|ssl=true/i.test(OPTIONS) ? 'ON' : 'OFF (localhost only)'}`);
  if (!authOn || !replicaSet) {
    const keyFile = path.join(__dirname, 'mongo-keyfile');
    if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(756).toString('base64'), { mode: 0o400 });
    console.log(`\nTo turn on login + triggers, add this to mongod.cfg and restart the MongoDB service:
  security:
    authorization: enabled
    keyFile: ${keyFile.replace(/\\/g, '/')}
  replication:
    replSetName: rs0
then run  npm run nosql:setup  again (it starts the replica set).`);
  }
  console.log('\nDone.');
})().catch(err => {
  console.error('\nNoSQL setup failed:', err.codeName || err.name, err.message);
  if (/ECONNREFUSED|Server selection/i.test(err.message)) console.error('-> Is MongoDB running? (Windows: Services -> MongoDB Server -> Start)');
  if (err.code === 13 || err.code === 18) console.error('-> MongoDB needs a login: set MONGO_ADMIN_URL in .env to an admin account');
  process.exit(1);
});
