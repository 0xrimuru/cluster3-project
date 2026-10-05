// AuthController - the User Login page and the login gate.
// Interface-level login for now (any username + password is accepted and a
// session cookie is set); real credential checking, hashing and roles are
// implemented in the security block (ICTPRG537).
exports.loginForm = (req, res) =>
  res.render('login', { title: 'User Login', bare: true, hideNav: true, error: req.query.error === '1' });

exports.login = (req, res) => {
  if (req.body.username && req.body.password) {
    // Remember who signed in, so the stock audit trail records the real user.
    const user = encodeURIComponent(String(req.body.username).trim().slice(0, 30));
    res.setHeader('Set-Cookie', [
      'otb_auth=1; Path=/; HttpOnly; SameSite=Lax',
      `lpa_user=${user}; Path=/; HttpOnly; SameSite=Lax`,
    ]);
    return res.redirect('/');
  }
  return res.redirect('/login?error=1');
};

// Read the signed-in user name from the cookie (used by the audit ledger).
exports.currentUser = (req) => {
  const m = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('lpa_user='));
  const name = m ? decodeURIComponent(m.slice('lpa_user='.length)) : '';
  return name || 'Unknown user';
};

exports.logout = (req, res) => {
  res.setHeader('Set-Cookie', ['otb_auth=; Path=/; Max-Age=0', 'lpa_user=; Path=/; Max-Age=0']);
  res.redirect('/login');
};
