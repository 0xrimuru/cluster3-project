// HomeController (the "C" of MVC). Renders the home dashboard through a controller.
const Book = require('../Models/Book');
const Invoice = require('../Models/Invoice');

exports.index = (req, res) => {
  const books = Book.all();
  const invoices = Invoice.all();
  res.render('home', {
    title: 'OT Tech Bookstore', pageName: 'Home', nav: 'home',
    stats: {
      items: books.length,
      lowStock: books.filter(b => Book.level(b) === 'low').length,
      outStock: books.filter(b => Book.level(b) === 'out').length,
      invoices: invoices.length,
      sales: Invoice.total(invoices),
    },
  });
};
