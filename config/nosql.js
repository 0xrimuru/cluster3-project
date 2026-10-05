// config/nosql.js - the ONE place the app connects to MongoDB (ICTPRG554).
// The connection string comes from .env (MONGO_URL, never committed). It names the app
// account lpa_nosql_app, which has a custom role with only find / insert / update / remove /
// changeStream on the lpa_nosql database - it cannot drop collections or create users.
// With TLS options in the URL (tls=true&tlsCAFile=...) all traffic is encrypted in transit.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const { MongoClient } = require('mongodb');

const URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/lpa_nosql?directConnection=true';
const DB_NAME = process.env.MONGO_DB || 'lpa_nosql';

// Collection names in one place
const C = {
  sessions: 'sessions',             // login sessions + shopping cart (TTL: expire when idle)
  activity: 'activity_log',         // audit / activity events (TTL: kept 365 days)
  reviews: 'product_reviews',       // customer product reviews (flexible documents)
  ratings: 'product_ratings',       // rating summary per product, kept up to date by a trigger
  state: 'system_state',            // small bookkeeping docs (e.g. trigger resume token)
};

const client = new MongoClient(URL, {
  appName: 'lpa-ecomms',
  maxPoolSize: Number(process.env.MONGO_POOL || 20),   // connections shared by all requests
  serverSelectionTimeoutMS: 3000,                      // fail fast when MongoDB is down
  retryWrites: true,
});

let dbPromise = null;
// Returns the connected database (connects on first use; retries after a failure).
function db() {
  if (!dbPromise) {
    dbPromise = client.connect().then(c => c.db(DB_NAME)).catch(err => { dbPromise = null; throw err; });
  }
  return dbPromise;
}
// col(name, { writeConcern }) - a collection handle; the write concern is chosen per collection
const col = async (name, options) => (await db()).collection(name, options);

// Errors that mean "MongoDB is not available"
const DOWN = ['MongoServerSelectionError', 'MongoNetworkError', 'MongoNotConnectedError', 'MongoTopologyClosedError', 'MongoNetworkTimeoutError'];
const isDown = err => !!err && (DOWN.includes(err.name) || (err.name === 'MongoServerError' && err.code === 18)); // 18 = AuthenticationFailed

// Start-up report: who we are connected as, replica set (needed for change-stream triggers), TLS.
async function check() {
  const d = await db();
  const admin = d.admin();
  const hello = await admin.command({ hello: 1 });
  const build = await admin.command({ buildInfo: 1 });
  const status = await d.command({ connectionStatus: 1 });
  const who = (status.authInfo.authenticatedUsers[0] || {}).user || '(no login - authorization OFF)';
  return { version: build.version, db: DB_NAME, who, replicaSet: hello.setName || null, tls: /[?&](tls|ssl)=true/i.test(URL) || /^mongodb\+srv:/.test(URL) };
}

const close = () => client.close();
// Host part only, for messages (never print the password)
const where = () => URL.replace(/\/\/[^@/]*@/, '//***@').replace(/\?.*$/, '');

module.exports = { db, col, C, client, check, close, isDown, where, DB_NAME };
