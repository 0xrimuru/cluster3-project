// SalesController - Sales & Invoicing page and Clients list.
const Invoice = require('../Models/Invoice');
const Client = require('../Models/Client');

// GET /sales -> Sales & Invoicing (search invoices, results, total)
exports.invoices = (req, res) => {
  const q = req.query.q || '';
  const list = Invoice.search(q);
  res.render('sales/index', {
    title: 'Sales & Invoicing', pageName: 'Sales', nav: 'sales',
    invoices: list, q, total: Invoice.total(list),
  });
};

// GET /clients -> Clients list
exports.clients = (req, res) => {
  const q = req.query.q || '';
  res.render('clients/index', {
    title: 'Clients', pageName: 'Clients', nav: 'clients',
    clients: Client.search(q), q,
  });
};
