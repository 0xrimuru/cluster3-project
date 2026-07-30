// HomeController (the "C" of MVC).
// Renders the home page THROUGH a controller (not as static HTML),
// which is exactly what the MVC unit asks you to demonstrate.
const Book = require('../Models/Book');

exports.index = (req, res) => {
  res.render('home', {
    title: 'OT Tech Bookstore',
    count: Book.all().length,
  });
};
