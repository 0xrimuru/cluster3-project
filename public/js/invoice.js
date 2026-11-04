// New Invoice page (client side): look up a client and stock items by ID, build the
// line items, keep a live total, and send the invoice to the server as JSON.
// The server re-checks everything (client, stock on hand, prices) before saving.
(function () {
  const $ = id => document.getElementById(id);
  const money = n => '$' + n.toFixed(2);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let client = null, picked = null;
  const lines = []; // { sku, name, price, qty, onHand }

  async function lookup(url) {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Lookup failed');
    return data;
  }
  function msg(el, text, ok) { el.textContent = text; el.className = 'lookup-msg ' + (ok ? 'ok' : 'err'); }

  async function findClient() {
    const code = $('client-id').value.trim();
    if (!code) return msg($('client-msg'), 'Type a client ID first.', false);
    try {
      const c = await lookup('/api/clients/' + encodeURIComponent(code));
      if (c.status !== 'active') { client = null; $('client-card').hidden = true; return msg($('client-msg'), `Client ${c.code} is disabled and cannot be invoiced.`, false); }
      client = c;
      $('c-code').textContent = c.code; $('c-name').textContent = c.name; $('c-address').textContent = c.address; $('c-phone').textContent = c.phone;
      $('client-card').hidden = false;
      msg($('client-msg'), 'Client selected.', true);
    } catch (e) { client = null; $('client-card').hidden = true; msg($('client-msg'), e.message, false); }
  }

  async function findItem() {
    const sku = $('item-id').value.trim();
    if (!sku) return msg($('item-msg'), 'Type an item ID first.', false);
    try {
      const p = await lookup('/api/stock/' + encodeURIComponent(sku));
      if (p.status !== 'active') { picked = null; $('item-pick').hidden = true; return msg($('item-msg'), `${p.name} is disabled and cannot be sold.`, false); }
      picked = p;
      $('i-name').textContent = p.name;
      $('i-meta').textContent = `${p.sku} · ${money(p.price)} · ${p.onHand} on hand`;
      $('item-qty').max = p.onHand; $('item-qty').value = p.onHand > 0 ? 1 : 0;
      $('item-pick').hidden = false;
      const out = p.onHand === 0;
      $('item-qty').disabled = out; $('item-add').disabled = out;
      msg($('item-msg'), out ? `${p.name} is out of stock and cannot be added.` : '', !out);
      if (!out) $('item-qty').focus();
    } catch (e) { picked = null; $('item-pick').hidden = true; msg($('item-msg'), e.message, false); }
  }

  function addItem() {
    if (!picked) return;
    const qty = parseInt($('item-qty').value, 10);
    const existing = lines.find(l => l.sku === picked.sku);
    const already = existing ? existing.qty : 0;
    if (!Number.isInteger(qty) || qty < 1) return msg($('item-msg'), 'Quantity must be at least 1.', false);
    if (already + qty > picked.onHand) return msg($('item-msg'), `Only ${picked.onHand} on hand${already ? ` (${already} already on this invoice)` : ''}.`, false);
    if (existing) existing.qty += qty; else lines.push({ sku: picked.sku, name: picked.name, price: picked.price, qty, onHand: picked.onHand });
    msg($('item-msg'), `${qty} × ${picked.name} added.`, true);
    $('item-pick').hidden = true; $('item-id').value = ''; picked = null; $('item-id').focus();
    render();
  }

  function render() {
    const body = $('lines-body');
    if (!lines.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="5" class="empty-msg">No items yet — search an item and press Add item.</td></tr>';
    } else {
      body.innerHTML = lines.map((l, i) =>
        `<tr><td><span class="sku">${esc(l.sku)}</span> ${esc(l.name)}</td><td class="num">${l.qty}</td><td class="num">${money(l.price)}</td>` +
        `<td class="num">${money(l.qty * l.price)}</td><td class="num"><button type="button" class="x-btn" data-remove="${i}" aria-label="Remove ${esc(l.name)}" title="Remove">&times;</button></td></tr>`).join('');
    }
    const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
    $('inv-total').textContent = money(total);
  }

  $('lines-body').addEventListener('click', e => {
    const i = e.target.getAttribute('data-remove');
    if (i !== null) { lines.splice(Number(i), 1); render(); }
  });
  $('client-search').addEventListener('click', findClient);
  $('item-search').addEventListener('click', findItem);
  $('item-add').addEventListener('click', addItem);
  [['client-id', findClient], ['item-id', findItem], ['item-qty', addItem]].forEach(([id, fn]) =>
    $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fn(); } }));

  $('invoice-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errs = [];
    if (!client) errs.push('Search and select a client.');
    if (!lines.length) errs.push('Add at least one item.');
    if (!$('inv-date').value) errs.push('Choose the invoice date.');
    const box = $('form-errors');
    if (errs.length) { box.innerHTML = errs.map(x => `<li>${esc(x)}</li>`).join(''); box.hidden = false; return; }
    $('inv-save').disabled = true;
    const { ok, data } = await LPA.send('/sales', 'POST', { clientId: client.code, date: $('inv-date').value, items: lines.map(l => ({ sku: l.sku, qty: l.qty })) });
    if (ok) { location.href = data.url; return; }
    box.innerHTML = (data.errors || [data.error || 'The invoice could not be saved.']).map(x => `<li>${esc(x)}</li>`).join('');
    box.hidden = false; $('inv-save').disabled = false;
  });
})();
