// Book (stock item) model - the "M" of MVC. In-memory store; moves to a
// real database (MySQL) in the database block. Each item carries an SKU,
// category, on-hand quantity and active/disabled status (LPA eComms stock).
const PLACEHOLDER_COVER = '/images/covers/placeholder.png';

let books = [
  { id: 1, sku: 'LPA-BK-001', title: 'Clean Code', author: 'Robert C. Martin', category: 'Software Craft', price: 45.0, quantity: 12, status: 'active', description: 'A handbook of agile software craftsmanship.', cover: '/images/covers/clean-code.png' },
  { id: 2, sku: 'LPA-BK-002', title: 'The Pragmatic Programmer', author: 'Hunt & Thomas', category: 'Software Craft', price: 52.5, quantity: 7, status: 'active', description: 'Your journey to mastery.', cover: '/images/covers/pragmatic-programmer.png' },
  { id: 3, sku: 'LPA-BK-003', title: 'Eloquent JavaScript', author: 'Marijn Haverbeke', category: 'JavaScript', price: 38.0, quantity: 0, status: 'active', description: 'A modern introduction to programming.', cover: '/images/covers/eloquent-javascript.png' },
  { id: 4, sku: 'LPA-BK-004', title: 'The Mythical Man-Month', author: 'Frederick P. Brooks Jr.', category: 'Project Management', price: 49.0, quantity: 4, status: 'active', description: 'Essays on software engineering and project management.', cover: '/images/covers/mythical-man-month.png' },
  { id: 5, sku: 'LPA-BK-005', title: 'Refactoring', author: 'Martin Fowler', category: 'Software Craft', price: 60.0, quantity: 20, status: 'active', description: 'Improving the design of existing code.', cover: '/images/covers/refactoring.png' },
  { id: 6, sku: 'LPA-BK-006', title: 'Design Patterns', author: 'Gamma, Helm, Johnson & Vlissides', category: 'Architecture', price: 65.0, quantity: 3, status: 'disabled', description: 'Elements of reusable object-oriented software.', cover: '/images/covers/design-patterns.png' },
  { id: 7, sku: 'LPA-BK-007', title: "You Don't Know JS", author: 'Kyle Simpson', category: 'JavaScript', price: 34.0, quantity: 15, status: 'active', description: 'A deep dive into the core mechanisms of JavaScript.', cover: '/images/covers/you-dont-know-js.png' },
  { id: 8, sku: 'LPA-BK-008', title: 'Introduction to Algorithms', author: 'Cormen, Leiserson, Rivest & Stein', category: 'Algorithms', price: 89.0, quantity: 2, status: 'active', description: 'A comprehensive guide to algorithms.', cover: '/images/covers/intro-to-algorithms.png' },
];
let nextId = 9;

function normQty(v)   { const n = parseInt(v, 10); return (isNaN(n) || n < 0) ? 0 : n; }
function normStatus(v){ return v === 'disabled' ? 'disabled' : 'active'; }

// Stock level helper used by the views for the In/Low/Out badge.
function stockLevel(q) { return q <= 0 ? 'out' : (q <= 5 ? 'low' : 'in'); }

class Book {
  static all() { return books; }
  static find(id) { return books.find(b => b.id === Number(id)); }
  static level(book) { return stockLevel(book.quantity); }

  static create({ title, author, price, description, cover, quantity, status, sku, category }) {
    const book = {
      id: nextId++,
      sku: (sku && sku.trim()) ? sku.trim() : ('LPA-BK-' + String(nextId - 1).padStart(3, '0')),
      title, author,
      category: category || 'General',
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
    if (data.sku !== undefined && data.sku.trim()) book.sku = data.sku.trim();
    if (data.category !== undefined) book.category = data.category;
    if (data.price !== undefined) book.price = parseFloat(data.price) || 0;
    if (data.quantity !== undefined) book.quantity = normQty(data.quantity);
    if (data.status !== undefined) book.status = normStatus(data.status);
    if (data.description !== undefined) book.description = data.description;
    if (data.cover !== undefined && data.cover.trim()) book.cover = data.cover.trim();
    return book;
  }

  // Stock adjustment: add / remove / reconcile. Returns {before, after, delta}.
  static adjust(id, { operation, quantity }) {
    const book = Book.find(id);
    if (!book) return null;
    const before = book.quantity;
    const qty = normQty(quantity);
    let after = before;
    if (operation === 'add') after = before + qty;
    else if (operation === 'remove') after = Math.max(0, before - qty);
    else if (operation === 'reconcile') after = qty; // qty is the target total count
    book.quantity = after;
    return { before, after, delta: after - before };
  }

  static remove(id) {
    const i = books.findIndex(b => b.id === Number(id));
    if (i === -1) return false;
    books.splice(i, 1);
    return true;
  }
}

module.exports = Book;
