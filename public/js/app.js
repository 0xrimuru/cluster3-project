// app.js - small client-side helpers shared by every page.
//  - LPA.confirm(): an accessible confirmation dialog (<dialog>) used instead of window.confirm
//  - forms with data-confirm="message" ask before submitting (delete buttons, etc.)
//  - greeting by time of day on the home pages
//  - live "passwords match" feedback on the registration form
//  - LPA.setCartCount(): updates the cart badge without reloading the page
window.LPA = window.LPA || {};

LPA.confirm = function (title, body, okLabel) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'confirm-dialog';
    d.setAttribute('aria-labelledby', 'cd-title');
    d.innerHTML = '<h2 id="cd-title"></h2><p class="cd-body"></p><div class="form-actions">' +
      '<button type="button" class="btn" data-ok></button><button type="button" class="btn ghost" data-cancel>Cancel</button></div>';
    d.querySelector('#cd-title').textContent = title;
    d.querySelector('.cd-body').textContent = body || '';
    d.querySelector('[data-ok]').textContent = okLabel || 'OK';
    document.body.appendChild(d);
    const done = v => { d.close(); d.remove(); resolve(v); };
    d.querySelector('[data-ok]').addEventListener('click', () => done(true));
    d.querySelector('[data-cancel]').addEventListener('click', () => done(false));
    d.addEventListener('cancel', e => { e.preventDefault(); done(false); });
    if (typeof d.showModal === 'function') d.showModal(); else resolve(window.confirm(title + '\n' + (body || '')));
    d.querySelector('[data-ok]').focus();
  });
};

LPA.setCartCount = function (n) {
  const badge = document.getElementById('cart-badge');
  if (badge) { badge.textContent = n; badge.hidden = !n; }
  document.querySelectorAll('.js-cart-count').forEach(el => { el.textContent = n; });
};

document.addEventListener('submit', async e => {
  const form = e.target;
  const message = form.getAttribute('data-confirm');
  if (!message || form.dataset.confirmed) return;
  e.preventDefault();
  if (await LPA.confirm('Please confirm', message, 'Yes, continue')) {
    form.dataset.confirmed = '1';
    form.requestSubmit ? form.requestSubmit() : form.submit();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const g = document.getElementById('greeting');
  if (g) {
    const h = new Date().getHours();
    g.textContent = h < 12 ? 'Good morning' : (h < 18 ? 'Good afternoon' : 'Good evening');
  }
  const p1 = document.getElementById('reg-pass'), p2 = document.getElementById('reg-pass2'), out = document.getElementById('pass-match');
  if (p1 && p2 && out) {
    const check = () => {
      if (!p2.value) { out.textContent = ''; p2.setCustomValidity(''); return; }
      const ok = p1.value === p2.value;
      out.textContent = ok ? 'Passwords match.' : 'Passwords do not match yet.';
      out.className = 'hint ' + (ok ? 'ok' : 'err');
      p2.setCustomValidity(ok ? '' : 'Passwords must match.');
    };
    p1.addEventListener('input', check); p2.addEventListener('input', check);
  }
});
