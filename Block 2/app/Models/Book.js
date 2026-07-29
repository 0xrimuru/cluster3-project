// Book model (the "M" of MVC).
// In-memory data store for Block 2; this is replaced by a real database
// in the later database/NoSQL blocks. The controllers only ever talk to
// this model, never to the data directly.

let books = [
  { id: 1, title: 'Clean Code', author: 'Robert C. Martin', price: 45.0, description: 'A handbook of agile software craftsmanship.' },
  { id: 2, title: 'The Pragmatic Programmer', author: 'Hunt & Thomas', price: 52.5, description: 'Your journey to mastery.' },
  { id: 3, title: 'Eloquent JavaScript', author: 'Marijn Haverbeke', price: 38.0, description: 'A modern introduction to programming.' },
];
let nextId = 4;

class Book {
  static all() {
    return books;
  }

  static find(id) {
    return books.find(b => b.id === Number(id));
  }

  static create({ title, author, price, description }) {
    const book = {
      id: nextId++,
      title: title,
      author: author,
      price: parseFloat(price) || 0,
      description: description || '',
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
    if (data.description !== undefined) book.description = data.description;
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
