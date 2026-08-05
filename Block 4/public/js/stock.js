// Block 4 (ICTPRG535) - client-side interaction techniques + validation.
document.addEventListener('DOMContentLoaded', function () {
  // 1) Catalogue live search (client-side filter of the stock table)
  var search = document.getElementById('stock-search');
  if (search) {
    var rows = [].slice.call(document.querySelectorAll('#stock-table tbody tr[data-name]'));
    var empty = document.getElementById('stock-empty');
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase(), shown = 0;
      rows.forEach(function (r) {
        var match = r.getAttribute('data-name').indexOf(q) !== -1;
        r.style.display = match ? '' : 'none';
        if (match) shown++;
      });
      if (empty) empty.style.display = shown ? 'none' : '';
    });
  }

  // 2) Add/Edit form: enhanced client-side validation messages for quantity
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
});
