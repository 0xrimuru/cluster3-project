// HomeController - home page (different for staff and customers), Help, More menu and Preferences.
const Product = require('../Models/Product');
const Invoice = require('../Models/Invoice');

exports.index = async (req, res) => {
  // Customers get a shop-front home; staff and administrators get the business dashboard.
  if (req.user.group === 'customer') {
    const [forSale, recent] = await Promise.all([Product.forSale(), Invoice.forClient(req.user.clientId, 3)]);
    const featured = forSale.filter(p => p.quantity > 0).sort((a, b) => b.quantity - a.quantity).slice(0, 4);
    return res.render('home-customer', { title: 'LPA eComms', pageName: 'Home', nav: 'home', featured, recent });
  }
  // Counts and totals are worked out by the database (COUNT / SUM queries).
  const [stock, sales, products] = await Promise.all([Product.stats(), Invoice.stats(), Product.all()]);
  res.render('home', {
    title: 'LPA eComms', pageName: 'Home', nav: 'home',
    stats: Object.assign({}, stock, sales),
    attention: products.filter(p => Product.level(p) !== 'in').sort((a, b) => a.quantity - b.quantity).slice(0, 4),
  });
};

exports.help = (req, res) => res.render('help', { title: 'Help', pageName: 'Help', nav: 'more' });
exports.more = (req, res) => res.render('more', { title: 'More', pageName: 'More', nav: 'more' });
exports.settings = (req, res) => res.render('settings', { title: 'Preferences', pageName: 'Settings', nav: 'more' });
