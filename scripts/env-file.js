// The .env helper shared by the setup scripts (db:setup, nosql:setup, security:cert).
// .env holds passwords and keys, so it is never committed (see .gitignore).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ENV = path.join(ROOT, '.env');

// .env, or .env.example on a fresh copy
const readEnv = () => fs.readFileSync(fs.existsSync(ENV) ? ENV : path.join(ROOT, '.env.example'), 'utf8');

// Set NAME="value" (replace the line or add it) and make it visible to this process.
function setEnv(name, value) {
  const line = `${name}="${value}"`;
  const re = new RegExp(`^${name}=.*$`, 'm');
  const text = readEnv();
  fs.writeFileSync(ENV, re.test(text) ? text.replace(re, () => line) : text.replace(/\s*$/, '\n') + line + '\n');
  process.env[name] = value;
}

module.exports = { ENV, readEnv, setEnv };
