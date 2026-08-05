// AuthController - the User Login page and the login gate.
// Interface-level login for now (any username + password is accepted and a
// session cookie is set); real credential checking, hashing and roles are
// implemented in the security block (ICTPRG537).
exports.loginForm = (req, res) =>
  res.render('login', { title: 'User Login', bare: true, hideNav: true, error: req.query.error === '1' });

exports.login = (req, res) => {
  if (req.body.username && req.body.password) {
    res.setHeader('Set-Cookie', 'otb_auth=1; Path=/; HttpOnly; SameSite=Lax');
    return res.redirect('/');
  }
  return res.redirect('/login?error=1');
};

exports.logout = (req, res) => {
  res.setHeader('Set-Cookie', 'otb_auth=; Path=/; Max-Age=0');
  res.redirect('/login');
};
