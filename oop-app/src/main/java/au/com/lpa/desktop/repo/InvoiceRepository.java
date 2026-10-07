package au.com.lpa.desktop.repo;

import au.com.lpa.desktop.model.Client;
import au.com.lpa.desktop.model.Invoice;
import au.com.lpa.desktop.model.InvoiceLine;
import au.com.lpa.desktop.model.RecordStatus;
import au.com.lpa.desktop.util.Db;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Optional;

/** Invoices (lpa_invoices) and their lines (lpa_invoice_items). */
public class InvoiceRepository extends JdbcRepository<Invoice> {

    public InvoiceRepository(Db db) { super(db); }

    @Override protected String table() { return "lpa_invoices"; }
    @Override protected String idColumn() { return "lpa_inv_no"; }
    @Override protected String statusColumn() { return "lpa_inv_status"; }
    @Override protected String selectSql() {
        return "SELECT lpa_inv_no, lpa_inv_date, lpa_inv_client_ID, lpa_inv_client_name, lpa_inv_client_address, lpa_inv_amount, lpa_inv_payment, lpa_inv_status FROM lpa_invoices";
    }
    @Override protected String searchExpression() {
        return "CONCAT_WS(' ', lpa_inv_no, lpa_inv_client_name, lpa_inv_client_ID, lpa_inv_client_address, DATE_FORMAT(lpa_inv_date, '%Y-%m-%d'))";
    }

    @Override
    protected Invoice map(ResultSet rs) throws SQLException {
        Invoice i = new Invoice();
        i.setId(rs.getString(1));
        i.setDate(rs.getTimestamp(2).toLocalDateTime().toLocalDate());
        i.setClientId(rs.getString(3));
        i.setClientName(rs.getString(4));
        i.setClientAddress(rs.getString(5));
        i.setStoredAmount(rs.getBigDecimal(6));
        i.setPayment(rs.getString(7));
        i.setStatus(RecordStatus.fromCode(rs.getString(8)));
        return i;
    }

    /** One invoice WITH its lines. */
    @Override
    public Optional<Invoice> findById(String number) throws SQLException {
        return db.run(c -> findById(c, number));
    }

    public Optional<Invoice> findById(Connection c, String number) throws SQLException {
        Optional<Invoice> inv = query(c, selectSql() + " WHERE lpa_inv_no = ? AND lpa_inv_status <> 'x'", number.trim().toUpperCase()).stream().findFirst();
        if (inv.isEmpty()) return inv;
        try (PreparedStatement ps = prepare(c, "SELECT lpa_invitem_stock_ID, lpa_invitem_stock_name, lpa_invitem_qty, lpa_invitem_stock_price "
                + "FROM lpa_invoice_items WHERE lpa_invitem_inv_no = ? ORDER BY lpa_invitem_no", inv.get().getId()); ResultSet rs = ps.executeQuery()) {
            while (rs.next()) inv.get().addLine(new InvoiceLine(rs.getString(1), rs.getString(2), rs.getInt(3), rs.getBigDecimal(4)));
        }
        return inv;
    }

    @Override
    public Invoice save(Invoice i) { throw new UnsupportedOperationException("Invoices are created by InvoiceService"); }

    /** INSERT invoice + lines inside the caller's transaction. Returns the new invoice number. */
    public String insert(Connection c, Invoice inv, Client client, LocalDateTime when) throws SQLException {
        String number = nextId(c, "INV-", 4);
        update(c, "INSERT INTO lpa_invoices (lpa_inv_no, lpa_inv_date, lpa_inv_client_ID, lpa_inv_client_name, lpa_inv_client_address, "
                + "lpa_inv_amount, lpa_inv_payment, lpa_inv_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'a')",
                number, Timestamp.valueOf(when), client.getId(), client.fullName(), client.getAddress(), inv.total(), inv.getPayment());
        for (InvoiceLine l : inv.getLines()) {
            update(c, "INSERT INTO lpa_invoice_items (lpa_invitem_inv_no, lpa_invitem_stock_ID, lpa_invitem_stock_name, lpa_invitem_qty, "
                    + "lpa_invitem_stock_price, lpa_invitem_stock_amount) VALUES (?, ?, ?, ?, ?, ?)", number, l.sku(), l.name(), l.qty(), l.price(), l.amount());
        }
        return number;
    }

    /** Soft delete inside a transaction; only one of two simultaneous deletes succeeds. */
    public boolean markDeleted(Connection c, String number) throws SQLException {
        return update(c, "UPDATE lpa_invoices SET lpa_inv_status = 'x' WHERE lpa_inv_no = ? AND lpa_inv_status = 'a'", number) == 1;
    }
}
