// Security middleware (ICTWEB514 "confirm security of web page", OWASP basics):
//  1. HTTP security headers, including a Content Security Policy (CSP) that only allows
//     our own scripts (plus a per-request nonce for the two small inline scripts),
//     Google Fonts and OpenStreetMap map tiles.
//  2. CSRF protection: every signed-in session has a secret token; every request that
//     changes data (POST / PUT / DELETE) must send it back, in a hidden form field
//     (_csrf) or in the X-CSRF-Token header (fetch). A forged request from another site
//     cannot know the token, so it is refused.
const crypto = require('crypto');

function headers(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.nonce = nonce;
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://tile.openstreetmap.org",
    "media-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // HTTPS only: tell the browser to use HTTPS for this site for the next 180 days (HSTS)
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  res.removeHeader('X-Powered-By');
  next();
}

const UNSAFE = ['POST', 'PUT', 'PATCH', 'DELETE'];
function csrf(req, res, next) {
  if (!req.session || !UNSAFE.includes(req.method)) return next(); // login/register have no session yet
  const sent = String((req.body && req.body._csrf) || req.get('X-CSRF-Token') || '');
  const known = Buffer.from(req.session.csrf || '');
  const given = Buffer.from(sent);
  if (known.length && given.length === known.length && crypto.timingSafeEqual(known, given)) return next();
  if ((req.get('accept') || '').includes('application/json') || req.is('application/json')) return res.status(403).json({ error: 'Security check failed (CSRF). Reload the page and try again.' });
  return res.status(403).render('error', { title: 'Security check failed', message: 'This form expired or did not come from LPA eComms. Go back, reload the page and try again.' });
}

module.exports = { headers, csrf };
