// scripts/secure-start.js - starts LPA eComms with CODE-ACCESS SECURITY:   npm run start:secure
// Uses Node's permission model. The policy (what the code may touch) is built here:
//   read : this app folder (code, views, node_modules, .env) + the MongoDB / HTTPS certificate files
//   write: logs/ only
//   no child processes, no worker threads, no native add-ons, no WASI
// Everything else is denied (ERR_ACCESS_DENIED) - even if a library is compromised.
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });

const [major, minor] = process.versions.node.split('.').map(Number);
let flag;
if (major > 23 || (major === 23 && minor >= 5) || (major === 22 && minor >= 13)) flag = '--permission';
else if (major >= 20) flag = '--experimental-permission';
else { console.error(`Node ${process.versions.node} has no permission model - use Node 20 or newer.`); process.exit(1); }

const read = new Set([ROOT + path.sep]);
// certificate files named in the settings (they may live outside the app folder)
const settings = [process.env.MONGO_URL, process.env.MONGO_OPTIONS, process.env.HTTPS_CERT, process.env.HTTPS_KEY].join('&');
for (const m of settings.matchAll(/tls(?:CAFile|CertificateKeyFile)=([^&"]+)/g)) read.add(path.resolve(decodeURIComponent(m[1])));
['HTTPS_CERT', 'HTTPS_KEY'].forEach(k => { if (process.env[k]) read.add(path.resolve(ROOT, process.env[k])); });
const LOGS = path.join(ROOT, 'logs');
fs.mkdirSync(LOGS, { recursive: true });

const args = [flag, ...[...read].map(r => `--allow-fs-read=${r}`), `--allow-fs-write=${LOGS}${path.sep}`, path.join(ROOT, 'server.js')];
console.log('Code-access policy:');
[...read].forEach(r => console.log('  read  ' + r));
console.log('  write ' + LOGS + path.sep);
console.log('  denied: everything else, child processes, worker threads, add-ons\n');

const child = spawn(process.execPath, args, { stdio: 'inherit', env: process.env, cwd: ROOT });
['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => child.kill(sig)));
child.on('exit', code => process.exit(code === null ? 1 : code));
