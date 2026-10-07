// app/Security/sandbox.js - reports the code-access security the app is running under.
// `npm run start:secure` starts the app with Node's permission model (--permission): the code
// may READ only its own folder (+ the MongoDB CA file), WRITE only logs/, and may NOT start
// other programs or worker threads. Any library that tries more is stopped with
// ERR_ACCESS_DENIED. (Node's permission model does not limit network access.)
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const LOGS = path.join(ROOT, 'logs');
const OUTSIDE = process.platform === 'win32' ? 'C:\\Windows\\win.ini' : '/etc/passwd';

function status() {
  const p = process.permission;
  if (!p) return { enabled: false, checks: [] };
  const checks = [
    { what: 'Read the app folder', expect: true, allowed: p.has('fs.read', path.join(ROOT, 'server.js')) },
    { what: `Read a system file (${OUTSIDE})`, expect: false, allowed: p.has('fs.read', OUTSIDE) },
    { what: 'Write the activity log folder (logs/)', expect: true, allowed: p.has('fs.write', LOGS) },
    { what: 'Change the app code (server.js)', expect: false, allowed: p.has('fs.write', path.join(ROOT, 'server.js')) },
    { what: 'Start other programs (child_process)', expect: false, allowed: p.has('child') },
    { what: 'Start worker threads', expect: false, allowed: p.has('worker') },
  ];
  return { enabled: true, checks, ok: checks.every(c => c.allowed === c.expect) };
}

module.exports = { status, ROOT, LOGS };
