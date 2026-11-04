// config/database.js - the ONE place the app connects to MySQL / MariaDB (ICTDBS507).
// Credentials come from environment variables (the .env file, which is never committed -
// see .env.example). The app connects as a limited account (lpa_app: SELECT / INSERT /
// UPDATE / DELETE on lpa_ecomms only), never as root.
// Every query uses placeholders (?) - mysql2 sends the values separately from the SQL
// text, so user input can never change the SQL (protection against SQL injection).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mysql = require('mysql2/promise');

const settings = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'lpa_app',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lpa_ecomms',
};

const pool = mysql.createPool(Object.assign({}, settings, {
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 10),
  decimalNumbers: true,   // DECIMAL columns come back as numbers, not strings
  dateStrings: true,      // DATETIME columns come back as 'YYYY-MM-DD HH:MM:SS'
  charset: 'utf8mb4',
}));

// Run one statement. Returns rows for SELECT, or the result (insertId, affectedRows) otherwise.
// `conn` lets a model take part in a transaction started by the caller.
async function query(sql, params = [], conn = pool) {
  const [rows] = await conn.execute(sql, params);
  return rows;
}

// Run several statements as ONE unit of work: all are saved (COMMIT) or none are (ROLLBACK).
// Used for checkout, new invoices, deleting invoices and registration.
async function transaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Used at start-up to report a clear message if the database cannot be reached.
async function check() {
  const rows = await query('SELECT VERSION() AS version, DATABASE() AS db, CURRENT_USER() AS who');
  return rows[0];
}

// Errors that mean "the database is not available" (shown to users as a 503 page).
const DOWN_CODES = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_DBACCESS_DENIED_ERROR'];
const isDown = err => !!err && DOWN_CODES.includes(err.code);

// The date / time in Brisbane as 'YYYY-MM-DD HH:MM:SS' (stored as LPA's local time,
// whatever time zone the database server is set to).
function nowLocal() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

// LIKE '%text%' with the user's % _ \ escaped, so they are matched literally
const like = s => '%' + String(s).replace(/[\\%_]/g, c => '\\' + c) + '%';

module.exports = { like, pool, query, transaction, check, isDown, nowLocal, settings: Object.assign({}, settings, { password: settings.password ? '********' : '(none)' }) };
