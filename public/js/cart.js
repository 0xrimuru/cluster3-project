// cart.js - cart page (client side): change a quantity and the line amount, total and GST
// update straight away; the change is saved on the server with fetch() (which re-checks
// stock). Remove takes the line away without reloading the page.
(function () {
  const table = document.getElementById('cart-table');
  if (!table) return;
  const msg = document.getElementById('cart-msg');
  const money = n => '$' + Number(n).toFixed(2);

  function totals() {
    let total = 0;
    table.querySelectorAll('tbody tr').forEach(tr => {
      const qty = parseInt(tr.querySelector('.qty').value, 10) || 0;
      const amount = qty * Number(tr.dataset.price);
      tr.querySelector('.line-amount').textContent = money(amount);
      total += amount;
    });
    document.getElementById('cart-total').textContent = money(total);
    document.getElementById('cart-gst').textContent = money(total / 11);
  }
  function show(text) { msg.textContent = text; msg.hidden = !text; }

  async function save(tr, qty) {
    const { ok, data } = await LPA.send('/cart/' + encodeURIComponent(tr.dataset.sku), 'POST', { qty });
    if (!ok) { show(data.error || 'Could not update the cart.'); return false; }
    if (!tr.capped) show(''); // keep an "Only N in stock" note visible
    tr.capped = false;
    LPA.setCartCount(data.count);
    // the server's figures are the truth (a price may have changed since the page loaded)
    if (data.total !== undefined) { document.getElementById('cart-total').textContent = money(data.total); document.getElementById('cart-gst').textContent = money(data.gst); }
    if (qty === 0) tr.remove();
    if (!table.querySelector('tbody tr')) location.reload(); // show the empty-cart message
    return true;
  }

  table.addEventListener('input', e => {
    if (!e.target.classList.contains('qty')) return;
    const input = e.target, tr = input.closest('tr');
    const max = parseInt(input.max, 10), qty = parseInt(input.value, 10);
    if (Number.isInteger(qty) && qty > max) { show(`Only ${max} in stock.`); input.value = max; tr.capped = true; }
    totals();
    clearTimeout(tr.timer); // one timer per line: changing another line never cancels this save
    tr.timer = setTimeout(() => { const v = parseInt(input.value, 10); if (Number.isInteger(v) && v >= 0) save(tr, v); }, 400);
  });
  table.addEventListener('submit', async e => {
    const form = e.target;
    if (!form.classList.contains('remove-form')) return;
    e.preventDefault();
    const tr = form.closest('tr');
    if (await save(tr, 0)) totals();
  });
})();
