// shop.js - web store page (client side):
//  - live filter of the product cards while typing (server search still works without JS)
//  - "Add to cart": shows the price and asks for confirmation, then sends the item to the
//    server with fetch(); the cart badge and the quantity limits update without a reload.
(function () {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  const search = document.getElementById('shop-search');
  const count = document.getElementById('shop-count');
  const empty = document.getElementById('shop-empty');
  const msg = document.getElementById('shop-msg');
  const money = n => '$' + Number(n).toFixed(2);

  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      grid.querySelectorAll('.product-card').forEach(card => {
        const hit = !q || card.dataset.name.includes(q);
        card.hidden = !hit; if (hit) shown++;
      });
      count.textContent = shown + ' product' + (shown === 1 ? '' : 's');
      empty.hidden = shown !== 0;
    });
  }

  function flash(text, ok) {
    msg.textContent = text; msg.className = 'flash ' + (ok ? 'ok' : 'err'); msg.hidden = false;
    clearTimeout(flash.t); flash.t = setTimeout(() => { msg.hidden = true; }, 4000);
  }

  grid.addEventListener('submit', async e => {
    const form = e.target.closest('.add-form');
    if (!form) return;
    e.preventDefault();
    const qtyInput = form.querySelector('.qty');
    const qty = parseInt(qtyInput.value, 10);
    const left = parseInt(form.dataset.left, 10);
    const price = Number(form.dataset.price);
    if (!Number.isInteger(qty) || qty < 1) return flash('Quantity must be at least 1.', false);
    if (qty > left) return flash(`Only ${left} more available.`, false);
    const ok = await LPA.confirm('Add to cart?',
      `${qty} × ${form.dataset.title} at ${money(price)} each = ${money(qty * price)} (incl. GST).`, 'Add to cart');
    if (!ok) return;
    const { ok: saved, data } = await LPA.send('/cart', 'POST', { sku: form.dataset.sku, qty });
    if (!saved) return flash(data.error || 'Could not add to cart.', false);
    LPA.setCartCount(data.count);
    const remaining = left - qty;
    form.dataset.left = remaining;
    qtyInput.max = remaining;
    qtyInput.value = remaining ? 1 : 0;
    if (!remaining) { qtyInput.disabled = true; const b = form.querySelector('button'); b.disabled = true; b.textContent = 'All in cart'; }
    flash(data.message, true);
  });
})();
