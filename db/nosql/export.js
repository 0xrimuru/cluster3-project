// db/nosql/export.js - exports the MongoDB collections to db/nosql/export/*.json:  npm run nosql:export
// (Extended JSON, the same format as mongoexport / Compass "Export Collection").
// Sessions are NOT exported (they are short-lived security data). The activity log keeps the
// IP addresses encrypted.
const fs = require('fs');
const path = require('path');
const { BSON } = require('mongodb');
const { EJSON } = BSON;
const { db, close } = require('../../config/nosql');
const OUT = path.join(__dirname, 'export');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const d = await db();
  for (const name of ['product_reviews', 'product_ratings', 'activity_log']) {
    const docs = await d.collection(name).find().toArray();
    fs.writeFileSync(path.join(OUT, name + '.json'), EJSON.stringify(docs, null, 2, { relaxed: true }));
    console.log(`${name}: ${docs.length} document(s)`);
  }
  console.log('Saved in', path.relative(process.cwd(), OUT));
  await close();
})().catch(e => { console.error('Export failed:', e.message); process.exit(1); });
