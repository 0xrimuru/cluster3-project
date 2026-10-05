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
    const r = await fetch('/cart/' + encodeURIComponent(tr.dataset.sku), { method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ qty }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { show(data.error || 'Could not update the cart.'); return false; }
    show('');
    LPA.setCartCount(data.count);
    if (qty === 0) tr.remove();
    if (!table.querySelector('tbody tr')) location.reload(); // show the empty-cart message
    return true;
  }

  let timer;
  table.addEventListener('input', e => {
    if (!e.target.classList.contains('qty')) return;
    const input = e.target, tr = input.closest('tr');
    const max = parseInt(input.max, 10), qty = parseInt(input.value, 10);
    if (Number.isInteger(qty) && qty > max) { show(`Only ${max} in stock.`); input.value = max; }
    totals();
    clearTimeout(timer);
    timer = setTimeout(() => { const v = parseInt(input.value, 10); if (Number.isInteger(v) && v >= 0) save(tr, v); }, 400);
  });
  table.addEventListener('submit', async e => {
    const form = e.target;
    if (!form.classList.contains('remove-form')) return;
    e.preventDefault();
    const tr = form.closest('tr');
    if (await save(tr, 0)) totals();
  });
})();
