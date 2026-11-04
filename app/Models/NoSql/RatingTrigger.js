// RatingTrigger - keeps product_ratings (average, count, stars per product) up to date.
// On a replica set it is a real database TRIGGER: a MongoDB change stream watches
// product_reviews and, whenever a review is inserted, edited, hidden or deleted, it rebuilds
// that product's summary and raises an alert for 1-2 star reviews. The resume token is saved
// in system_state, so changes made while the app was stopped are processed when it restarts.
// Without a replica set (plain local install) the same code runs straight after each write.
const { col, C, db } = require('../../../config/nosql');

let mode = 'off';        // 'change-stream' | 'inline'

// The summary document for one $group result { avg, count, ratings: [..] } (also used by nosql:setup).
const toSummary = s => ({ avg: Math.round(s.avg * 100) / 100, count: s.count,
  stars: Object.fromEntries([1, 2, 3, 4, 5].map(n => [String(n), s.ratings.filter(r => r === n).length])), updatedAt: new Date() });

// Rebuild one product's summary with an aggregation pipeline (upsert, or delete when no reviews).
async function recompute(sku) {
  if (!sku) return null;
  const [s] = await (await col(C.reviews)).aggregate([
    { $match: { sku, status: 'published' } },
    { $group: { _id: '$sku', avg: { $avg: '$rating' }, count: { $sum: 1 }, ratings: { $push: '$rating' } } },
  ]).toArray();
  const ratings = await col(C.ratings);
  if (!s) { await ratings.deleteOne({ _id: sku }); return null; }
  const doc = toSummary(s);
  await ratings.updateOne({ _id: sku }, { $set: doc }, { upsert: true });
  return Object.assign({ _id: sku }, doc);
}

// What the trigger does for one change.
async function handle(change) {
  const doc = change.fullDocument || change.fullDocumentBeforeChange || {};
  await recompute(doc.sku);
  if (change.operationType === 'insert' && doc.rating <= 2) {
    // low rating -> alert for staff (activity log is required lazily to avoid a require loop)
    await require('./ActivityLog').write(null, `REVIEW_ALERT ${doc.rating}-star review of ${doc.sku} by ${doc.author && doc.author.name}: "${doc.title}"`, { type: 'REVIEW_ALERT', user: 'trigger', sku: doc.sku, reviewId: String(doc._id) });
  }
}

async function saveToken(token) {
  await (await col(C.state)).updateOne({ _id: 'rating-trigger' }, { $set: { resumeToken: token, at: new Date() } }, { upsert: true });
}

async function openStream() {
  const state = await (await col(C.state)).findOne({ _id: 'rating-trigger' });
  const opts = { fullDocument: 'updateLookup', fullDocumentBeforeChange: 'whenAvailable' };
  if (state && state.resumeToken) opts.startAfter = state.resumeToken;
  const s = (await col(C.reviews)).watch([{ $match: { operationType: { $in: ['insert', 'update', 'replace', 'delete'] } } }], opts);
  s.on('change', change => {
    handle(change).then(() => saveToken(change._id)).catch(err => console.error('Rating trigger:', err.message));
  });
  s.on('error', async err => {
    console.error('Rating trigger stream error:', err.codeName || err.message);
    if (err.code === 286 || err.codeName === 'ChangeStreamHistoryLost') await (await col(C.state)).deleteOne({ _id: 'rating-trigger' }).catch(() => {});
    s.close().catch(() => {});
  });
  // The stream also closes when the collection is dropped / re-created (npm run nosql:setup)
  // or the connection drops: open it again so the trigger keeps working.
  s.on('close', () => reopen(1500));
}

function reopen(delay) {
  setTimeout(() => openStream().catch(err => {
    console.error('Rating trigger reopen failed:', err.codeName || err.message);
    reopen(Math.min(delay * 2, 30000)); // try again, waiting longer each time (max 30 s)
  }), delay);
}

// Called once at start-up.
async function start() {
  const hello = await (await db()).admin().command({ hello: 1 });
  if (hello.setName) {
    await openStream();
    mode = 'change-stream';
  } else {
    mode = 'inline';
  }
  return mode;
}

// Called by the Review model after each write. With a change stream the trigger does the work.
async function afterWrite(change) {
  if (mode === 'change-stream') return;
  await handle(change);
}

module.exports = { start, recompute, afterWrite, toSummary };
