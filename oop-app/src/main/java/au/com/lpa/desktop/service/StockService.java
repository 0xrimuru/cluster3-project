package au.com.lpa.desktop.service;

import au.com.lpa.desktop.model.LedgerEntry;
import au.com.lpa.desktop.model.Product;
import au.com.lpa.desktop.repo.LedgerRepository;
import au.com.lpa.desktop.repo.ProductRepository;
import au.com.lpa.desktop.util.Db;
import au.com.lpa.desktop.util.Clocks;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

/** Stock management rules: who may do what, validation, and adjustments with an audit trail. */
public class StockService {

    public enum Operation {
        ADD("+ Add stock"), REMOVE("- Remove stock"), RECONCILE("Reconcile to counted total");
        private final String label;
        Operation(String label) { this.label = label; }
        @Override public String toString() { return label; }
    }
    public static final List<String> REASONS = List.of("Physical inventory count", "Restocked from primary shipment", "Damaged / write-off", "Correction", "Customer return");

    private final Db db;
    private final ProductRepository products;
    private final LedgerRepository ledger;
    private final Session session;
    private final LookupCache cache;

    public StockService(Db db, ProductRepository products, LedgerRepository ledger, Session session, LookupCache cache) {
        this.cache = cache;
        this.db = db;
        this.products = products;
        this.ledger = ledger;
        this.session = session;
    }

    public List<Product> search(String text) throws SQLException, ServiceException {
        session.require("stock.view");
        return products.search(text);
    }

    public Product save(Product p, boolean isNew) throws SQLException, ServiceException {
        session.require("stock.manage");
        if (p.getId() != null) p.setId(p.getId().trim().toUpperCase());
        if (p.getId() != null && p.getId().isEmpty()) p.setId(null);
        List<String> errors = new ArrayList<>(p.validate());
        if (isNew && p.getId() != null && products.idTaken(p.getId())) errors.add("Stock ID " + p.getId() + " already exists.");
        if (!errors.isEmpty()) throw new ServiceException(errors);
        Product saved = products.save(p);
        cache.productChanged(saved.getId());
        return saved;
    }

    public void delete(String sku) throws SQLException, ServiceException {
        session.require("stock.manage");
        if (!products.delete(sku)) throw new ServiceException("Stock item not found.");
        cache.productChanged(sku);
    }

    /** Add / remove / reconcile in ONE transaction with its ledger row. Never below zero. */
    public Product adjust(String sku, Operation op, int qty, String reason) throws SQLException, ServiceException {
        session.require("stock.adjust");
        if (qty < 0 || qty > 1_000_000) throw new ServiceException("Quantity must be a whole number of 0 or more.");
        String why = REASONS.contains(reason) ? reason : "Correction";
        Product result = db.transaction(c -> {
            Product p = products.lock(c, sku).orElse(null);
            if (p == null || p.getStatus() == au.com.lpa.desktop.model.RecordStatus.DELETED) return null;
            int before = p.getOnHand();
            int after = switch (op) {
                case ADD -> before + qty;
                case REMOVE -> Math.max(0, before - qty);
                case RECONCILE -> qty;
            };
            products.setOnHand(c, p.getId(), after);
            if (after != before || op == Operation.RECONCILE) {
                ledger.record(c, p.getId(), session.user().getId(), op.name().toLowerCase(), why, before, after, Clocks.nowBrisbane());
            }
            p.setOnHand(after);
            return p;
        });
        if (result == null) throw new ServiceException("Stock item not found.");
        cache.productChanged(result.getId());
        return result;
    }

    public List<LedgerEntry> history(String sku) throws SQLException, ServiceException {
        session.require("stock.history");
        return ledger.forSku(sku);
    }

    public List<String> categories() throws SQLException { return products.categories(); }
}
