// Block 4 (ICTPRG535) - client-side interaction techniques + validation.
document.addEventListener('DOMContentLoaded', function () {
  // 1) Live stock search (filters the card list as you type)
  var search = document.getElementById('stock-search');
  if (search) {
    var cards = [].slice.call(document.querySelectorAll('#stock-list [data-name]'));
    var empty = document.getElementById('stock-empty');
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase(), shown = 0;
      cards.forEach(function (c) {
        var match = c.getAttribute('data-name').indexOf(q) !== -1;
        c.style.display = match ? '' : 'none';
        if (match) shown++;
      });
      if (empty) empty.style.display = shown ? 'none' : '';
    });
  }

  // 2) Add/Edit form - custom client-side validation messages for quantity
  var qty = document.querySelector('#book-form input[name="quantity"]');
  if (qty) {
    qty.addEventListener('invalid', function () {
      if (qty.validity.valueMissing)        qty.setCustomValidity('Please enter the on-hand quantity.');
      else if (qty.validity.rangeUnderflow) qty.setCustomValidity('Quantity cannot be negative.');
      else if (qty.validity.stepMismatch)   qty.setCustomValidity('Quantity must be a whole number.');
      else                                  qty.setCustomValidity('');
    });
    qty.addEventListener('input', function () { qty.setCustomValidity(''); });
  }

  // 3) Stock adjustment - relabel the quantity field for Reconcile
  var ops = [].slice.call(document.querySelectorAll('#adjust-form input[name="operation"]'));
  var qtyLabel = document.getElementById('qty-label');
  if (ops.length && qtyLabel) {
    function sync() {
      var sel = document.querySelector('#adjust-form input[name="operation"]:checked');
      qtyLabel.textContent = (sel && sel.value === 'reconcile') ? 'Target total count' : 'Quantity adjusted';
    }
    ops.forEach(function (o) { o.addEventListener('change', sync); });
    sync();
  }
});
