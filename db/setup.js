// db/setup.js - creates (or RE-creates) the LPA eComms database:   npm run db:setup
//  1. makes .env from .env.example if it does not exist, with a random password for lpa_app
//  2. connects as the admin account (DB_ADMIN_USER, e.g. root in XAMPP)
//  3. runs db/schema.sql (tables, keys, constraints) and db/seed.sql (starting data)
//  4. creates the app account lpa_app with ONLY SELECT/INSERT/UPDATE/DELETE on lpa_ecomms
// WARNING: re-running it deletes all data and puts the starting data back.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const ENV = path.join(ROOT, '.env');

if (!fs.existsSync(ENV)) fs.writeFileSync(ENV, fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8'));
if (/^DB_PASSWORD=(change-me)?\s*$/m.test(fs.readFileSync(ENV, 'utf8'))) {
  const pw = crypto.randomBytes(18).toString('base64url');
  fs.writeFileSync(ENV, fs.readFileSync(ENV, 'utf8').replace(/^DB_PASSWORD=.*$/m, 'DB_PASSWORD=' + pw));
  console.log('Set a random password for lpa_app in .env (this file is not committed).');
}
if (!/^DATA_KEY="?[A-Za-z0-9+/=]{40,}/m.test(fs.readFileSync(ENV, 'utf8'))) {
  // encryption key for personal data (shared with MongoDB - see app/Security/crypto.js)
  const key = crypto.randomBytes(32).toString('base64');
  let text = fs.readFileSync(ENV, 'utf8');
  text = /^DATA_KEY=.*$/m.test(text) ? text.replace(/^DATA_KEY=.*$/m, `DATA_KEY="${key}"`) : text.replace(/\s*$/, '\n') + `DATA_KEY="${key}"\n`;
  fs.writeFileSync(ENV, text);
  console.log('Added DATA_KEY (AES-256 key) to .env');
}
require('dotenv').config({ path: ENV, quiet: true });
const mysql = require('mysql2/promise');
const { encrypt, blindIndex, isEncrypted } = require('../app/Security/crypto');
const phoneDigits = p => String(p || '').replace(/\D/g, '');

(async () => {
  const host = process.env.DB_HOST || '127.0.0.1';
  const dbName = process.env.DB_NAME || 'lpa_ecomms';
  const appUser = process.env.DB_USER || 'lpa_app';
  const appPw = process.env.DB_PASSWORD;
  if (!appPw || appPw === 'change-me') throw new Error('Set DB_PASSWORD in .env first.');
  if (dbName !== 'lpa_ecomms') throw new Error('schema.sql creates the database lpa_ecomms - keep DB_NAME=lpa_ecomms.');

  const admin = await mysql.createConnection({
    host, port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_ADMIN_USER || 'root', password: process.env.DB_ADMIN_PASSWORD || '',
    multipleStatements: true, // only this setup script runs several statements at once
  });
  const [[v]] = await admin.query('SELECT VERSION() AS v');
  console.log(`Connected to ${host} as ${process.env.DB_ADMIN_USER || 'root'} (server ${v.v})`);

  for (const file of ['schema.sql', 'seed.sql']) {
    await admin.query(fs.readFileSync(path.join(__dirname, file), 'utf8'));
    console.log(`Ran db/${file}`);
  }

  // 9.1 encrypt the client phone numbers loaded by seed.sql (plain text -> AES-256-GCM + blind index)
  const [phones] = await admin.query('SELECT lpa_client_ID AS id, lpa_client_phone AS phone FROM lpa_clients');
  for (const c of phones.filter(c => !isEncrypted(c.phone))) {
    await admin.query('UPDATE lpa_clients SET lpa_client_phone = ?, lpa_client_phone_idx = ? WHERE lpa_client_ID = ?', [encrypt(c.phone), blindIndex(phoneDigits(c.phone)), c.id]);
  }
  console.log(`Encrypted ${phones.length} client phone numbers`);

  // Least privilege: the web app can read and change rows, but cannot drop or alter tables.
  for (const h of ['localhost', '127.0.0.1', '::1']) {
    await admin.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [appUser, h, appPw]);
    await admin.query('ALTER USER ?@? IDENTIFIED BY ?', [appUser, h, appPw]);
    await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${dbName}\`.* TO ?@?`, [appUser, h]);
  }
  await admin.query('FLUSH PRIVILEGES');
  console.log(`Account ${appUser} ready (SELECT, INSERT, UPDATE, DELETE on ${dbName}.*)`);

  const [counts] = await admin.query(`SELECT 'lpa_clients' t, COUNT(*) n FROM lpa_clients UNION ALL SELECT 'lpa_stock', COUNT(*) FROM lpa_stock
    UNION ALL SELECT 'lpa_users', COUNT(*) FROM lpa_users UNION ALL SELECT 'lpa_invoices', COUNT(*) FROM lpa_invoices
    UNION ALL SELECT 'lpa_invoice_items', COUNT(*) FROM lpa_invoice_items UNION ALL SELECT 'lpa_stock_ledger', COUNT(*) FROM lpa_stock_ledger`);
  console.table(counts);
  await admin.end();
  console.log('Done. Start the app with: npm start');
})().catch(err => {
  console.error('\nDatabase setup failed:', err.code || '', err.message);
  if (err.code === 'ECONNREFUSED') console.error('-> Is MySQL / MariaDB running? (XAMPP Control Panel -> MySQL -> Start)');
  if (/ACCESS_DENIED/.test(err.code || '')) console.error('-> Check DB_ADMIN_USER / DB_ADMIN_PASSWORD in .env');
  process.exit(1);
});
