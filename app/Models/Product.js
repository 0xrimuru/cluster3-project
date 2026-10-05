// Product (stock item) model - the "M" of MVC. In-memory store; moves to a
// real database (MySQL) in the database block. Each item carries an SKU,
// category, on-hand quantity and active/disabled status (LPA eComms stock).
const PLACEHOLDER_IMAGE = '/images/products/placeholder.png';

let products = [
  { id: 1, sku: 'LPA-001', title: 'Mechanical Keyboard MK-87', brand: 'Vertex', category: 'Keyboards', price: 89.0, quantity: 12, status: 'active', description: 'Compact 87-key hot-swappable mechanical keyboard with RGB backlight.', image: '/images/products/keyboard.png' },
  { id: 2, sku: 'LPA-002', title: 'Wireless Optical Mouse WM-200', brand: 'Orbit', category: 'Mice', price: 39.5, quantity: 7, status: 'active', description: 'Ergonomic 2.4GHz wireless mouse, 1600 DPI, silent-click.', image: '/images/products/mouse.png' },
  { id: 3, sku: 'LPA-003', title: '27" 4K UHD Monitor UM-27', brand: 'Lumina', category: 'Monitors', price: 429.0, quantity: 0, status: 'active', description: '27-inch 4K IPS display, 60Hz, HDMI + DisplayPort.', image: '/images/products/monitor.png' },
  { id: 4, sku: 'LPA-004', title: 'USB-C Docking Station DS-11', brand: 'NovaLink', category: 'Docks & Hubs', price: 149.0, quantity: 4, status: 'active', description: '11-in-1 USB-C dock: dual HDMI, USB-A, SD, Ethernet, 100W PD.', image: '/images/products/dock.png' },
  { id: 5, sku: 'LPA-005', title: '1080p HD Webcam CV-10', brand: 'ClearView', category: 'Webcams', price: 69.0, quantity: 20, status: 'active', description: 'Full-HD 1080p webcam with auto-focus and dual mics.', image: '/images/products/webcam.png' },
  { id: 6, sku: 'LPA-006', title: 'Noise-Cancelling Headset HS-90', brand: 'AudioCore', category: 'Audio', price: 119.0, quantity: 3, status: 'disabled', description: 'Over-ear ANC headset, USB + 3.5mm, boom microphone.', image: '/images/products/headset.png' },
  { id: 7, sku: 'LPA-007', title: 'Mechanical Numpad NP-22', brand: 'Vertex', category: 'Keyboards', price: 34.0, quantity: 15, status: 'active', description: 'Standalone 22-key mechanical number pad, USB-C.', image: '/images/products/numpad.png' },
  { id: 8, sku: 'LPA-008', title: 'USB-C to HDMI Cable 2m', brand: 'NovaLink', category: 'Cables & Adapters', price: 19.0, quantity: 2, status: 'active', description: '2-metre USB-C to HDMI 4K@60Hz cable, braided.', image: '/images/products/cable.png' },
];
let nextId = 9;

function normQty(v)   { const n = parseInt(v, 10); return (isNaN(n) || n < 0) ? 0 : n; }
function normStatus(v){ return v === 'disabled' ? 'disabled' : 'active'; }

// Stock level helper used by the views for the In/Low/Out badge.
function stockLevel(q) { return q <= 0 ? 'out' : (q <= 5 ? 'low' : 'in'); }

class Product {
  // Deleted items are kept (invoices and the audit history still refer to them) but hidden.
  static all() { return products.filter(p => !p.deleted); }
  static find(id) { return Product.all().find(p => p.id === Number(id)); }
  static findBySku(sku) {
    const s = String(sku || '').trim().toUpperCase();
    return Product.all().find(p => p.sku.toUpperCase() === s);
  }
  // What customers can buy in the web store: active (enabled) items only.
  static forSale() { return Product.all().filter(p => p.status === 'active'); }
  static level(product) { return stockLevel(product.quantity); }

  static create({ title, brand, price, description, image, quantity, status, sku, category }) {
    const product = {
      id: nextId++,
      sku: (sku && sku.trim()) ? sku.trim().toUpperCase() : ('LPA-' + String(nextId - 1).padStart(3, '0')),
      title, brand,
      category: category || 'General',
      price: parseFloat(price) || 0,
      quantity: normQty(quantity),
      status: normStatus(status),
      description: description || '',
      image: (image && image.trim()) ? image.trim() : PLACEHOLDER_IMAGE,
    };
    products.push(product);
    return product;
  }

  static update(id, data) {
    const product = Product.find(id);
    if (!product) return null;
    if (data.title !== undefined) product.title = data.title;
    if (data.brand !== undefined) product.brand = data.brand;
    if (data.sku !== undefined && data.sku.trim()) product.sku = data.sku.trim().toUpperCase();
    if (data.category !== undefined) product.category = data.category;
    if (data.price !== undefined) product.price = parseFloat(data.price) || 0;
    if (data.quantity !== undefined) product.quantity = normQty(data.quantity);
    if (data.status !== undefined) product.status = normStatus(data.status);
    if (data.description !== undefined) product.description = data.description;
    if (data.image !== undefined && data.image.trim()) product.image = data.image.trim();
    return product;
  }

  // Stock adjustment: add / remove / reconcile. Returns {before, after, delta}.
  static adjust(id, { operation, quantity }) {
    const product = Product.find(id);
    if (!product) return null;
    const before = product.quantity;
    const qty = normQty(quantity);
    let after = before;
    if (operation === 'add') after = before + qty;
    else if (operation === 'remove') after = Math.max(0, before - qty);
    else if (operation === 'reconcile') after = qty; // qty is the target total count
    product.quantity = after;
    return { before, after, delta: after - before };
  }

  // Sell / return stock (used by checkout and invoices). Never goes below zero.
  static changeQty(sku, delta) {
    const p = Product.findBySku(sku);
    if (!p) return null;
    const before = p.quantity;
    p.quantity = Math.max(0, before + delta);
    return { product: p, before, after: p.quantity };
  }

  // Soft delete, like the LPA reference app (status 'D'): kept for history, hidden everywhere.
  static remove(id) {
    const p = Product.find(id);
    if (!p) return false;
    p.deleted = true;
    return true;
  }
}

module.exports = Product;
