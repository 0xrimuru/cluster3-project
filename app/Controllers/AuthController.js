// AuthController - the User Login page (interface). Real authentication is
// implemented in the security block (ICTPRG537); for now this is the login UI.
exports.loginForm = (req, res) =>
  res.render('login', { title: 'User Login', bare: true, hideNav: true });

exports.login = (req, res) => {
  // Interface only for now: accept the login and go to the home dashboard.
  res.redirect('/');
};
