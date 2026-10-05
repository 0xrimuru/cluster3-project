// HomeController - home page (different for staff and customers), Help, More menu and Preferences.
const Product = require('../Models/Product');
const Invoice = require('../Models/Invoice');

exports.index = (req, res) => {
  // Customers get a shop-front home; staff and administrators get the business dashboard.
  if (req.user.group === 'customer') {
    const featured = Product.forSale().filter(p => p.quantity > 0).sort((a, b) => b.quantity - a.quantity).slice(0, 4);
    return res.render('home-customer', { title: 'LPA eComms', pageName: 'Home', nav: 'home', featured,
      recent: Invoice.forClient(req.user.clientId).slice(0, 3) });
  }
  const products = Product.all();
  const invoices = Invoice.all();
  res.render('home', {
    title: 'LPA eComms', pageName: 'Home', nav: 'home',
    stats: {
      items: products.length,
      lowStock: products.filter(p => Product.level(p) === 'low').length,
      outStock: products.filter(p => Product.level(p) === 'out').length,
      invoices: invoices.length,
      sales: Invoice.total(invoices),
    },
    attention: products.filter(p => Product.level(p) !== 'in').sort((a, b) => a.quantity - b.quantity).slice(0, 4),
  });
};

exports.help = (req, res) => res.render('help', { title: 'Help', pageName: 'Help', nav: 'more' });
exports.more = (req, res) => res.render('more', { title: 'More', pageName: 'More', nav: 'more' });
exports.settings = (req, res) => res.render('settings', { title: 'Preferences', pageName: 'Settings', nav: 'more' });
