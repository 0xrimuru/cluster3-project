// app/Security/crypto.js - encryption helpers (used by the NoSQL models; reused in ICTPRG537).
// - encrypt / decrypt: AES-256-GCM with a random 12-byte IV per value. GCM also adds an
//   authentication tag, so a changed ciphertext is detected instead of decrypting to rubbish.
//   The 32-byte key is DATA_KEY in .env (base64) - it is never stored in the database or Git.
// - hashToken: SHA-256 of a session token, so the sessions collection never holds a usable token.
const crypto = require('crypto');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env'), quiet: true });

let key = null;
function getKey() {
  if (key) return key;
  const raw = process.env.DATA_KEY ? Buffer.from(process.env.DATA_KEY, 'base64') : null;
  if (!raw || raw.length !== 32) throw new Error('DATA_KEY missing or not 32 bytes (base64) - run: npm run nosql:setup');
  key = raw;
  return key;
}

// Returns "v1.<iv>.<tag>.<ciphertext>" (base64url parts), or null for empty input.
function encrypt(plain) {
  if (plain === null || plain === undefined || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

function decrypt(token) {
  if (!token) return null;
  const [v, iv, tag, data] = String(token).split('.');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Not an encrypted value');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

// Blind index: a keyed hash (HMAC-SHA256) of a normalised value. Two equal values give the same
// index, so an encrypted column can still be searched for an EXACT match - without decrypting
// every row and without storing the value in the clear. The HMAC key is derived from DATA_KEY
// with HKDF, so the encryption key and the index key are different keys.
let indexKey = null;
function blindIndex(value) {
  if (value === null || value === undefined || value === '') return null;
  if (!indexKey) indexKey = Buffer.from(crypto.hkdfSync('sha256', getKey(), Buffer.alloc(0), 'lpa-blind-index-v1', 32));
  return crypto.createHmac('sha256', indexKey).update(String(value)).digest('hex');
}
const isEncrypted = v => typeof v === 'string' && /^v1\.[\w-]+\.[\w-]+\.[\w-]+$/.test(v);

const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');
const newKey = () => crypto.randomBytes(32).toString('base64');

module.exports = { encrypt, decrypt, hashToken, newKey, blindIndex, isEncrypted };
