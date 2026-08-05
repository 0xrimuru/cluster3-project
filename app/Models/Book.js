// Book (stock item) model - the "M" of MVC.
// In-memory data store; replaced by a real database in the later
// database/NoSQL blocks. Controllers only ever talk to this model.
//
// Block 4 (ICTPRG535): each item now carries an on-hand `quantity` and an
// `active`/`disabled` `status`, matching the LPA eComms stock requirements.

const PLACEHOLDER_COVER = '/images/covers/placeholder.png';

let books = [
  { id: 1, title: 'Clean Code', author: 'Robert C. Martin', price: 45.0, quantity: 12, status: 'active', description: 'A handbook of agile software craftsmanship.', cover: '/images/covers/clean-code.png' },
  { id: 2, title: 'The Pragmatic Programmer', author: 'Hunt & Thomas', price: 52.5, quantity: 7, status: 'active', description: 'Your journey to mastery.', cover: '/images/covers/pragmatic-programmer.png' },
  { id: 3, title: 'Eloquent JavaScript', author: 'Marijn Haverbeke', price: 38.0, quantity: 0, status: 'active', description: 'A modern introduction to programming.', cover: '/images/covers/eloquent-javascript.png' },
  { id: 4, title: 'The Mythical Man-Month', author: 'Frederick P. Brooks Jr.', price: 49.0, quantity: 4, status: 'active', description: 'Essays on software engineering and project management.', cover: '/images/covers/mythical-man-month.png' },
  { id: 5, title: 'Refactoring', author: 'Martin Fowler', price: 60.0, quantity: 20, status: 'active', description: 'Improving the design of existing code.', cover: '/images/covers/refactoring.png' },
  { id: 6, title: 'Design Patterns', author: 'Gamma, Helm, Johnson & Vlissides', price: 65.0, quantity: 3, status: 'disabled', description: 'Elements of reusable object-oriented software.', cover: '/images/covers/design-patterns.png' },
  { id: 7, title: "You Don't Know JS", author: 'Kyle Simpson', price: 34.0, quantity: 15, status: 'active', description: 'A deep dive into the core mechanisms of JavaScript.', cover: '/images/covers/you-dont-know-js.png' },
  { id: 8, title: 'Introduction to Algorithms', author: 'Cormen, Leiserson, Rivest & Stein', price: 89.0, quantity: 2, status: 'active', description: 'A comprehensive guide to algorithms.', cover: '/images/covers/intro-to-algorithms.png' },
];
let nextId = 9;

function normQty(v)   { const n = parseInt(v, 10); return (isNaN(n) || n < 0) ? 0 : n; }
function normStatus(v) { return v === 'disabled' ? 'disabled' : 'active'; }

class Book {
  static all() { return books; }

  static find(id) { return books.find(b => b.id === Number(id)); }

  static create({ title, author, price, description, cover, quantity, status }) {
    const book = {
      id: nextId++,
      title: title,
      author: author,
      price: parseFloat(price) || 0,
      quantity: normQty(quantity),
      status: normStatus(status),
      description: description || '',
      cover: (cover && cover.trim()) ? cover.trim() : PLACEHOLDER_COVER,
    };
    books.push(book);
    return book;
  }

  static update(id, data) {
    const book = Book.find(id);
    if (!book) return null;
    if (data.title !== undefined) book.title = data.title;
    if (data.author !== undefined) book.author = data.author;
    if (data.price !== undefined) book.price = parseFloat(data.price) || 0;
    if (data.quantity !== undefined) book.quantity = normQty(data.quantity);
    if (data.status !== undefined) book.status = normStatus(data.status);
    if (data.description !== undefined) book.description = data.description;
    if (data.cover !== undefined && data.cover.trim()) book.cover = data.cover.trim();
    return book;
  }

  static remove(id) {
    const i = books.findIndex(b => b.id === Number(id));
    if (i === -1) return false;
    books.splice(i, 1);
    return true;
  }
}

module.exports = Book;
