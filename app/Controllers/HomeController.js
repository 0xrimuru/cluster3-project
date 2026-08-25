// HomeController - home dashboard + preferences page.
const Product = require('../Models/Product');
const Invoice = require('../Models/Invoice');

exports.index = (req, res) => {
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
  });
};

exports.settings = (req, res) =>
  res.render('settings', { title: 'Preferences', pageName: 'Settings', nav: '' });
