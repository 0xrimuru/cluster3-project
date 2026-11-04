package au.com.lpa.desktop.service;

import au.com.lpa.desktop.model.Client;
import au.com.lpa.desktop.model.Invoice;
import au.com.lpa.desktop.model.InvoiceLine;
import au.com.lpa.desktop.model.Product;
import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.repo.ClientRepository;
import au.com.lpa.desktop.repo.InvoiceRepository;
import au.com.lpa.desktop.repo.LedgerRepository;
import au.com.lpa.desktop.repo.ProductRepository;
import au.com.lpa.desktop.util.Clocks;
import au.com.lpa.desktop.util.Db;

import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;

/**
 * Sales and invoicing. A new invoice is ONE transaction: the stock rows are locked
 * (SELECT ... FOR UPDATE, always in the same order so two users cannot deadlock), quantities and
 * prices are taken from the catalogue (never from the screen), the invoice + lines are inserted,
 * the stock is reduced and the audit history is written. Any problem = ROLLBACK, nothing saved.
 */
public class InvoiceService {

    private final Db db;
    private final InvoiceRepository invoices;
    private final ClientRepository clients;
    private final ProductRepository products;
    private final LedgerRepository ledger;
    private final Session session;
    private final LookupCache cache;

    public InvoiceService(Db db, InvoiceRepository invoices, ClientRepository clients, ProductRepository products, LedgerRepository ledger, Session session, LookupCache cache) {
        this.cache = cache;
        this.db = db;
        this.invoices = invoices;
        this.clients = clients;
        this.products = products;
        this.ledger = ledger;
        this.session = session;
    }

    /** Thrown inside the transaction to roll it back with messages for the user. */
    private static final class Rollback extends RuntimeException {
        final List<String> messages;
        Rollback(List<String> messages) { super(String.join(" ", messages)); this.messages = messages; }
    }

    public List<Invoice> search(String text) throws SQLException, ServiceException {
        session.require("sales.view");
        return invoices.search(text);
    }

    public Optional<Invoice> open(String number) throws SQLException, ServiceException {
        session.require("sales.view");
        return invoices.findById(number);
    }

    /** Client by ID - from the LRU cache when it was looked up recently. */
    public Optional<Client> findClient(String code) throws SQLException, ServiceException {
        session.require("clients.view");
        String key = code == null ? "" : code.trim().toUpperCase();
        Optional<Optional<Client>> hit = cache.clients.get(key);
        if (hit.isPresent()) return hit.get();
        Optional<Client> c = clients.findById(key);
        cache.clients.put(key, c);
        return c;
    }

    /** Stock item by ID - from the LRU cache when it was looked up recently. */
    public Optional<Product> findProduct(String sku) throws SQLException, ServiceException {
        session.require("stock.view");
        String key = sku == null ? "" : sku.trim().toUpperCase();
        Optional<Optional<Product>> hit = cache.products.get(key);
        if (hit.isPresent()) return hit.get();
        Optional<Product> p = products.findById(key);
        cache.products.put(key, p);
        return p;
    }

    /** Type-ahead: stock items whose ID, name, brand or category starts with the text (trie). */
    public List<Product> suggestProducts(String prefix, int limit) throws SQLException, ServiceException {
        session.require("stock.view");
        var index = cache.productIndex(); // read once: another screen may clear it at any moment
        if (index == null) index = cache.productIndex(products.findAll());
        return index.suggest(prefix, limit);
    }

    /** Type-ahead: clients whose ID or name starts with the text (trie). */
    public List<Client> suggestClients(String prefix, int limit) throws SQLException, ServiceException {
        session.require("clients.view");
        var index = cache.clientIndex();
        if (index == null) index = cache.clientIndex(clients.findAll());
        return index.suggest(prefix, limit);
    }

    public String nextNumberPreview() throws SQLException {
        return db.run(invoices::nextNumber);
    }

    /** Creates the invoice; returns it with its number and the prices actually charged. */
    public Invoice create(Invoice draft) throws SQLException, ServiceException {
        session.require("sales.create");
        List<String> errors = new ArrayList<>(draft.validate());
        Client client = draft.getClientId() == null ? null : clients.findById(draft.getClientId()).orElse(null);
        if (!draft.getClientId().isBlank() && client == null) errors.add("Client " + draft.getClientId() + " not found.");
        if (client != null && client.getStatus() != RecordStatus.ACTIVE) errors.add("Client " + client.getId() + " is disabled.");
        if (!errors.isEmpty()) throw new ServiceException(errors);

        Map<String, Integer> wanted = new TreeMap<>(); // sorted = same lock order every time
        for (InvoiceLine l : draft.getLines()) wanted.merge(l.sku(), l.qty(), Integer::sum);
        LocalDateTime when = draft.getDate().atTime(Clocks.nowBrisbane().toLocalTime());
        try {
            String number = db.transaction(c -> {
                List<String> problems = new ArrayList<>();
                Invoice toSave = new Invoice();
                toSave.setPayment("Account");
                List<Product> locked = new ArrayList<>();
                for (Map.Entry<String, Integer> e : wanted.entrySet()) {
                    Product p = products.lock(c, e.getKey()).orElse(null);
                    if (p == null || p.getStatus() == RecordStatus.DELETED) { problems.add("Stock item " + e.getKey() + " not found."); continue; }
                    if (!p.isActive()) { problems.add(p.getName() + " is disabled and cannot be sold."); continue; }
                    if (e.getValue() > p.getOnHand()) { problems.add("Only " + p.getOnHand() + " of " + p.getName() + " on hand (asked for " + e.getValue() + ")."); continue; }
                    toSave.addLine(new InvoiceLine(p.getId(), p.getName(), e.getValue(), p.getPrice())); // catalogue price
                    locked.add(p);
                }
                if (!problems.isEmpty()) throw new Rollback(problems);
                String no = invoices.insert(c, toSave, client, when);
                for (Product p : locked) {
                    int after = p.getOnHand() - wanted.get(p.getId());
                    products.setOnHand(c, p.getId(), after);
                    ledger.record(c, p.getId(), session.user().getId(), "remove", "Sold - " + no, p.getOnHand(), after, Clocks.nowBrisbane());
                }
                return no;
            });
            wanted.keySet().forEach(cache::productChanged); // stock on hand changed
            return invoices.findById(number).orElseThrow();
        } catch (Rollback r) {
            throw new ServiceException(r.messages);
        }
    }

    /** Deletes (soft) an invoice and returns its items to stock - one transaction. */
    public void delete(String number) throws SQLException, ServiceException {
        session.require("sales.delete");
        boolean done = db.transaction(c -> {
            Invoice inv = invoices.findById(c, number).orElse(null);
            if (inv == null || !invoices.markDeleted(c, inv.getId())) return false;
            for (InvoiceLine l : inv.getLines()) {
                Product p = products.lock(c, l.sku()).orElse(null);
                if (p == null) continue;
                products.setOnHand(c, p.getId(), p.getOnHand() + l.qty());
                ledger.record(c, p.getId(), session.user().getId(), "add", "Returned - " + inv.getId() + " deleted", p.getOnHand(), p.getOnHand() + l.qty(), Clocks.nowBrisbane());
            }
            return true;
        });
        if (!done) throw new ServiceException("Invoice not found.");
        cache.productChanged(null);
        cache.products.clear();
    }
}
