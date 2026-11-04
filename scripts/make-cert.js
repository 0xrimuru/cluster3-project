// scripts/make-cert.js - creates a self-signed TLS certificate for HTTPS:   npm run security:cert
// Saves certs/lpa-dev.key + certs/lpa-dev.crt (the folder is not committed) and sets HTTPS_KEY /
// HTTPS_CERT in .env. Then `npm start` serves https://localhost:3000 (the browser warns once,
// because the certificate is not from a public authority - fine for development and the demo).
// RSA 2048 + SHA-256, valid 1 year, for localhost / 127.0.0.1 / 10.0.2.2 (Android emulator).
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');
const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'certs');
const { setEnv } = require('./env-file');

const pems = selfsigned.generate([{ name: 'commonName', value: 'localhost' }, { name: 'organizationName', value: 'LPA eComms (development)' }], {
  keySize: 2048, days: 365, algorithm: 'sha256',
  extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }, { type: 7, ip: '10.0.2.2' }] }],
});
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(path.join(DIR, 'lpa-dev.key'), pems.private, { mode: 0o600 });
fs.writeFileSync(path.join(DIR, 'lpa-dev.crt'), pems.cert);

setEnv('HTTPS_KEY', 'certs/lpa-dev.key');
setEnv('HTTPS_CERT', 'certs/lpa-dev.crt');
console.log('Created certs/lpa-dev.key and certs/lpa-dev.crt; HTTPS_KEY / HTTPS_CERT set in .env');
console.log('Start the app (npm start) and open https://localhost:3000');
console.log('To go back to HTTP: delete the HTTPS_KEY and HTTPS_CERT lines from .env');
