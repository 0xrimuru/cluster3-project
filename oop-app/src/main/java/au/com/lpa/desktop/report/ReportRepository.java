package au.com.lpa.desktop.report;

import au.com.lpa.desktop.util.Db;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Read-only queries for reports and planning (sales history from lpa_invoices / lpa_invoice_items). */
public class ReportRepository {

    /** Units and money per stock item since a date. */
    public record ItemSales(String sku, String name, int units, BigDecimal revenue) { }
    /** One invoice in a sales report. */
    public record InvoiceRow(String number, LocalDate date, String clientId, String client, String address, BigDecimal amount) { }

    private final Db db;

    public ReportRepository(Db db) { this.db = db; }

    public Map<String, ItemSales> salesBySku(LocalDate since) throws SQLException {
        return db.run(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT t.lpa_invitem_stock_ID, MAX(t.lpa_invitem_stock_name), SUM(t.lpa_invitem_qty), SUM(t.lpa_invitem_stock_amount) "
                    + "FROM lpa_invoice_items t JOIN lpa_invoices i ON i.lpa_inv_no = t.lpa_invitem_inv_no "
                    + "WHERE i.lpa_inv_status = 'a' AND i.lpa_inv_date >= ? GROUP BY t.lpa_invitem_stock_ID")) {
                ps.setTimestamp(1, Timestamp.valueOf(since.atStartOfDay()));
                try (ResultSet rs = ps.executeQuery()) {
                    Map<String, ItemSales> out = new HashMap<>();
                    while (rs.next()) out.put(rs.getString(1), new ItemSales(rs.getString(1), rs.getString(2), rs.getInt(3), rs.getBigDecimal(4)));
                    return out;
                }
            }
        });
    }

    /** All active invoices, oldest first (sorted by the database; binary search cuts date ranges out of it). */
    public List<InvoiceRow> invoicesByDate() throws SQLException {
        return db.run(c -> {
            try (PreparedStatement ps = c.prepareStatement("SELECT lpa_inv_no, lpa_inv_date, lpa_inv_client_ID, lpa_inv_client_name, lpa_inv_client_address, lpa_inv_amount "
                    + "FROM lpa_invoices WHERE lpa_inv_status = 'a' ORDER BY lpa_inv_date, lpa_inv_no"); ResultSet rs = ps.executeQuery()) {
                List<InvoiceRow> out = new ArrayList<>();
                while (rs.next()) out.add(new InvoiceRow(rs.getString(1), rs.getTimestamp(2).toLocalDateTime().toLocalDate(), rs.getString(3), rs.getString(4), rs.getString(5), rs.getBigDecimal(6)));
                return out;
            }
        });
    }
}
