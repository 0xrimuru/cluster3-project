// db/export.js - exports the live database to db/export.sql:   npm run db:export
// (the same job as mysqldump / phpMyAdmin "Export", written in Node so it works on any PC).
// Exports table definitions and data; password hashes are included (never plain passwords).
const fs = require('fs');
const path = require('path');
const { pool, query } = require('../config/database');
const TABLES = ['lpa_clients', 'lpa_stock', 'lpa_users', 'lpa_invoices', 'lpa_invoice_items', 'lpa_stock_ledger'];

(async () => {
  const [{ v }] = await query('SELECT VERSION() AS v');
  let out = `-- LPA eComms database export\n-- Exported ${new Date().toISOString()} from server ${v} by db/export.js\n\n`
    + 'CREATE DATABASE IF NOT EXISTS lpa_ecomms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE lpa_ecomms;\nSET FOREIGN_KEY_CHECKS = 0;\n\n';
  for (const t of TABLES) {
    const [[def]] = await pool.query('SHOW CREATE TABLE ??', [t]);
    out += `DROP TABLE IF EXISTS \`${t}\`;\n${def['Create Table']};\n\n`;
    const [rows] = await pool.query('SELECT * FROM ??', [t]);
    if (rows.length) {
      const cols = Object.keys(rows[0]).map(c => '`' + c + '`').join(', ');
      out += `INSERT INTO \`${t}\` (${cols}) VALUES\n` + rows.map(r => '  (' + Object.values(r).map(x => pool.escape(x)).join(', ') + ')').join(',\n') + ';\n\n';
    }
    console.log(`${t}: ${rows.length} row(s)`);
  }
  out += 'SET FOREIGN_KEY_CHECKS = 1;\n';
  const file = path.join(__dirname, 'export.sql');
  fs.writeFileSync(file, out);
  console.log('Saved', path.relative(process.cwd(), file));
  await pool.end();
})().catch(e => { console.error('Export failed:', e.code || '', e.message); process.exit(1); });
