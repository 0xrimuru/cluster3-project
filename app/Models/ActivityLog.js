// ActivityLog - appends important events (sign-in success/failure, registrations,
// orders, invoices, user changes) to logs/lpa.log, like the LPA reference app's lpa_log().
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'logs');
const FILE = path.join(DIR, 'lpa.log');

function stamp() {
  return new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour12: false });
}

exports.write = (req, message) => {
  const ip = (req && (req.ip || (req.socket && req.socket.remoteAddress))) || '-';
  const line = `${stamp()} | ${ip} | ${message}\n`;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.appendFileSync(FILE, line);
  } catch (e) {
    console.error('Could not write activity log:', e.message);
  }
};
exports.FILE = FILE;
